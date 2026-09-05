# auth.py — Sign up / login with role (Admin/Student) + invite code

import os
import uuid
from werkzeug.security import generate_password_hash, check_password_hash

import db

# Invite codes gate who can register as which role.
# Override these via environment variables in production.
ADMIN_INVITE_CODE = os.environ.get("ADMIN_INVITE_CODE", "ADMIN-2026")
STUDENT_INVITE_CODE = os.environ.get("STUDENT_INVITE_CODE", "STUDENT-2026")


def signup(data):
    role = (data.get("role") or "").strip().lower()
    code = (data.get("code") or "").strip()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    phone = (data.get("phone") or "").strip()
    email = (data.get("email") or "").strip()

    if role not in ("admin", "student"):
        return {"error": "Role must be admin or student"}, 400
    if not username or not password:
        return {"error": "Username and password are required"}, 400
    if len(password) < 6:
        return {"error": "Password must be at least 6 characters"}, 400

    expected_code = ADMIN_INVITE_CODE if role == "admin" else STUDENT_INVITE_CODE
    if code != expected_code:
        return {"error": "Invalid code for selected role"}, 403

    if db.find_user_by_username(username):
        return {"error": "Username already taken"}, 409

    user = {
        "id": str(uuid.uuid4()),
        "role": role,
        "username": username,
        "password_hash": generate_password_hash(password),
        "phone": phone,
        "email": email,
        "name": "",
        "semester": "",
        "branch": "",
        "unique_id": username,
        "pomodoro_work_secs": 25 * 60,
        "pomodoro_break_secs": 5 * 60
    }
    db.create_user(user)

    public_user = {k: v for k, v in user.items() if k != "password_hash"}
    return {"ok": True, "user": public_user}, 200


def login(data):
    role = (data.get("role") or "").strip().lower()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return {"error": "Username and password are required"}, 400

    user = db.find_user_by_username(username)
    if not user or not check_password_hash(user["password_hash"], password):
        return {"error": "Invalid username or password"}, 401

    if role and user["role"] != role:
        return {"error": f"This account is registered as {user['role']}, not {role}"}, 403

    public_user = {k: v for k, v in user.items() if k != "password_hash"}
    return {"ok": True, "user": public_user}, 200
