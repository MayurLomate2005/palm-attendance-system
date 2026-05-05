"""Application Configuration."""
import os
from datetime import timedelta


class Config:
    # ── Security ─────────────────────────────────────────────
    SECRET_KEY = "SUPER_STRONG_FLASK_SECRET_KEY_123456789"

    # ── Database ─────────────────────────────────────────────
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))

    SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'palm_attendance.db')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False

    # ── JWT ──────────────────────────────────────────────────
    JWT_SECRET_KEY = "MY_FINAL_SECRET_KEY_123456789_SUPER_SECURE"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)

    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_NAME = "Authorization"
    JWT_HEADER_TYPE = "Bearer"

    JWT_ERROR_MESSAGE_KEY = "error"

    # ── ML / Palm (UPDATED FOR BETTER ACCURACY) ───────────────

    # ✅ Lower threshold for better real-world recognition
    CONFIDENCE_THRESHOLD = 0.65

    # Feature vector size (keep same)
    FEATURE_VECTOR_SIZE = 99

    # 🔥 Reduce augmentation (VERY IMPORTANT)
    AUGMENT_MULTIPLIER = 5   # was 50 ❌

    # Registration requirements (UPDATED)
    MIN_PALM_SAMPLES_FOR_TRAIN = 5   # was 3 ❌
    MAX_PALM_SAMPLES_PER_USER = 50   # was 20 ❌

    # ── ML Model Paths ───────────────────────────────────────
    ML_DIR = os.path.join(BASE_DIR, "ml_model")

    # Ensure folder exists
    os.makedirs(ML_DIR, exist_ok=True)

    MODEL_PATH         = os.path.join(ML_DIR, "model.pkl")
    SCALER_PATH        = os.path.join(ML_DIR, "scaler.pkl")
    LABEL_ENCODER_PATH = os.path.join(ML_DIR, "label_encoder.pkl")

    # ── Upload ───────────────────────────────────────────────
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024