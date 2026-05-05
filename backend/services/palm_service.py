"""
Palm Service — Feature extraction (MediaPipe 99-feature) + prediction (Ensemble SVM).

Feature vector layout (99 floats):
  [0:63]  — 21 landmarks × (x, y, z) relative to wrist  (raw)
  [63:84] — 21 inter-landmark Euclidean distances         (shape descriptor)
  [84:99] — 15 key joint angles in degrees               (geometry descriptor)
"""
import base64
import logging
import numpy as np

logger = logging.getLogger(__name__)

FEATURE_VECTOR_SIZE = 99   # Must match config.py FEATURE_VECTOR_SIZE

# ─────────────────────────────────────────────────────────────────────────────
# MediaPipe singleton
# ─────────────────────────────────────────────────────────────────────────────
_hands_processor = None


def _get_hands():
    global _hands_processor
    if _hands_processor is None:
        import mediapipe as mp
        _hands_processor = mp.solutions.hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.4,
            min_tracking_confidence=0.5,
            model_complexity=1,          # 0=lite, 1=full — use full for accuracy
        )
        logger.info("MediaPipe Hands initialised (FULL MODEL, 99-FEATURE MODE)")
    return _hands_processor


# ─────────────────────────────────────────────────────────────────────────────
# Image decode
# ─────────────────────────────────────────────────────────────────────────────

def _decode_b64(b64: str):
    """Decode base64 image string → OpenCV BGR ndarray."""
    import cv2
    if "," in b64:
        b64 = b64.split(",")[1]
    buf = np.frombuffer(base64.b64decode(b64), dtype=np.uint8)
    return cv2.imdecode(buf, cv2.IMREAD_COLOR)


# ─────────────────────────────────────────────────────────────────────────────
# Feature engineering helpers
# ─────────────────────────────────────────────────────────────────────────────

def _compute_distances(pts: np.ndarray) -> np.ndarray:
    """
    Compute 21 Euclidean distances from the wrist (landmark 0) to each other
    landmark (0..20). These capture hand SIZE and PROPORTIONS.

    pts: (21, 3) array of xyz coords already wrist-normalised.
    Returns: (21,) float array.
    """
    wrist = pts[0]   # should be ~[0,0,0] after normalisation
    dists = np.linalg.norm(pts - wrist, axis=1)  # (21,)
    return dists


def _compute_angles(pts: np.ndarray) -> np.ndarray:
    """
    Compute 15 joint angles (in degrees) between consecutive finger segments.

    Finger landmark triplets (base, mid, tip):
      Thumb:  [1,2,3], [2,3,4]
      Index:  [5,6,7], [6,7,8]
      Middle: [9,10,11], [10,11,12]
      Ring:   [13,14,15], [14,15,16]
      Pinky:  [17,18,19], [18,19,20]

    Plus 5 MCP angles (wrist → MCP → PIP):
      [0,5,6], [0,9,10], [0,13,14], [0,17,18], [0,1,2]

    Total: 10 + 5 = 15 angles.

    pts: (21, 3) wrist-normalised xyz.
    Returns: (15,) float array (degrees).
    """
    def angle_between(a, b, c):
        """Angle at vertex b formed by rays b→a and b→c."""
        ba = a - b
        bc = c - b
        cos_val = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
        cos_val = np.clip(cos_val, -1.0, 1.0)
        return float(np.degrees(np.arccos(cos_val)))

    triplets = [
        # Thumb
        (1, 2, 3), (2, 3, 4),
        # Index
        (5, 6, 7), (6, 7, 8),
        # Middle
        (9, 10, 11), (10, 11, 12),
        # Ring
        (13, 14, 15), (14, 15, 16),
        # Pinky
        (17, 18, 19), (18, 19, 20),
        # MCP spread angles (wrist as base)
        (0, 5, 6), (0, 9, 10), (0, 13, 14), (0, 17, 18), (0, 1, 2),
    ]

    angles = []
    for a_idx, b_idx, c_idx in triplets:
        angles.append(angle_between(pts[a_idx], pts[b_idx], pts[c_idx]))
    return np.array(angles, dtype=np.float32)


# ─────────────────────────────────────────────────────────────────────────────
# Main feature extractor (99 features)
# ─────────────────────────────────────────────────────────────────────────────

def extract_features(b64_image: str) -> list | None:
    """
    Extract a 99-float feature vector from a base64-encoded frame.

    Layout:
      [0:63]  raw wrist-normalised xyz (21 × 3)
      [63:84] per-landmark distances from wrist (21)
      [84:99] joint angles (15)

    Returns None if no hand is detected.
    """
    import cv2
    try:
        img = _decode_b64(b64_image)
        if img is None:
            return None
        if img.shape[0] < 100 or img.shape[1] < 100:
            return None

        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # Retry up to 3 times (helps with borderline detections)
        results = None
        for _ in range(3):
            results = _get_hands().process(rgb)
            if results.multi_hand_landmarks:
                break

        if not results or not results.multi_hand_landmarks:
            print("❌ No hand detected")
            return None

        print("✅ Hand detected — extracting 99 features")

        lms = results.multi_hand_landmarks[0].landmark

        # ── Raw xyz → (21, 3) ndarray ─────────────────────────────────────
        raw = np.array([[lm.x, lm.y, lm.z] for lm in lms], dtype=np.float32)  # (21,3)

        # ── Wrist normalisation ───────────────────────────────────────────
        wrist = raw[0].copy()
        pts = raw - wrist        # translate so wrist = origin

        # ── Segment 1: raw xyz flattened (63 floats) ──────────────────────
        seg1 = pts.flatten()     # (63,)

        # ── Segment 2: distances (21 floats) ─────────────────────────────
        seg2 = _compute_distances(pts)  # (21,)

        # ── Segment 3: angles (15 floats) ────────────────────────────────
        seg3 = _compute_angles(pts)     # (15,)

        # ── Concatenate → 99 features ─────────────────────────────────────
        feature_vec = np.concatenate([seg1, seg2, seg3])  # (99,)
        assert len(feature_vec) == FEATURE_VECTOR_SIZE, \
            f"Feature vector size mismatch: {len(feature_vec)} != {FEATURE_VECTOR_SIZE}"

        return feature_vec.tolist()

    except Exception as exc:
        logger.error("Feature extraction failed: %s", exc, exc_info=True)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Retrain from DB (with augmentation)
# ─────────────────────────────────────────────────────────────────────────────

def retrain_model_from_db(app_config) -> dict:
    """
    Pull all 99-feature vectors from DB, apply synthetic augmentation,
    and re-train the ensemble model.

    Steps:
      1. Load all PalmFeature rows for active users
      2. Filter to only 99-float vectors (skip legacy 63-float rows)
      3. Augment: generate 50 synthetic variants per real sample
      4. Train ensemble
      5. Return stats dict
    """
    from models.database import PalmFeature, User
    from ml_model.trainer import train_model
    from ml_model.augmentor import augment_dataset

    rows = PalmFeature.query.join(User).filter(User.is_active.is_(True)).all()

    if not rows:
        raise ValueError("No palm samples found. Register samples first.")

    X_real, y_real = [], []
    skipped = 0

    for row in rows:
        try:
            vec = row.get_features()
            if len(vec) == FEATURE_VECTOR_SIZE:
                X_real.append(vec)
                y_real.append(row.user_id)
            else:
                skipped += 1   # Legacy 63-float vector — skip
        except Exception:
            skipped += 1

    if skipped:
        logger.warning("Skipped %d legacy/malformed feature rows (size != %d). "
                       "Run /api/palm/migrate to clear them.", skipped, FEATURE_VECTOR_SIZE)

    if not X_real:
        raise ValueError(
            f"No valid {FEATURE_VECTOR_SIZE}-feature palm samples found. "
            "Please run migration (/api/palm/migrate) and re-register palms."
        )

    if len(set(y_real)) < 2:
        raise ValueError("Need ≥ 2 users with palm samples to train the model.")

    # ── Augment ──────────────────────────────────────────────────────────────
    n_aug = app_config.get("AUGMENT_MULTIPLIER", 50)
    logger.info("Augmenting %d real samples × %d → ~%d training samples",
                len(X_real), n_aug, len(X_real) * (n_aug + 1))

    X_aug, y_aug = augment_dataset(X_real, y_real, n_per_sample=n_aug)

    logger.info("Final training set: %d samples, %d classes",
                len(X_aug), len(set(y_aug)))

    return train_model(
        X=np.array(X_aug, dtype=np.float32),
        y=np.array(y_aug),
        model_path=app_config["MODEL_PATH"],
        scaler_path=app_config["SCALER_PATH"],
        label_encoder_path=app_config["LABEL_ENCODER_PATH"],
    )


# ─────────────────────────────────────────────────────────────────────────────
# Predict
# ─────────────────────────────────────────────────────────────────────────────

def predict_user(features: list, app_config) -> dict | None:
    """
    Classify a 99-feature vector using the trained ensemble.

    Returns {"user_id": int, "confidence": float} or None on failure.
    """
    import pickle
    import os

    if not os.path.exists(app_config["MODEL_PATH"]):
        return None

    try:
        with open(app_config["MODEL_PATH"], "rb") as f:
            model = pickle.load(f)
        with open(app_config["SCALER_PATH"], "rb") as f:
            scaler = pickle.load(f)
        with open(app_config["LABEL_ENCODER_PATH"], "rb") as f:
            le = pickle.load(f)

        X = scaler.transform([features])
        proba = model.predict_proba(X)[0]

        idx = int(np.argmax(proba))
        confidence = float(proba[idx])
        user_id = int(le.inverse_transform([idx])[0])

        logger.debug("Prediction: user_id=%d, confidence=%.4f", user_id, confidence)

        return {
            "user_id":    user_id,
            "confidence": confidence,
        }

    except Exception as exc:
        logger.error("Prediction failed: %s", exc, exc_info=True)
        return None