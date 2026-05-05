"""
Palm-Based Biometric Attendance System
Flask Application Entry Point
"""
import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from models.database import db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # ✅ FORCE JWT SETTINGS
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_HEADER_NAME"] = "Authorization"
    app.config["JWT_HEADER_TYPE"] = "Bearer"

    print("JWT configured successfully")

    # Ensure ML dir
    os.makedirs(app.config["ML_DIR"], exist_ok=True)

    db.init_app(app)

    # ✅ FIXED CORS (IMPORTANT)
    CORS(
    app,
    resources={r"/api/*": {"origins": "*"}},  # ✅ allow all
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
)

    jwt = JWTManager(app)

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        print("JWT INVALID:", error)
        return jsonify({"error": "Invalid token"}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        print("JWT MISSING:", error)
        return jsonify({"error": "Authorization header missing"}), 401

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({"error": "Token expired"}), 401

    # ── Routes ──
    from routes.auth import auth_bp
    from routes.palm import palm_bp
    from routes.attendance import attendance_bp
    from routes.admin import admin_bp
    from routes.esp32 import esp32_bp
    from routes.kiosk import kiosk_bp

    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(palm_bp, url_prefix="/api/palm")
    app.register_blueprint(attendance_bp, url_prefix="/api/attendance")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(esp32_bp, url_prefix="/api")
    app.register_blueprint(kiosk_bp, url_prefix="/api/kiosk")

    with app.app_context():
        db.create_all()
        _seed_default_users()

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok"})

    return app


def _seed_default_users():
    from models.database import User
    from werkzeug.security import generate_password_hash

    users = [
        {"name": "Admin", "email": "admin@palm.sys", "password": "admin123", "role": "admin"},
        {"name": "Teacher", "email": "teacher@palm.sys", "password": "teacher123", "role": "teacher"},
    ]

    for u in users:
        if not User.query.filter_by(email=u["email"]).first():
            db.session.add(User(
                name=u["name"],
                email=u["email"],
                password_hash=generate_password_hash(u["password"]),
                role=u["role"],
            ))
    db.session.commit()


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000)