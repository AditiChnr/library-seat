# config.py — Per-Pi configuration.
# Set these as environment variables in start.bat / a systemd unit / .env
# so each seat's Pi has its own identity.

import os

SEAT_ID = os.environ.get("SEAT_ID", "A1")
SERVER_URL = os.environ.get("SERVER_URL", "http://localhost:5000")
