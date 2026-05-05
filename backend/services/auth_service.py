"""
Auth Service Utilities
"""
from functools import wraps
from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity, get_jwt
from models.database import User, db, AuditLog


def get_user_id():
    try:
        return int(get_jwt_identity())  # ✅ ALWAYS convert
    except:
        return None


def get_current_user():
    user_id = get_user_id()
    if not user_id:
        return None
    return User.query.get(user_id)


def role_required(*roles):
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            user_id = get_user_id()

            if not user_id:
                return jsonify({"error": "Invalid token"}), 401

            user = User.query.get(user_id)

            if not user:
                return jsonify({"error": "User not found"}), 404

            claims = get_jwt()
            user_role = claims.get("role")

            if user_role not in roles:
                return jsonify({"error": "Access denied"}), 403

            return fn(*args, **kwargs)

        return decorator
    return wrapper


def log_action(user_id, action, details=None, ip_address=None):
    log = AuditLog(
        user_id=user_id,
        action=action,
        details=details,
        ip_address=ip_address or request.remote_addr,
    )
    db.session.add(log)
    db.session.commit()