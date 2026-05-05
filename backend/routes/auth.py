"""
Auth Routes — POST /api/register, POST /api/login
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
    get_jwt
)
from werkzeug.security import generate_password_hash, check_password_hash
from models.database import db, User
from services.auth_service import log_action

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}

    name  = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role  = data.get("role", "student")

    if not all([name, email, password]):
        return jsonify({"error": "name, email and password are required"}), 400

    if role not in ("admin", "teacher", "student"):
        return jsonify({"error": "Invalid role"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    user = User(
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
        role=role,
        student_id=data.get("student_id"),
    )

    db.session.add(user)
    db.session.commit()

    log_action(user.id, "USER_REGISTERED", f"role={role}", request.remote_addr)

    # ✅ KEEP STRING (CORRECT WAY)
    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role}
    )

    return jsonify({
        "message": "Registered successfully",
        "token": token,
        "user": user.to_dict()
    }), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}

    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = User.query.filter_by(email=email).first()

    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid email or password"}), 401

    if not user.is_active:
        return jsonify({"error": "Account disabled. Contact admin."}), 403

    # ✅ KEEP STRING
    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role}
    )

    log_action(user.id, "USER_LOGIN", None, request.remote_addr)

    return jsonify({
        "token": token,
        "user": user.to_dict(include_samples=True)
    }), 200


@auth_bp.get("/me")
@jwt_required()
def me():
    user_id = int(get_jwt_identity())  # ✅ ALWAYS CONVERT HERE
    claims = get_jwt()

    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "Not found"}), 404

    return jsonify({
        "user": user.to_dict(include_samples=True),
        "role": claims.get("role")
    }), 200