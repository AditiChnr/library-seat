# main.py — Entry point that runs on each seat's Raspberry Pi.
# Starts the camera/detection loop, the LED/TFT display, and the threads
# that sync this seat's state with the central server (see config.py for
# SEAT_ID / SERVER_URL).
#
# Also exposes a tiny local Flask app (/video_feed, /stats) purely for
# on-device debugging — the real student-facing app talks to the central
# server, not to this.

import time
from flask import Flask, Response, jsonify

import camera
import display
import session
from config import SEAT_ID, SERVER_URL, TIME_SLOT

app = Flask(__name__)


@app.route("/video_feed")
def video_feed():
    def gen():
        while True:
            jpg = camera.get_frame_jpg()
            if jpg:
                yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n")
            time.sleep(0.04)
    return Response(gen(), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/stats")
def stats():
    s = session.get_stats()
    s.update(camera.get_detections())
    return jsonify(s)


if __name__ == "__main__":
    print(f"[Pi] Seat {SEAT_ID} starting — reporting to {SERVER_URL}, slot {TIME_SLOT}")

    try:
        camera.start()
        print("[Pi] Camera started OK")
    except Exception as e:
        print(f"[Pi] WARNING: camera failed to start: {e}")

    try:
        display.start()
        print("[Pi] Display started OK")
    except Exception as e:
        print(f"[Pi] WARNING: display failed to start: {e}")

    session.start_sync_threads()

    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
