# app.py — Central Flask server for the library-seat app.
# Runs on a normal server/PC and owns all shared state (users, bookings, books).
# Each seat's Raspberry Pi is a thin client that talks to this server —
# see pi_client/ for that side.

import os
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

import db as database
import auth
import seats as seats_module
import books as books_module

app = Flask(__name__, static_folder="dist", static_url_path="")
CORS(app)

database.init_db()


@app.route("/")
def index():
    dist = os.path.join(os.path.dirname(__file__), "dist")
    if os.path.exists(dist):
        return send_from_directory(dist, "index.html")
    return "<h2>Flask running. Build the React frontend first.</h2>", 200


@app.route("/<path:path>")
def static_proxy(path):
    dist = os.path.join(os.path.dirname(__file__), "dist")
    full = os.path.join(dist, path)
    if os.path.exists(full):
        return send_from_directory(dist, path)
    return send_from_directory(dist, "index.html")


# ── Auth ─────────────────────────────────────────────────────────────────

@app.route("/auth/signup", methods=["POST"])
def signup():
    body, code = auth.signup(request.get_json() or {})
    return jsonify(body), code


@app.route("/auth/login", methods=["POST"])
def login():
    body, code = auth.login(request.get_json() or {})
    return jsonify(body), code


# ── Seats: grid, booking, check-in ──────────────────────────────────────────

@app.route("/seats/grid")
def seats_grid():
    date_str = request.args.get("date", "")
    time_slot = request.args.get("time_slot", "")
    if not date_str or not time_slot:
        return jsonify({"error": "date and time_slot are required"}), 400
    return jsonify(seats_module.get_grid(date_str, time_slot))


@app.route("/seats/book", methods=["POST"])
def seats_book():
    data = request.get_json() or {}
    body, code = seats_module.book_seat(
        data.get("user_id", ""),
        data.get("seat_id", ""),
        data.get("date", ""),
        data.get("time_slot", "")
    )
    return jsonify(body), code


@app.route("/seats/my_bookings")
def seats_my_bookings():
    user_id = request.args.get("user_id", "")
    return jsonify(database.get_user_bookings(user_id))


@app.route("/seats/checkin", methods=["POST"])
def seats_checkin():
    data = request.get_json() or {}
    body, code = seats_module.checkin(
        data.get("user_id", ""),
        data.get("seat_code", ""),
        data.get("date", "")
    )
    return jsonify(body), code


# ── Pi ingestion: heartbeats from each seat's Raspberry Pi ─────────────────

@app.route("/pi/heartbeat", methods=["POST"])
def pi_heartbeat():
    """Each Pi POSTs here every few seconds with its detection state.
    Body: { seat_id, face, phone, brightness, status, user_id }"""
    data = request.get_json() or {}
    seat_id = data.get("seat_id", "")
    if not seat_id:
        return jsonify({"error": "seat_id required"}), 400
    database.save_heartbeat(seat_id, {
        "face": bool(data.get("face")),
        "phone": bool(data.get("phone")),
        "brightness": data.get("brightness", 0),
        "status": data.get("status", "INACTIVE"),
        "user_id": data.get("user_id")
    })
    return jsonify({"ok": True})


@app.route("/pi/active_booking")
def pi_active_booking():
    """The Pi polls this to find out which user (if any) is currently
    checked in at its seat, so it knows whose session to track."""
    seat_id = request.args.get("seat_id", "")
    date_str = request.args.get("date", "")
    booking = seats_module.get_active_booking_for_seat(seat_id, date_str)
    return jsonify({"booking": booking})


@app.route("/pi/checkout", methods=["POST"])
def pi_checkout():
    """The Pi calls this once it decides the student has left
    (face absent past its grace period)."""
    data = request.get_json() or {}
    seats_module.checkout(data.get("seat_id", ""), data.get("date", ""))
    return jsonify({"ok": True})


# ── Study sessions (per user) ───────────────────────────────────────────────

@app.route("/sessions/append", methods=["POST"])
def sessions_append():
    """The Pi posts final session totals here when a student's session ends."""
    data = request.get_json() or {}
    user_id = data.get("user_id", "")
    date_str = data.get("date", datetime.now().strftime("%Y-%m-%d"))
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    existing = database.load_today_session(user_id, date_str) or {}
    study = existing.get("study", 0) + int(data.get("study", 0))
    sleep = existing.get("sleep", 0) + int(data.get("sleep", 0))
    inactive = existing.get("inactive", 0) + int(data.get("inactive", 0))
    database.save_session(user_id, date_str, study, sleep, inactive)
    return jsonify({"ok": True})


@app.route("/sessions/today")
def sessions_today():
    user_id = request.args.get("user_id", "")
    date_str = datetime.now().strftime("%Y-%m-%d")
    doc = database.load_today_session(user_id, date_str) or {"study": 0, "sleep": 0, "inactive": 0}
    return jsonify(doc)


@app.route("/sessions/graph")
def sessions_graph():
    user_id = request.args.get("user_id", "")
    days = int(request.args.get("days", 7))
    docs = database.load_sessions_range(user_id, days)
    today = datetime.now().date()
    by_date = {d["date"]: d for d in docs}

    def to_hours(v):
        v = float(v or 0)
        return round(v / 3600, 2) if v > 24 else round(v, 2)

    result = []
    for i in range(days):
        d = today - timedelta(days=(days - 1 - i))
        date_str = d.strftime("%Y-%m-%d")
        doc = by_date.get(date_str)
        if doc:
            result.append({
                "date": date_str,
                "study": to_hours(doc.get("study", 0)),
                "sleep": to_hours(doc.get("sleep", 0)),
                "inactive": to_hours(doc.get("inactive", 0)),
            })
        else:
            result.append({"date": date_str, "study": 0, "sleep": 0, "inactive": 0})
    return jsonify(result)


# ── Pomodoro settings (per user) ────────────────────────────────────────────

@app.route("/pomodoro/set", methods=["POST"])
def pomodoro_set():
    data = request.get_json() or {}
    user_id = data.get("user_id", "")
    work_mins = int(data.get("work_mins", 25))
    break_mins = int(data.get("break_mins", 5))
    database.update_user(user_id, {
        "pomodoro_work_secs": work_mins * 60,
        "pomodoro_break_secs": break_mins * 60
    })
    return jsonify({"ok": True})


@app.route("/pomodoro/get")
def pomodoro_get():
    user_id = request.args.get("user_id", "")
    user = database.find_user_by_id(user_id)
    if not user:
        return jsonify({"work_mins": 25, "break_mins": 5})
    return jsonify({
        "work_mins": user.get("pomodoro_work_secs", 1500) // 60,
        "break_mins": user.get("pomodoro_break_secs", 300) // 60
    })


# ── Books ────────────────────────────────────────────────────────────────

@app.route("/books/search")
def books_search():
    return jsonify(books_module.search(request.args.get("q", "")))


# ── Profile ──────────────────────────────────────────────────────────────

@app.route("/profile/<user_id>", methods=["GET"])
def profile_get(user_id):
    user = database.find_user_by_id(user_id)
    if not user:
        return jsonify({"error": "Not found"}), 404
    return jsonify({k: v for k, v in user.items() if k != "password_hash"})


@app.route("/profile/<user_id>", methods=["POST"])
def profile_update(user_id):
    data = request.get_json() or {}
    allowed = {"name", "semester", "branch", "phone", "email", "unique_id"}
    patch = {k: v for k, v in data.items() if k in allowed}
    database.update_user(user_id, patch)
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
