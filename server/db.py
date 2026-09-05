# db.py — MongoDB connection with local JSON fallback
# Central server database layer for the library-seat app.

import os
import json
import uuid
from datetime import datetime

MONGO_URI = os.environ.get("MONGO_URI", "")
DB_NAME = "library_seat"
FALLBACK_FILE = os.path.join(os.path.dirname(__file__), "fallback.json")

client = None
db = None

_DEFAULT_SHAPE = {
    "users": [],       # {id, role, username, password_hash, phone, email, name, semester, branch, unique_id}
    "bookings": [],     # {id, user_id, seat_id, date, time_slot, status, checked_in_at}
    "seats": [],        # {seat_id} registry — seeded on first boot
    "heartbeats": {},   # seat_id -> {face, phone, brightness, status, user_id, ts}
    "sessions": [],      # {user_id, date, study, sleep, inactive, updated}
    "books": []          # {title, author, copies_total, copies_available}
}


def init_db():
    global client, db
    try:
        from pymongo import MongoClient
        client = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=5000,
            tlsAllowInvalidCertificates=True
        )
        client.server_info()
        db = client[DB_NAME]
        print("[DB] Connected to MongoDB Atlas")
    except Exception as e:
        print(f"[DB] MongoDB unavailable ({e}), using local JSON fallback")
        db = None
    _ensure_seats_seeded()


def get_db():
    return db


def _load_fallback():
    if os.path.exists(FALLBACK_FILE):
        with open(FALLBACK_FILE, "r") as f:
            data = json.load(f)
        for k, v in _DEFAULT_SHAPE.items():
            data.setdefault(k, v if not isinstance(v, (list, dict)) else type(v)())
        return data
    return json.loads(json.dumps(_DEFAULT_SHAPE))


def _save_fallback(data):
    with open(FALLBACK_FILE, "w") as f:
        json.dump(data, f, indent=2)


# ── Seat registry ──────────────────────────────────────────────────────────
# 3 columns x 5 rows to match the wireframe grid: A1-A5, B1-B5, C1-C5

def _seat_ids():
    return [f"{col}{row}" for col in ("A", "B", "C") for row in range(1, 6)]


def _ensure_seats_seeded():
    ids = _seat_ids()
    if db is not None:
        existing = {s["seat_id"] for s in db.seats.find({}, {"seat_id": 1})}
        missing = [{"seat_id": sid} for sid in ids if sid not in existing]
        if missing:
            db.seats.insert_many(missing)
    else:
        data = _load_fallback()
        existing = {s["seat_id"] for s in data["seats"]}
        for sid in ids:
            if sid not in existing:
                data["seats"].append({"seat_id": sid})
        _save_fallback(data)


def all_seat_ids():
    return _seat_ids()


# ── Users ─────────────────────────────────────────────────────────────────

def find_user_by_username(username):
    if db is not None:
        return db.users.find_one({"username": username}, {"_id": 0})
    data = _load_fallback()
    return next((u for u in data["users"] if u["username"] == username), None)


def find_user_by_id(user_id):
    if db is not None:
        return db.users.find_one({"id": user_id}, {"_id": 0})
    data = _load_fallback()
    return next((u for u in data["users"] if u["id"] == user_id), None)


def create_user(user):
    if db is not None:
        db.users.insert_one(dict(user))
    else:
        data = _load_fallback()
        data["users"].append(user)
        _save_fallback(data)
    return user


def update_user(user_id, patch):
    if db is not None:
        db.users.update_one({"id": user_id}, {"$set": patch})
    else:
        data = _load_fallback()
        for u in data["users"]:
            if u["id"] == user_id:
                u.update(patch)
        _save_fallback(data)


# ── Bookings ──────────────────────────────────────────────────────────────

def get_bookings_for_slot(date_str, time_slot):
    if db is not None:
        return list(db.bookings.find(
            {"date": date_str, "time_slot": time_slot, "status": {"$in": ["booked", "checked_in"]}},
            {"_id": 0}
        ))
    data = _load_fallback()
    return [b for b in data["bookings"]
            if b["date"] == date_str and b["time_slot"] == time_slot
            and b["status"] in ("booked", "checked_in")]


def get_booking_by_id(booking_id):
    if db is not None:
        return db.bookings.find_one({"id": booking_id}, {"_id": 0})
    data = _load_fallback()
    return next((b for b in data["bookings"] if b["id"] == booking_id), None)


def find_active_booking_for_seat(seat_id, date_str, time_slot=None):
    """If time_slot is given, match it exactly (used for the booking grid).
    If omitted, return any active booking for that seat/date regardless of
    the exact time text — used for check-in and the Pi's "who's here"
    lookup, since a seat only has one live occupant at a time in practice."""
    if time_slot is not None:
        for b in get_bookings_for_slot(date_str, time_slot):
            if b["seat_id"] == seat_id:
                return b
        return None

    if db is not None:
        return db.bookings.find_one(
            {"seat_id": seat_id, "date": date_str, "status": {"$in": ["booked", "checked_in"]}},
            {"_id": 0}
        )
    data = _load_fallback()
    return next((b for b in data["bookings"]
                 if b["seat_id"] == seat_id and b["date"] == date_str
                 and b["status"] in ("booked", "checked_in")), None)


def create_booking(user_id, seat_id, date_str, time_slot):
    booking = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "seat_id": seat_id,
        "date": date_str,
        "time_slot": time_slot,
        "status": "booked",
        "created": datetime.utcnow().isoformat(),
        "checked_in_at": None
    }
    if db is not None:
        db.bookings.insert_one(dict(booking))
    else:
        data = _load_fallback()
        data["bookings"].append(booking)
        _save_fallback(data)
    return booking


def update_booking(booking_id, patch):
    if db is not None:
        db.bookings.update_one({"id": booking_id}, {"$set": patch})
    else:
        data = _load_fallback()
        for b in data["bookings"]:
            if b["id"] == booking_id:
                b.update(patch)
        _save_fallback(data)


def get_user_bookings(user_id, upcoming_only=True):
    if db is not None:
        q = {"user_id": user_id}
        if upcoming_only:
            q["status"] = {"$in": ["booked", "checked_in"]}
        return list(db.bookings.find(q, {"_id": 0}))
    data = _load_fallback()
    out = [b for b in data["bookings"] if b["user_id"] == user_id]
    if upcoming_only:
        out = [b for b in out if b["status"] in ("booked", "checked_in")]
    return out


# ── Heartbeats (live seat occupancy from each Pi) ───────────────────────────

def save_heartbeat(seat_id, payload):
    payload = dict(payload)
    payload["ts"] = datetime.utcnow().isoformat()
    if db is not None:
        db.heartbeats.update_one({"seat_id": seat_id}, {"$set": payload}, upsert=True)
    else:
        data = _load_fallback()
        data["heartbeats"][seat_id] = payload
        _save_fallback(data)


def get_heartbeat(seat_id):
    if db is not None:
        doc = db.heartbeats.find_one({"seat_id": seat_id}, {"_id": 0})
        return doc
    data = _load_fallback()
    return data["heartbeats"].get(seat_id)


def get_all_heartbeats():
    if db is not None:
        return {h["seat_id"]: h for h in db.heartbeats.find({}, {"_id": 0})}
    data = _load_fallback()
    return data["heartbeats"]


# ── Study sessions (per user, per day) ──────────────────────────────────────

def save_session(user_id, date_str, study_secs, sleep_secs, inactive_secs):
    doc = {
        "user_id": user_id,
        "date": date_str,
        "study": study_secs,
        "sleep": sleep_secs,
        "inactive": inactive_secs,
        "updated": datetime.utcnow().isoformat()
    }
    if db is not None:
        db.sessions.update_one({"user_id": user_id, "date": date_str}, {"$set": doc}, upsert=True)
    else:
        data = _load_fallback()
        existing = next((s for s in data["sessions"]
                          if s["user_id"] == user_id and s["date"] == date_str), None)
        if existing:
            existing.update(doc)
        else:
            data["sessions"].append(doc)
        _save_fallback(data)


def load_today_session(user_id, date_str):
    if db is not None:
        return db.sessions.find_one({"user_id": user_id, "date": date_str}, {"_id": 0})
    data = _load_fallback()
    return next((s for s in data["sessions"]
                 if s["user_id"] == user_id and s["date"] == date_str), None)


def load_sessions_range(user_id, days=7):
    if db is not None:
        return list(db.sessions.find({"user_id": user_id}, {"_id": 0}).sort("date", -1).limit(days))
    data = _load_fallback()
    sessions = [s for s in data["sessions"] if s["user_id"] == user_id]
    sessions.sort(key=lambda x: x["date"], reverse=True)
    return sessions[:days]


# ── Books ────────────────────────────────────────────────────────────────

def search_books(query):
    query = (query or "").strip().lower()
    if db is not None:
        if not query:
            docs = db.books.find({}, {"_id": 0})
        else:
            docs = db.books.find({"title": {"$regex": query, "$options": "i"}}, {"_id": 0})
        return list(docs)
    data = _load_fallback()
    if not query:
        return data["books"]
    return [b for b in data["books"] if query in b["title"].lower()]


def add_book(title, author, copies_total):
    book = {
        "id": str(uuid.uuid4()),
        "title": title,
        "author": author,
        "copies_total": copies_total,
        "copies_available": copies_total
    }
    if db is not None:
        db.books.insert_one(dict(book))
    else:
        data = _load_fallback()
        data["books"].append(book)
        _save_fallback(data)
    return book
