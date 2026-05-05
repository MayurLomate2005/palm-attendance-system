"""
Attendance Routes
"""
from datetime import date, datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.database import db, Attendance, User
from services.auth_service import role_required, get_current_user, log_action

attendance_bp = Blueprint("attendance", __name__)


# ─────────────────────────────────────────────
# MARK ATTENDANCE
# ─────────────────────────────────────────────
@attendance_bp.post("/mark")
@jwt_required()
def mark():
    """Mark attendance for authenticated user (1 per day)."""
    user_id = int(get_jwt_identity())  # ✅ FIXED

    data       = request.get_json(silent=True) or {}
    today      = date.today()
    now        = datetime.now().time()
    confidence = data.get("confidence")
    method     = data.get("method", "palm")
    session    = data.get("session_label", "")

    existing = Attendance.query.filter_by(user_id=user_id, date=today).first()
    if existing:
        return jsonify({
            "error": "Attendance already marked today",
            "record": existing.to_dict()
        }), 409

    record = Attendance(
        user_id=user_id,
        date=today,
        time=now,
        status="present",
        method=method,
        confidence=float(confidence) if confidence else None,
        marked_by=user_id,
        session_label=session,
    )

    db.session.add(record)
    db.session.commit()

    log_action(user_id, "ATTENDANCE_MARKED", f"method={method}, confidence={confidence}")

    return jsonify({
        "message": "Attendance marked",
        "record": record.to_dict()
    }), 201


# ─────────────────────────────────────────────
# STUDENT HISTORY
# ─────────────────────────────────────────────
@attendance_bp.get("/student/<int:student_id>")
@jwt_required()
def student_history(student_id):
    me = get_current_user()

    if me.role == "student" and me.id != student_id:
        return jsonify({"error": "Forbidden"}), 403

    records = (Attendance.query
               .filter_by(user_id=student_id)
               .order_by(Attendance.date.desc())
               .all())

    total   = len(records)
    present = sum(1 for r in records if r.status == "present")
    pct     = round((present / total * 100), 1) if total else 0.0

    return jsonify({
        "student_id": student_id,
        "total_days": total,
        "present": present,
        "absent": total - present,
        "percentage": pct,
        "records": [r.to_dict() for r in records],
    }), 200


# ─────────────────────────────────────────────
# CLASS VIEW (🔥 FIXED)
# ─────────────────────────────────────────────
@attendance_bp.get("/class")
@jwt_required()  # ✅ FIXED
@role_required("admin", "teacher")
def class_view():
    date_str = request.args.get("date", str(date.today()))

    try:
        filter_date = date.fromisoformat(date_str)
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400

    records = (Attendance.query
               .filter_by(date=filter_date)
               .join(User, Attendance.user_id == User.id)
               .filter(User.role == "student")
               .order_by(Attendance.time.asc())
               .all())

    all_students = User.query.filter_by(role="student", is_active=True).all()
    present_ids  = {r.user_id for r in records}
    absent       = [s.to_dict() for s in all_students if s.id not in present_ids]

    return jsonify({
        "date": date_str,
        "total_students": len(all_students),
        "present_count": len(records),
        "absent_count": len(absent),
        "records": [r.to_dict() for r in records],
        "absent_students": absent,
    }), 200


# ─────────────────────────────────────────────
# TODAY ATTENDANCE
# ─────────────────────────────────────────────
@attendance_bp.get("/today")
@jwt_required()
def today():
    records = (Attendance.query
               .filter_by(date=date.today())
               .order_by(Attendance.time.desc())
               .all())

    return jsonify({
        "records": [r.to_dict() for r in records]
    }), 200


# ─────────────────────────────────────────────
# MANUAL MARK (🔥 FIXED)
# ─────────────────────────────────────────────
@attendance_bp.put("/manual")
@jwt_required()  # ✅ FIXED
@role_required("admin", "teacher")
def manual_mark():
    user_id = int(get_jwt_identity())  # ✅ FIXED

    data     = request.get_json(silent=True) or {}
    target   = data.get("user_id")
    status   = data.get("status", "present")
    session  = data.get("session_label", "")
    date_str = data.get("date", str(date.today()))

    if not target:
        return jsonify({"error": "user_id required"}), 400

    try:
        mark_date = date.fromisoformat(str(date_str))
    except ValueError:
        return jsonify({"error": "Invalid date"}), 400

    student = User.query.get(target)
    if not student:
        return jsonify({"error": "Student not found"}), 404

    record = Attendance.query.filter_by(user_id=target, date=mark_date).first()

    if record:
        record.status        = status
        record.method        = "manual"
        record.marked_by     = user_id
        record.session_label = session
    else:
        record = Attendance(
            user_id=target,
            date=mark_date,
            time=datetime.now().time(),
            status=status,
            method="manual",
            marked_by=user_id,
            session_label=session,
        )
        db.session.add(record)

    db.session.commit()

    log_action(user_id, "MANUAL_ATTENDANCE", f"user={target}, status={status}")

    return jsonify({
        "message": "Attendance updated",
        "record": record.to_dict()
    }), 200


# ─────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────
@attendance_bp.get("/summary")
@jwt_required()
def summary():
    from sqlalchemy import func

    rows = (db.session.query(Attendance.date, func.count(Attendance.id))
            .filter(Attendance.status == "present")
            .group_by(Attendance.date)
            .order_by(Attendance.date.asc())
            .limit(30)
            .all())

    return jsonify({
        "data": [{"date": str(r[0]), "count": r[1]} for r in rows]
    }), 200