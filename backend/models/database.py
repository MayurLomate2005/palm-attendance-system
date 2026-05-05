"""
Database Models — SQLAlchemy ORM definitions.
Tables: User, PalmFeature, Attendance, AuditLog, SystemConfig
"""
import json
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class User(db.Model):
    """Supports admin / teacher / student roles."""
    __tablename__ = "users"

    id            = db.Column(db.Integer, primary_key=True)
    name          = db.Column(db.String(100), nullable=False)
    email         = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role          = db.Column(db.String(20), nullable=False, default="student")
    is_active     = db.Column(db.Boolean, default=True, nullable=False)
    student_id    = db.Column(db.String(50), nullable=True, unique=True)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at    = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    palm_features     = db.relationship("PalmFeature", foreign_keys="PalmFeature.user_id",
                                         backref="user", lazy="dynamic", cascade="all, delete-orphan")
    attendance_records = db.relationship("Attendance", foreign_keys="Attendance.user_id",
                                          backref="user", lazy="dynamic", cascade="all, delete-orphan")

    def to_dict(self, include_samples=False):
        data = {
            "id":         self.id,
            "name":       self.name,
            "email":      self.email,
            "role":       self.role,
            "is_active":  self.is_active,
            "student_id": self.student_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_samples:
            data["palm_samples"] = self.palm_features.count()
        return data


class PalmFeature(db.Model):
    """Stores 63-float palm feature vectors per user."""
    __tablename__ = "palm_features"

    id             = db.Column(db.Integer, primary_key=True)
    user_id        = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    feature_vector = db.Column(db.Text, nullable=False)   # JSON list[63 floats]
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    def get_features(self) -> list:
        return json.loads(self.feature_vector)

    def set_features(self, features: list):
        self.feature_vector = json.dumps([float(f) for f in features])

    def to_dict(self):
        return {"id": self.id, "user_id": self.user_id,
                "created_at": self.created_at.isoformat() if self.created_at else None}


class Attendance(db.Model):
    """One record per user per date (enforced by unique constraint)."""
    __tablename__ = "attendance"
    __table_args__ = (
        db.UniqueConstraint("user_id", "date", name="uq_user_date"),
    )

    id            = db.Column(db.Integer, primary_key=True)
    user_id       = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date          = db.Column(db.Date,    nullable=False, index=True)
    time          = db.Column(db.Time,    nullable=False)
    status        = db.Column(db.String(20), default="present")   # present | absent | late
    method        = db.Column(db.String(20), default="palm")      # palm | manual
    confidence    = db.Column(db.Float, nullable=True)
    marked_by     = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    session_label = db.Column(db.String(100), nullable=True)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id":            self.id,
            "user_id":       self.user_id,
            "user_name":     self.user.name if self.user else None,
            "date":          self.date.isoformat() if self.date else None,
            "time":          self.time.strftime("%H:%M:%S") if self.time else None,
            "status":        self.status,
            "method":        self.method,
            "confidence":    round(self.confidence, 3) if self.confidence else None,
            "session_label": self.session_label,
            "created_at":    self.created_at.isoformat() if self.created_at else None,
        }


class AuditLog(db.Model):
    """Audit trail for all critical actions."""
    __tablename__ = "audit_logs"

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    action     = db.Column(db.String(100), nullable=False, index=True)
    details    = db.Column(db.Text, nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    timestamp  = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    actor = db.relationship("User", foreign_keys=[user_id])

    def to_dict(self):
        return {
            "id":         self.id,
            "user_id":    self.user_id,
            "actor_name": self.actor.name if self.actor else "System",
            "action":     self.action,
            "details":    self.details,
            "ip_address": self.ip_address,
            "timestamp":  self.timestamp.isoformat() if self.timestamp else None,
        }


class SystemConfig(db.Model):
    """Persistent key-value config rows (admin-settable)."""
    __tablename__ = "system_config"

    id          = db.Column(db.Integer, primary_key=True)
    key         = db.Column(db.String(100), unique=True, nullable=False)
    value       = db.Column(db.String(500), nullable=False)
    description = db.Column(db.String(300), nullable=True)
    updated_at  = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @classmethod
    def get(cls, key: str, default=None):
        row = cls.query.filter_by(key=key).first()
        return row.value if row else default

    @classmethod
    def set_value(cls, key: str, value: str, description: str = None):
        row = cls.query.filter_by(key=key).first()
        if row:
            row.value = str(value)
        else:
            db.session.add(cls(key=key, value=str(value), description=description))
        db.session.commit()
