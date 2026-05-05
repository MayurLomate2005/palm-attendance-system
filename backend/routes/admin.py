"""
Admin Routes
"""
from datetime import date, timedelta
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import get_jwt_identity, jwt_required
from models.database import db, User, Attendance, AuditLog, PalmFeature, SystemConfig
from services.auth_service import role_required, log_action

admin_bp = Blueprint("admin", __name__)


# helper
def get_user_id():
    return int(get_jwt_identity())


# 🔥 FIX: ADD @jwt_required()

@admin_bp.get("/users")
@jwt_required()
@role_required("admin", "teacher")
def list_users():
    role   = request.args.get("role")
    active = request.args.get("active")

    q = User.query

    if role:
        q = q.filter_by(role=role)

    if active is not None:
        q = q.filter_by(is_active=(active.lower() == "true"))

    users = q.order_by(User.created_at.desc()).all()

    return jsonify({
        "users": [u.to_dict(include_samples=True) for u in users]
    }), 200


@admin_bp.get("/users/<int:uid>")
@jwt_required()
@role_required("admin")
def get_user(uid):
    user = User.query.get_or_404(uid)

    data = user.to_dict(include_samples=True)
    data["attendance_count"] = user.attendance_records.filter_by(status="present").count()

    return jsonify({"user": data}), 200


@admin_bp.patch("/users/<int:uid>")
@jwt_required()
@role_required("admin")
def update_user(uid):
    user = User.query.get_or_404(uid)
    data = request.get_json(silent=True) or {}

    user_id = get_user_id()

    if "is_active" in data:
        user.is_active = bool(data["is_active"])

    if "role" in data and data["role"] in ("admin", "teacher", "student"):
        user.role = data["role"]

    if "name" in data:
        user.name = data["name"]

    db.session.commit()

    log_action(user_id, "USER_UPDATED", f"uid={uid} changes={list(data.keys())}")

    return jsonify({
        "message": "User updated",
        "user": user.to_dict()
    }), 200


@admin_bp.delete("/users/<int:uid>")
@jwt_required()
@role_required("admin")
def delete_user(uid):
    user = User.query.get_or_404(uid)

    user_id = get_user_id()

    if user.id == user_id:
        return jsonify({"error": "Cannot delete yourself"}), 400

    db.session.delete(user)
    db.session.commit()

    log_action(user_id, "USER_DELETED", f"uid={uid} email={user.email}")

    return jsonify({"message": "User deleted"}), 200


@admin_bp.get("/analytics")
@jwt_required()
@role_required("admin", "teacher")
def analytics():
    total_students = User.query.filter_by(role="student", is_active=True).count()
    total_teachers = User.query.filter_by(role="teacher", is_active=True).count()
    today_present  = Attendance.query.filter_by(date=date.today(), status="present").count()

    seven_days = []
    for i in range(6, -1, -1):
        d = date.today() - timedelta(days=i)
        cnt = Attendance.query.filter_by(date=d, status="present").count()
        seven_days.append({"date": str(d), "present": cnt})

    palm_marks   = Attendance.query.filter_by(method="palm").count()
    manual_marks = Attendance.query.filter_by(method="manual").count()
    total_samples = PalmFeature.query.count()

    import os
    model_ready = os.path.exists(current_app.config["MODEL_PATH"])

    return jsonify({
        "total_students": total_students,
        "total_teachers": total_teachers,
        "today_present": today_present,
        "today_absent": max(0, total_students - today_present),
        "weekly_data": seven_days,
        "palm_marks": palm_marks,
        "manual_marks": manual_marks,
        "total_palm_samples": total_samples,
        "model_ready": model_ready,
    }), 200


@admin_bp.get("/logs")
@jwt_required()
@role_required("admin")
def logs():
    page     = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))

    rows = (AuditLog.query
            .order_by(AuditLog.timestamp.desc())
            .paginate(page=page, per_page=per_page, error_out=False))

    return jsonify({
        "logs": [r.to_dict() for r in rows.items],
        "total": rows.total,
        "pages": rows.pages,
        "page": page,
    }), 200


@admin_bp.get("/threshold")
@jwt_required()
@role_required("admin")
def get_threshold():
    val = SystemConfig.get(
        "confidence_threshold",
        str(current_app.config["CONFIDENCE_THRESHOLD"])
    )
    return jsonify({"threshold": float(val)}), 200


@admin_bp.patch("/threshold")
@jwt_required()
@role_required("admin")
def set_threshold():
    data = request.get_json(silent=True) or {}
    val  = data.get("threshold")

    if val is None or not (0.1 <= float(val) <= 1.0):
        return jsonify({"error": "threshold must be between 0.1 and 1.0"}), 400

    SystemConfig.set_value("confidence_threshold", str(float(val)))

    user_id = get_user_id()

    log_action(user_id, "THRESHOLD_UPDATED", f"value={val}")

    return jsonify({
        "message": "Threshold updated",
        "threshold": float(val)
    }), 200