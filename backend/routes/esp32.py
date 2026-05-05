"""
ESP32 Simulation Routes
POST /api/esp32/unlock  — simulated relay ON
GET  /api/esp32/status  — simulated door status
"""
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.auth_service import log_action

esp32_bp = Blueprint("esp32", __name__)

# In-memory simulated state
_door_state = {"locked": True, "last_unlocked": None, "unlocked_by": None}


@esp32_bp.post("/esp32/unlock")
@jwt_required()
def unlock():
    """Simulate sending an HTTP unlock command to ESP32."""
    data     = request.get_json(silent=True) or {}
    identity = get_jwt_identity()
    user_id  = identity["id"]
    reason   = data.get("reason", "palm_auth")

    _door_state["locked"]        = False
    _door_state["last_unlocked"] = datetime.utcnow().isoformat()
    _door_state["unlocked_by"]   = user_id

    log_action(user_id, "ESP32_UNLOCK", f"reason={reason}", request.remote_addr)

    return jsonify({
        "success":   True,
        "relay":     "ON",
        "message":   "🔓 Relay ON (Simulated) — Door Unlocked",
        "timestamp": _door_state["last_unlocked"],
        "note":      "Replace this endpoint URL with your real ESP32 IP for production.",
    }), 200


@esp32_bp.get("/esp32/status")
@jwt_required()
def status():
    return jsonify({
        "locked":        _door_state["locked"],
        "last_unlocked": _door_state["last_unlocked"],
        "unlocked_by":   _door_state["unlocked_by"],
        "relay":         "OFF" if _door_state["locked"] else "ON",
        "simulated":     True,
    }), 200
