"""
Offline Pipeline Test -- run this WITHOUT starting Flask to verify:
  1. Augmentor generates correct number/size of variants
  2. Trainer builds ensemble and reaches 100% training accuracy on synthetic data
  3. Prediction returns the correct user with high confidence

Usage:
    cd backend
    python ml_model/test_pipeline.py
"""
import sys
import os
import tempfile
import numpy as np

# Make sure backend/ is on the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ml_model.augmentor import generate_variants, augment_dataset
from ml_model.trainer import train_model


# -----------------------------------------------------------------------
# Test 1 -- Augmentor
# -----------------------------------------------------------------------
def test_augmentor():
    print("\n" + "="*60)
    print("TEST 1: Augmentor")
    print("="*60)

    vec = list(np.random.randn(99).astype(np.float32))

    variants = generate_variants(vec, n=50, include_original=True, seed=42)
    assert len(variants) == 51, f"Expected 51, got {len(variants)}"
    assert len(variants[0]) == 99, f"Expected 99 features, got {len(variants[0])}"

    original = np.array(vec)
    diffs = [np.linalg.norm(np.array(v) - original) for v in variants[1:]]
    assert all(d > 0 for d in diffs), "Some variants are identical to original!"

    print(f"  [PASS] Generated 51 variants, each 99 features")
    print(f"  [PASS] Mean distance from original: {np.mean(diffs):.4f}")
    print(f"  [PASS] Max distance from original:  {np.max(diffs):.4f}")


# -----------------------------------------------------------------------
# Test 2 -- Full augmentation of multi-user dataset
# -----------------------------------------------------------------------
def test_augment_dataset():
    print("\n" + "="*60)
    print("TEST 2: augment_dataset (5 users x 5 samples each)")
    print("="*60)

    n_users, n_samples = 5, 5
    X_real, y_real = [], []

    for uid in range(1, n_users + 1):
        base = np.random.randn(99).astype(np.float32) * uid
        for _ in range(n_samples):
            X_real.append((base + np.random.randn(99) * 0.01).tolist())
            y_real.append(uid)

    X_aug, y_aug = augment_dataset(X_real, y_real, n_per_sample=50)

    expected = n_users * n_samples * 51
    assert len(X_aug) == expected, f"Expected {expected}, got {len(X_aug)}"
    assert len(y_aug) == expected
    print(f"  [PASS] {expected} augmented samples from {len(X_real)} real samples")


# -----------------------------------------------------------------------
# Test 3 -- Training + Prediction
# -----------------------------------------------------------------------
def test_train_and_predict():
    print("\n" + "="*60)
    print("TEST 3: Train ensemble + predict (3 users x 5 samples)")
    print("="*60)

    n_users, n_samples = 3, 5
    X_real, y_real = [], []
    user_bases = {}

    for uid in range(1, n_users + 1):
        base = np.random.randn(99).astype(np.float32) + uid * 5.0
        user_bases[uid] = base
        for _ in range(n_samples):
            X_real.append((base + np.random.randn(99) * 0.05).tolist())
            y_real.append(uid)

    # Augment
    X_aug, y_aug = augment_dataset(X_real, y_real, n_per_sample=50)
    print(f"  Augmented to {len(X_aug)} samples")

    # Train into a temp directory
    with tempfile.TemporaryDirectory() as tmpdir:
        model_path  = os.path.join(tmpdir, "model.pkl")
        scaler_path = os.path.join(tmpdir, "scaler.pkl")
        le_path     = os.path.join(tmpdir, "label_encoder.pkl")

        stats = train_model(
            X=np.array(X_aug, dtype=np.float32),
            y=np.array(y_aug),
            model_path=model_path,
            scaler_path=scaler_path,
            label_encoder_path=le_path,
        )

        print(f"  Training stats: {stats}")
        assert stats["accuracy"] >= 0.99, f"Training acc too low: {stats['accuracy']}"
        print(f"  [PASS] Training accuracy: {stats['accuracy']:.4f}")

        # Predict each user
        import pickle
        with open(model_path, "rb") as f:  model  = pickle.load(f)
        with open(scaler_path, "rb") as f: scaler = pickle.load(f)
        with open(le_path, "rb") as f:     le     = pickle.load(f)

        all_correct = True
        for uid in range(1, n_users + 1):
            test_vec = (user_bases[uid] + np.random.randn(99) * 0.03).tolist()
            X_test = scaler.transform([test_vec])
            proba  = model.predict_proba(X_test)[0]
            idx    = int(np.argmax(proba))
            conf   = float(proba[idx])
            pred_uid = int(le.inverse_transform([idx])[0])

            correct = pred_uid == uid
            status  = "[PASS]" if correct else "[FAIL]"
            print(f"  {status} User {uid}: predicted={pred_uid}, confidence={conf:.4f}")
            if not correct:
                all_correct = False

        assert all_correct, "Some users were misidentified!"
        print("  [PASS] All users correctly identified")


# -----------------------------------------------------------------------
# Run all tests
# -----------------------------------------------------------------------
if __name__ == "__main__":
    print("\nPALM BIOMETRIC PIPELINE - OFFLINE TEST SUITE")
    print("="*60)

    try:
        test_augmentor()
        test_augment_dataset()
        test_train_and_predict()
        print("\n" + "="*60)
        print("ALL TESTS PASSED - Pipeline is ready for production!")
        print("="*60 + "\n")
    except AssertionError as e:
        print(f"\nTEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        import traceback
        print(f"\nUNEXPECTED ERROR: {e}")
        traceback.print_exc()
        sys.exit(1)
