"""
Kiosk Routes — Public endpoints for the door-mounted authentication screen.
No JWT required. The system identifies the person from the palm scan itself.

POST /api/kiosk/authenticate
  - Accepts a base64 image
  - Runs palm prediction
  - If recognised: marks attendance, returns student name + confidence
  - If not recognised or confidence too low: returns denied
"""
from datetime import date, datetime
from flask import Blueprint, request, jsonify, current_app
from models.database import db, Attendance, User
from services.palm_service import extract_features, predict_user
from services.auth_service import log_action

kiosk_bp = Blueprint("kiosk", __name__)


@kiosk_bp.post("/authenticate")
def kiosk_authenticate():
    """
    Public palm authentication endpoint for the door kiosk.
    No login needed — identifies the user from their palm scan.
    """
    data = request.get_json(silent=True) or {}
    b64  = data.get("image", "")

    if not b64:
        return jsonify({"error": "image is required"}), 400

    cfg = current_app.config

    import os
    if not os.path.exists(cfg["MODEL_PATH"]):
        return jsonify({
            "status":  "error",
            "message": "Model not trained yet. Contact administrator.",
            "model_ready": False
        }), 503

    # ── Extract features ─────────────────────────────────────────────────────
    features = extract_features(b64)
    print("Everything is Good")

    if features is None:
        return jsonify({
            "status":   "no_hand",
            "message":  "No palm detected. Please show your full palm.",
            "detected": False
        }), 200   # 200 so kiosk keeps scanning (not an app error)

    # ── Predict ───────────────────────────────────────────────────────────────
    result = predict_user(features, cfg)

    if result is None:
        return jsonify({
            "status":  "error",
            "message": "Prediction failed. Contact administrator."
        }), 500

    user_id    = result["user_id"]
    confidence = result["confidence"]

    # ── Confidence threshold check ────────────────────────────────────────────
    try:
        from models.database import SystemConfig
        threshold = float(SystemConfig.get("confidence_threshold") or cfg["CONFIDENCE_THRESHOLD"])
    except Exception:
        threshold = cfg["CONFIDENCE_THRESHOLD"]

    if confidence < threshold:
        return jsonify({
            "status":     "denied",
            "message":    "Palm not recognised. Access denied.",
            "confidence": round(confidence, 4),
            "threshold":  threshold,
            "detected":   True
        }), 200

    # ── Look up user ──────────────────────────────────────────────────────────
    user = User.query.get(user_id)
    if not user or not user.is_active:
        return jsonify({
            "status":  "denied",
            "message": "User not found or deactivated.",
            "detected": True
        }), 200

    # ── Mark attendance (1 per day) ───────────────────────────────────────────
    today     = date.today()
    now_time  = datetime.now().time()
    existing  = Attendance.query.filter_by(user_id=user_id, date=today).first()
    already_marked = existing is not None

    if not existing:
        record = Attendance(
            user_id       = user_id,
            date          = today,
            time          = now_time,
            status        = "present",
            method        = "palm",
            confidence    = confidence,
            marked_by     = user_id,
            session_label = "kiosk",
        )
        db.session.add(record)
        db.session.commit()
        log_action(user_id, "KIOSK_ATTENDANCE", f"confidence={confidence:.4f}")

    return jsonify({
        "status":          "granted",
        "message":         "Access granted" if not already_marked else "Already marked today",
        "user_id":         user_id,
        "user_name":       user.name,
        "student_id":      user.student_id or "",
        "confidence":      round(confidence, 4),
        "threshold":       threshold,
        "already_marked":  already_marked,
        "time":            now_time.strftime("%H:%M:%S"),
        "date":            str(today),
        "detected":        True
    }), 200


@kiosk_bp.get("/recent")
def kiosk_recent():
    """Return last 10 students who authenticated today (for the kiosk rolling log)."""
    today = date.today()
    records = (
        Attendance.query
        .filter_by(date=today, method="palm")
        .order_by(Attendance.time.desc())
        .limit(10)
        .all()
    )
    return jsonify({
        "records": [
            {
                "user_name":  r.user.name if r.user else "Unknown",
                "student_id": r.user.student_id if r.user else "",
                "time":       r.time.strftime("%H:%M:%S") if r.time else "",
                "confidence": round(r.confidence, 3) if r.confidence else None,
            }
            for r in records
        ]
    }), 200
