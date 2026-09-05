# library-seat

A library seat-booking app with per-seat Raspberry Pi occupancy tracking
(face detection, phone detection, LED/buzzer feedback) built on top of the
original ORBIT study-monitor codebase.

## Architecture

```
                    ┌─────────────────────┐
  student's phone → │   central server     │ ← admin (future UI)
  (React frontend)  │   server/app.py      │
                    │   users / bookings /  │
                    │   books / sessions    │
                    └─────────┬────────────┘
                              │ heartbeats + checkouts
                    ┌─────────┴────────────┐
                    │  Pi at seat A1        │  ...one of these per seat
                    │  pi_client/main.py    │
                    │  camera + face/phone  │
                    │  detection + LED/TFT  │
                    └───────────────────────┘
```

- **`server/`** — one Flask app, runs anywhere (a PC, a small server, or one
  designated Pi). Owns all shared state: user accounts, seat bookings, book
  inventory, and each student's daily study totals.
- **`pi_client/`** — runs on *each* seat's Raspberry Pi. Same camera/face/
  phone detection logic as the original ORBIT project, but instead of
  tracking one global session it tracks whoever is currently checked in at
  that seat, and reports in to the central server.
- **`frontend/`** — the React app students use to sign up, book a seat, scan
  in, adjust Pomodoro settings, see their study tracker, and search book
  availability.

## How a booking flows end to end

1. Student books seat `A1` for a date/time slot in the app (`Book your Seat`).
2. Student sits down, opens `Scanner`, and scans the QR code printed at the
   seat (or types its code manually). This calls `/seats/checkin`, which
   binds their `user_id` to that seat's booking.
3. Seat A1's Pi polls `/pi/active_booking` every ~10s, notices the new
   check-in, and starts running face/phone/sleep detection *for that
   student*. It reports heartbeats to `/pi/heartbeat`, which is what makes
   the seat grid on `Book your Seat` show live occupancy instead of just a
   static reservation.
4. When the student leaves (face absent for 5 minutes), the Pi auto-checks-out,
   flushes the session's study/sleep/away totals to `/sessions/append`, and
   frees the seat.

## Setting up

### Central server
```
cd server
python -m venv venv
venv\Scripts\activate.bat   (or source venv/bin/activate on Linux/Mac)
pip install -r requirements.txt
python app.py
```
Set `MONGO_URI` as an environment variable to use MongoDB Atlas; otherwise it
falls back to `server/fallback.json` automatically, same pattern as before.

Set `ADMIN_INVITE_CODE` / `STUDENT_INVITE_CODE` env vars to change the
sign-up codes from the defaults in `server/auth.py`.

### Each seat's Raspberry Pi
```
cd pi_client
pip install -r requirements.txt
export SEAT_ID=A1
export SERVER_URL=http://<central-server-ip>:5000
export TIME_SLOT=09:00-11:00
python main.py
```
`SEAT_ID` must match one of the seat IDs the server knows about (`A1`-`A5`,
`B1`-`B5`, `C1`-`C5` by default — see `server/db.py::_seat_ids`). Print a QR
code containing exactly that seat ID and stick it at the seat; that's what
the Scanner page reads.

### Frontend
```
cd frontend
npm install
npm run dev
```
Create `frontend/.env` with `VITE_SERVER_URL=http://<central-server-ip>:5000`
if the server isn't on `localhost:5000`.

## What was removed from the original ORBIT repo

`attendance.py`/`Attendance.jsx` (class attendance), `AIAssistant.jsx`
(Gemini PDF chat), and `Reminders.jsx` (generic reminders) aren't part of
any wireframe for this app and were dropped. If you want any of them back
as bonus features, they're straightforward to port over — they didn't
depend on the old single-session architecture in a way that's hard to undo.

## Still needed

- **Admin UI** — no wireframe for this yet. The backend already has `role`
  on every user and separates admin/student at signup/login, so an admin
  dashboard (manage seats/books, view all bookings) can be added without
  backend changes.
- **QR code generation** — the scanner expects a QR containing the seat ID
  string (e.g. `A1`). Generate and print these once seats are finalized.
