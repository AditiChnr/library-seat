# session.py — Study/Sleep/Away timers, scoped to whichever user is
# currently checked in at THIS seat. Reports heartbeats + final session
# totals to the central server instead of owning its own database.

import time
import threading
import requests
from datetime import datetime

import display
from config import SEAT_ID, SERVER_URL

_lock = threading.Lock()

# Timers reset every time a new user checks in at this seat
_active_user_id = None
_study_secs = 0.0
_sleep_secs = 0.0
_inactive_secs = 0.0
_status = "INACTIVE"
_last_tick = time.time()

_pomodoro_bank = 0.0
_pomodoro_duration = 25 * 60
_pomodoro_break_secs = 5 * 60

_dark_since = None
DARK_THRESHOLD = 40
DARK_DURATION = 3

_face_lost_since = None
FACE_GRACE = 3                 # seconds before we call it "away" for status purposes
AWAY_CHECKOUT_SECS = 5 * 60    # seconds of continuous absence before auto checkout

_phone_start = None
_phone_consecutive = 0
PHONE_FRAMES_NEEDED = 8

_last_display_state = None

_gpio = None
_buzzer_pin = 18


def _init_gpio():
    global _gpio
    try:
        import RPi.GPIO as GPIO
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(_buzzer_pin, GPIO.OUT)
        _gpio = GPIO
        print("[Session] Real GPIO initialized")
    except ImportError:
        import mock_gpio as mg
        _gpio = mg
        _gpio.setmode(_gpio.BCM)
        _gpio.setup(_buzzer_pin, _gpio.OUT)
        print("[Session] Mock GPIO initialized")


_init_gpio()


def _buzz(duration=0.2):
    if _gpio:
        try:
            _gpio.output(_buzzer_pin, _gpio.HIGH)
            time.sleep(duration)
            _gpio.output(_buzzer_pin, _gpio.LOW)
        except Exception:
            pass


def _update_display(new_state: str):
    global _last_display_state
    if new_state != _last_display_state:
        try:
            display.set_state(new_state)
            _last_display_state = new_state
        except Exception as e:
            print(f"[Session] Display update error: {e}")


def _reset_timers():
    global _study_secs, _sleep_secs, _inactive_secs, _pomodoro_bank
    global _dark_since, _face_lost_since, _phone_start, _phone_consecutive
    _study_secs = 0.0
    _sleep_secs = 0.0
    _inactive_secs = 0.0
    _pomodoro_bank = 0.0
    _dark_since = None
    _face_lost_since = None
    _phone_start = None
    _phone_consecutive = 0


def tick(face_present: bool, phone_present: bool, brightness: float):
    """Called once a second by camera.py with the latest detection state."""
    global _study_secs, _sleep_secs, _inactive_secs, _status, _last_tick
    global _phone_start, _pomodoro_bank
    global _dark_since, _face_lost_since, _phone_consecutive

    now = time.time()
    elapsed = now - _last_tick
    _last_tick = now

    with _lock:
        if _active_user_id is None:
            # No one checked in here — nothing to track, just sit idle.
            _status = "INACTIVE"
            _update_display("idle")
            _face_lost_since = None
            return

        if phone_present:
            _phone_consecutive += 1
        else:
            _phone_consecutive = 0
        stable_phone = _phone_consecutive >= PHONE_FRAMES_NEEDED

        if brightness < DARK_THRESHOLD:
            if _dark_since is None:
                _dark_since = now
            dark_duration = now - _dark_since
        else:
            _dark_since = None
            dark_duration = 0

        if dark_duration >= DARK_DURATION:
            _status = "SLEEPING"
            _sleep_secs += elapsed
            _face_lost_since = None
            _update_display("sleeping")

        elif face_present and stable_phone:
            _status = "INACTIVE"
            _inactive_secs += elapsed
            _face_lost_since = None
            _update_display("phone")

        elif face_present and not stable_phone:
            _status = "STUDYING"
            _study_secs += elapsed
            _pomodoro_bank += elapsed
            _face_lost_since = None
            _update_display("studying")

        else:
            if _face_lost_since is None:
                _face_lost_since = now
            _status = "INACTIVE"
            _inactive_secs += elapsed
            _update_display("idle")

        if _pomodoro_bank >= _pomodoro_duration:
            _pomodoro_bank = 0.0
            _buzz(0.3)
            _update_display("break")

        if stable_phone:
            if _phone_start is None:
                _phone_start = now
            elif now - _phone_start >= 2 * 60:
                _buzz(0.5)
        else:
            _phone_start = None

        if _face_lost_since is not None and (now - _face_lost_since) >= AWAY_CHECKOUT_SECS:
            _do_checkout()


def set_pomodoro_duration(work_secs: int, break_secs: int = None):
    global _pomodoro_duration, _pomodoro_break_secs
    _pomodoro_duration = work_secs
    if break_secs is not None:
        _pomodoro_break_secs = break_secs


def get_stats():
    with _lock:
        return {
            "seat_id": SEAT_ID,
            "user_id": _active_user_id,
            "study": int(_study_secs),
            "sleep": int(_sleep_secs),
            "inactive": int(_inactive_secs),
            "status": _status,
        }


# ── Server sync loops ────────────────────────────────────────────────────

def _flush_session():
    """POST accumulated (delta) totals to the central server and zero them
    out locally — the server keeps the running daily total per user."""
    global _study_secs, _sleep_secs, _inactive_secs
    if _active_user_id is None:
        return
    try:
        requests.post(f"{SERVER_URL}/sessions/append", json={
            "user_id": _active_user_id,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "study": int(_study_secs),
            "sleep": int(_sleep_secs),
            "inactive": int(_inactive_secs),
        }, timeout=5)
        _study_secs = 0.0
        _sleep_secs = 0.0
        _inactive_secs = 0.0
    except Exception as e:
        print(f"[Session] Flush failed (will retry next cycle): {e}")


def _do_checkout():
    """Called when a student has been away long enough to count as gone."""
    global _active_user_id
    seat_user = _active_user_id
    if seat_user is None:
        return
    print(f"[Session] Auto checkout for user {seat_user}")
    _flush_session()
    try:
        requests.post(f"{SERVER_URL}/pi/checkout", json={
            "seat_id": SEAT_ID,
            "date": datetime.now().strftime("%Y-%m-%d"),
        }, timeout=5)
    except Exception as e:
        print(f"[Session] Checkout notify failed: {e}")
    _active_user_id = None
    _reset_timers()
    _update_display("idle")


def _heartbeat_loop():
    while True:
        try:
            with _lock:
                payload = {
                    "seat_id": SEAT_ID,
                    "face": _face_lost_since is None,
                    "phone": _phone_consecutive >= PHONE_FRAMES_NEEDED,
                    "brightness": 0,
                    "status": _status,
                    "user_id": _active_user_id,
                }
            requests.post(f"{SERVER_URL}/pi/heartbeat", json=payload, timeout=5)
        except Exception as e:
            print(f"[Session] Heartbeat failed: {e}")
        time.sleep(5)


def _booking_poll_loop():
    """Detect a new check-in (student scanned the QR / entered the code in
    the app) and pick up that user's Pomodoro settings."""
    global _active_user_id
    while True:
        try:
            date_str = datetime.now().strftime("%Y-%m-%d")
            r = requests.get(f"{SERVER_URL}/pi/active_booking", params={
                "seat_id": SEAT_ID, "date": date_str
            }, timeout=5)
            booking = r.json().get("booking")
            new_user = booking["user_id"] if booking else None

            with _lock:
                if new_user != _active_user_id:
                    if _active_user_id is not None:
                        _flush_session()
                    _active_user_id = new_user
                    _reset_timers()
                    print(f"[Session] Active user for seat {SEAT_ID} -> {new_user}")

            if new_user:
                pr = requests.get(f"{SERVER_URL}/pomodoro/get",
                                   params={"user_id": new_user}, timeout=5)
                pd = pr.json()
                set_pomodoro_duration(pd.get("work_mins", 25) * 60, pd.get("break_mins", 5) * 60)
        except Exception as e:
            print(f"[Session] Booking poll failed: {e}")
        time.sleep(10)


def _autosave_loop():
    while True:
        time.sleep(30)
        _flush_session()


def start_sync_threads():
    threading.Thread(target=_heartbeat_loop, daemon=True, name="HeartbeatThread").start()
    threading.Thread(target=_booking_poll_loop, daemon=True, name="BookingPollThread").start()
    threading.Thread(target=_autosave_loop, daemon=True, name="AutosaveThread").start()
