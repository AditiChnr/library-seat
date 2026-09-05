# seats.py — Seat grid, booking, and QR / code check-in logic

import db

# A seat is "occupied" once the Pi's camera confirms a face at that seat
# AND that seat has a checked_in booking. Anything else booked-but-not-yet-
# confirmed shows as "reserved" so the grid reflects real presence, not
# just a paper reservation.

HEARTBEAT_STALE_SECS = 30  # if no heartbeat in this long, don't trust "occupied"


def get_grid(date_str, time_slot):
    bookings = db.get_bookings_for_slot(date_str, time_slot)
    booking_by_seat = {b["seat_id"]: b for b in bookings}
    heartbeats = db.get_all_heartbeats()

    grid = []
    for seat_id in db.all_seat_ids():
        booking = booking_by_seat.get(seat_id)
        hb = heartbeats.get(seat_id)

        if not booking:
            status = "available"
        elif booking["status"] == "checked_in" and hb and hb.get("face"):
            status = "occupied"
        else:
            status = "reserved"

        grid.append({
            "seat_id": seat_id,
            "status": status,
            "booking_id": booking["id"] if booking else None
        })
    return grid


def book_seat(user_id, seat_id, date_str, time_slot):
    if seat_id not in db.all_seat_ids():
        return {"error": "Unknown seat"}, 404

    existing = db.find_active_booking_for_seat(seat_id, date_str, time_slot)
    if existing:
        return {"error": "Seat already booked for that slot"}, 409

    # one active booking per user per slot
    for b in db.get_user_bookings(user_id):
        if b["date"] == date_str and b["time_slot"] == time_slot:
            return {"error": "You already have a seat booked for that slot"}, 409

    booking = db.create_booking(user_id, seat_id, date_str, time_slot)
    return {"ok": True, "booking": booking}, 200


def checkin(user_id, seat_code, date_str):
    """seat_code can be a seat_id (from QR) or a manually typed unique code —
    for now the unique code IS the seat_id, printed at each seat. Matches
    on seat + date only (not the exact time text), so it works regardless
    of the custom from/to time the student picked when booking."""
    seat_id = (seat_code or "").strip().upper()
    booking = db.find_active_booking_for_seat(seat_id, date_str)

    if not booking:
        return {"error": "No booking found for this seat today"}, 404
    if booking["user_id"] != user_id:
        return {"error": "This seat is booked by someone else"}, 403
    if booking["status"] == "checked_in":
        return {"ok": True, "booking": booking}, 200

    db.update_booking(booking["id"], {"status": "checked_in"})
    booking["status"] = "checked_in"
    return {"ok": True, "booking": booking}, 200


def get_active_booking_for_seat(seat_id, date_str):
    """Used by the Pi client to know which user (if any) it should be
    attributing the current study session to."""
    booking = db.find_active_booking_for_seat(seat_id, date_str)
    if booking and booking["status"] == "checked_in":
        return booking
    return None


def checkout(seat_id, date_str):
    booking = db.find_active_booking_for_seat(seat_id, date_str)
    if booking and booking["status"] == "checked_in":
        db.update_booking(booking["id"], {"status": "completed"})
    return {"ok": True}
