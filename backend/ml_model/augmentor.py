"""
Augmentor — Generates synthetic palm feature variants from a single real sample.

Each real 99-float feature vector is augmented into N synthetic variants by:
  1. Gaussian jitter  — tiny random noise on each coordinate
  2. Scale jitter     — slightly shrink/expand the whole hand
  3. 2-D rotation     — small in-plane rotation of the landmark grid

The augmented data dramatically improves SVM generalisation without requiring
more real camera frames.
"""
import numpy as np
from typing import List


# ─────────────────────────────────────────────────────────────────────────────
# Low-level transform helpers
# ─────────────────────────────────────────────────────────────────────────────

def _add_jitter(vec: np.ndarray, sigma: float = 0.008) -> np.ndarray:
    """Add Gaussian noise to every element of the feature vector."""
    noise = np.random.normal(0, sigma, size=vec.shape)
    return vec + noise


def _scale_hand(vec: np.ndarray, scale_range: tuple = (0.88, 1.12)) -> np.ndarray:
    """
    Uniformly scale x, y, z coordinates by a random factor.
    The first 63 elements are raw landmarks (indices 0..62, stride-3 xyz).
    Remaining elements are distance/angle features — scaled proportionally.
    """
    factor = np.random.uniform(*scale_range)
    result = vec.copy()
    # Scale raw landmark block (first 63 values)
    result[:63] *= factor
    # Scale distance features (next 21 values) proportionally
    result[63:84] *= factor
    # Angle features (last 15 values) — no scaling (they are rotation-invariant)
    return result


def _rotate_2d(vec: np.ndarray, angle_deg_range: tuple = (-15, 15)) -> np.ndarray:
    """
    Apply a small 2-D rotation (in x-y plane) to the 21 raw landmarks
    and recompute the distance/angle blocks.
    Works on the wrist-normalised landmark block (first 63 floats, xyz triplets).
    """
    angle = np.radians(np.random.uniform(*angle_deg_range))
    cos_a, sin_a = np.cos(angle), np.sin(angle)

    result = vec.copy()
    for i in range(21):
        base = i * 3
        x, y = result[base], result[base + 1]
        result[base]     =  cos_a * x - sin_a * y
        result[base + 1] =  sin_a * x + cos_a * y
    return result


def _flip_horizontal(vec: np.ndarray) -> np.ndarray:
    """Mirror x-coordinates (simulates viewing the hand from the other side slightly)."""
    result = vec.copy()
    for i in range(21):
        result[i * 3] = -result[i * 3]
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def generate_variants(
    feature_vec: List[float],
    n: int = 50,
    include_original: bool = True,
    seed: int = None,
) -> List[List[float]]:
    """
    Generate `n` synthetic variants of a single feature vector.

    Parameters
    ----------
    feature_vec    : list[float] — the real 99-float feature vector
    n              : int         — number of synthetic samples to generate
    include_original: bool       — prepend the real vector to the output
    seed           : int|None    — optional RNG seed for reproducibility

    Returns
    -------
    list[list[float]] — length n (or n+1 if include_original=True)
    """
    if seed is not None:
        np.random.seed(seed)

    vec = np.array(feature_vec, dtype=np.float32)
    results = []

    if include_original:
        results.append(vec.copy().tolist())

    transforms = [
        lambda v: _add_jitter(v, sigma=0.005),
        lambda v: _add_jitter(v, sigma=0.010),
        lambda v: _add_jitter(v, sigma=0.015),
        lambda v: _scale_hand(v, (0.90, 1.10)),
        lambda v: _scale_hand(v, (0.85, 1.15)),
        lambda v: _rotate_2d(v, (-10, 10)),
        lambda v: _rotate_2d(v, (-15, 15)),
        lambda v: _flip_horizontal(v),
        # Combined transforms
        lambda v: _add_jitter(_scale_hand(v), sigma=0.007),
        lambda v: _add_jitter(_rotate_2d(v, (-12, 12)), sigma=0.006),
        lambda v: _scale_hand(_rotate_2d(v, (-8, 8)), (0.92, 1.08)),
        lambda v: _add_jitter(_scale_hand(_rotate_2d(v, (-10, 10))), sigma=0.005),
    ]

    for i in range(n):
        t = transforms[i % len(transforms)]
        augmented = t(vec.copy())
        results.append(augmented.tolist())

    return results


def augment_dataset(
    X: list,
    y: list,
    n_per_sample: int = 50,
) -> tuple:
    """
    Augment an entire dataset.

    Parameters
    ----------
    X             : list[list[float]] — feature matrix
    y             : list[int|str]     — labels (user IDs)
    n_per_sample  : int               — variants per real sample

    Returns
    -------
    (X_aug, y_aug) — augmented feature matrix and labels as lists
    """
    X_aug, y_aug = [], []
    for features, label in zip(X, y):
        variants = generate_variants(features, n=n_per_sample, include_original=True)
        X_aug.extend(variants)
        y_aug.extend([label] * len(variants))
    return X_aug, y_aug
