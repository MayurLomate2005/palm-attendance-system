"""
Palm Routes — capture samples, predict, retrain model, migrate legacy data.
"""

import os
import threading
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.database import db, PalmFeature, User
from services.palm_service import (
    extract_features,
    retrain_model_from_db,
    predict_user,
    FEATURE_VECTOR_SIZE,
)
from services.auth_service import role_required, log_action

palm_bp = Blueprint("palm", __name__)

# ✅ Global training status
training_status = "idle"


# ─────────────────────────────────────────────────────────────────────────────
# BACKGROUND TRAINING (FIXED WITH APP CONTEXT)
# ─────────────────────────────────────────────────────────────────────────────

def train_model_background(app, cfg, user_id):
    global training_status

    with app.app_context():
        training_status = "running"

        try:
            print("⚙️ Background training started...")

            result = retrain_model_from_db(cfg)

            print(f"✅ Training completed: {result}")

            # ❌ REMOVE log_action (causes error)
            print(f"📘 Model trained by user {user_id}")

            training_status = "completed"

        except Exception as e:
            print("❌ Training failed:", e)
            training_status = "failed"
# ─────────────────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────────────────

def get_user_id():
    try:
        return int(get_jwt_identity())
    except Exception:
        return None


def get_threshold(cfg):
    try:
        from models.database import SystemConfig
        val = SystemConfig.get("confidence_threshold")
        return float(val) if val else cfg["CONFIDENCE_THRESHOLD"]
    except Exception:
        return cfg["CONFIDENCE_THRESHOLD"]


# ─────────────────────────────────────────────────────────────────────────────
# CAPTURE SAMPLE
# ─────────────────────────────────────────────────────────────────────────────

@palm_bp.post("/capture")
@jwt_required()
def capture():
    user_id = get_user_id()
    if not user_id:
        return jsonify({"error": "Invalid token"}), 401

    data = request.get_json(silent=True) or {}
    b64 = data.get("image", "")

    if not b64:
        return jsonify({"error": "image is required"}), 400

    cfg = current_app.config

    all_rows = PalmFeature.query.filter_by(user_id=user_id).all()
    valid_count = sum(
        1 for row in all_rows
        if len(row.get_features()) == FEATURE_VECTOR_SIZE
    )

    if valid_count >= cfg["MAX_PALM_SAMPLES_PER_USER"]:
        return jsonify({
            "error": f"Max {cfg['MAX_PALM_SAMPLES_PER_USER']} samples reached"
        }), 409

    print("📸 Capturing palm sample...")

    features = extract_features(b64)

    if features is None:
        return jsonify({"error": "No palm detected"}), 422

    sample = PalmFeature(user_id=user_id)
    sample.set_features(features)

    db.session.add(sample)
    db.session.commit()

    new_count = valid_count + 1
    ready = new_count >= cfg["MIN_PALM_SAMPLES_FOR_TRAIN"]

    # ✅ AUTO BACKGROUND TRAIN
    if ready and not os.path.exists(cfg["MODEL_PATH"]):
        app = current_app._get_current_object()

        threading.Thread(
            target=train_model_background,
            args=(app, cfg, user_id)
        ).start()

    return jsonify({
        "message": f"Sample {new_count} captured",
        "count": new_count,
        "ready": ready
    }), 201


# ─────────────────────────────────────────────────────────────────────────────
# PREDICT
# ─────────────────────────────────────────────────────────────────────────────

@palm_bp.post("/predict")
@jwt_required()
def predict():
    data = request.get_json(silent=True) or {}
    b64 = data.get("image", "")

    if not b64:
        return jsonify({"error": "image is required"}), 400

    cfg = current_app.config

    if not os.path.exists(cfg["MODEL_PATH"]):
        return jsonify({
            "error": "Model not trained yet",
            "model_ready": False
        }), 503

    features = extract_features(b64)

    if features is None:
        return jsonify({"error": "No palm detected"}), 422

    result = predict_user(features, cfg)

    if result is None:
        return jsonify({"error": "Prediction failed"}), 500

    threshold = get_threshold(cfg)
    result["threshold_met"] = result["confidence"] >= threshold

    user = User.query.get(result["user_id"])
    result["user_name"] = user.name if user else "Unknown"

    return jsonify(result), 200


# ─────────────────────────────────────────────────────────────────────────────
# TRAIN MODEL (FIXED)
# ─────────────────────────────────────────────────────────────────────────────

@palm_bp.post("/train")
@jwt_required()
@role_required("admin", "teacher")
def train():
    user_id = get_user_id()

    app = current_app._get_current_object()

    threading.Thread(
        target=train_model_background,
        args=(app, app.config, user_id)
    ).start()

    return jsonify({
        "message": "Training started in background"
    }), 200


# ─────────────────────────────────────────────────────────────────────────────
# STATUS
# ─────────────────────────────────────────────────────────────────────────────

@palm_bp.get("/status")
@jwt_required()
def status():
    user_id = get_user_id()

    cfg = current_app.config

    all_rows = PalmFeature.query.filter_by(user_id=user_id).all()
    valid_count = sum(
        1 for r in all_rows
        if len(r.get_features()) == FEATURE_VECTOR_SIZE
    )

    model_ready = os.path.exists(cfg["MODEL_PATH"])

    return jsonify({
        "count": valid_count,
        "ready": valid_count >= cfg["MIN_PALM_SAMPLES_FOR_TRAIN"],
        "model_ready": model_ready,
        "training_status": training_status  # ✅ ADDED
    }), 200