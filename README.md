# Library Seat

> Book a seat. Sit down. Your study time tracks itself.

A library seat-booking and study-tracking system. Students reserve a seat for a
date and time slot, check in at the seat by scanning its code, and their focus
time is tracked automatically from that point on. Each seat has a Raspberry Pi
with a camera that reports live occupancy back to a central server, so the
booking grid shows who is *actually* sitting there — not just who reserved.

---

## Features

- **Role-based accounts** — separate Admin and Student sign-up, gated by an invite code
- **Seat booking** — pick a date and time slot, view a live seat grid, reserve a seat
- **Live occupancy** — seats show as available, reserved, or occupied based on real camera data
- **QR / code check-in** — scan the code at your seat (or type it) to bind your booking to that seat
- **Pomodoro timer** — configurable study and break durations, running on the check-in screen
- **Study tracker** — daily study and break totals, with graphs for the last 7, 14, or 30 days
- **Book availability** — search the library catalogue and see copies left
- **Profile** — student ID card with name, semester, branch, and college unique ID
- **Cloud sync** — MongoDB with a local JSON fallback when the database is unreachable

---

## Architecture

The system splits into three parts:

```
                    ┌──────────────────────┐
                    │   React frontend     │
                    │   (student app)      │
                    └──────────┬───────────┘
                               │ HTTP
                    ┌──────────▼───────────┐
                    │   Flask server       │  ← owns all shared state
                    │   + MongoDB          │    (users, bookings, books)
                    └──────────▲───────────┘
                               │ heartbeats
              ┌────────────────┼────────────────┐
        ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
        │ Pi seat A1│    │ Pi seat A2│    │ Pi seat A3│
        │ cam+LED   │    │ cam+LED   │    │ cam+LED   │
        └───────────┘    └───────────┘    └───────────┘
```

One Raspberry Pi sits at each seat. It runs only the camera loop and the
LED/display output, and reports its detection state to the central server every
few seconds. All bookings, users and books live on the server — the Pis hold no
database credentials and no shared state of their own.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Python, Flask, Flask-CORS |
| Database | MongoDB + local JSON fallback |
| Frontend | React 18, Vite |
| Charts | Recharts |
| QR scanning | jsQR (browser camera) |
| Computer vision | OpenCV (face detection), YOLOv8 (phone detection) |
| Hardware | Raspberry Pi, Pi Camera, GPIO LED + buzzer, ST7735 TFT |

---

## Project Structure

```
library-seat/
├── server/                 # Central Flask server
│   ├── app.py              # All HTTP routes
│   ├── db.py               # MongoDB layer + JSON fallback
│   ├── auth.py             # Sign-up / login
│   ├── seats.py            # Seat grid, booking, check-in
│   ├── books.py            # Book search
│   └── seed_data.py        # Sample books + study data
│
├── pi_client/              # Runs on each seat's Raspberry Pi
│   ├── main.py             # Camera loop + heartbeat reporting
│   ├── camera.py           # Face / phone detection
│   ├── session.py          # Study session state machine
│   ├── display.py          # TFT output
│   └── config.py           # SEAT_ID and server address
│
└── frontend/               # React student app
    └── src/
        ├── App.jsx
        ├── api.js
        ├── theme.css
        └── components/
            ├── SignUp.jsx / Login.jsx
            ├── BookSeat.jsx
            ├── Scanner.jsx
            ├── PomodoroSettings.jsx
            ├── StudyTracker.jsx
            ├── BookAvailability.jsx
            └── Profile.jsx
```

---

## Setup

### 1. Server

```bash
cd server
pip install -r requirements.txt
python app.py
```

Runs on `http://localhost:5000`.

To use MongoDB, set a `MONGO_URI` environment variable. Without it the server
falls back to a local `fallback.json` file, which is fine for development.

### 2. Sample data

```bash
cd server
python seed_data.py --user <your-username>
```

Loads engineering books into the catalogue and generates 30 days of study
history for the given account, so the tracker and availability screens have
something to show.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`. If the server isn't on `localhost:5000`, set
`VITE_SERVER_URL` in a `.env` file.

### 4. Run both at once

```bash
npm install -g concurrently
concurrently "cd server && python app.py" "cd frontend && npm run dev"
```

### 5. Raspberry Pi client

On each Pi, set its `SEAT_ID` and the server address in `pi_client/config.py`,
then:

```bash
cd pi_client
pip install -r requirements.txt
python main.py
```

---

## How a session works

1. Student books seat **A1** for a date and time slot.
2. At the library, they open **Scanner** and scan the code at seat A1.
3. The booking flips to `checked_in`, binding that student to that seat.
4. The Pomodoro timer starts on the same screen; time is saved as they study.
5. Seat A1's Pi confirms a face is present, so the grid shows A1 as *occupied*.
6. When the student leaves, the Pi checks them out and the session totals land
   in their Study Tracker.

---

## Status

Student-side features are built and working. Still in progress:

- Admin dashboard (seat management, book inventory, usage reports)
- Hardware integration and on-site testing across multiple seats
