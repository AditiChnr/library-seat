import { useEffect, useState } from 'react'
import api from '../api'

const ROWS = [1, 2, 3, 4, 5]
const COLS = ['A', 'B', 'C']

export default function BookSeat({ user }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [fromTime, setFromTime] = useState('09:00')
  const [toTime, setToTime] = useState('11:00')
  const timeSlot = `${fromTime}-${toTime}`
  const [grid, setGrid] = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const checkAvailability = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await api.get('/seats/grid', { params: { date, time_slot: timeSlot } })
      setGrid(res.data)
    } catch {
      setMessage('Could not load seat grid')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { checkAvailability() }, [])

  // Live refresh every 10s so occupied/available reflects real camera data
  useEffect(() => {
    const t = setInterval(checkAvailability, 10000)
    return () => clearInterval(t)
  }, [date, fromTime, toTime])

  const statusFor = (seatId) => grid?.find(s => s.seat_id === seatId)?.status || 'available'

  const bookSeat = async (seatId) => {
    if (statusFor(seatId) !== 'available') return
    if (toTime <= fromTime) { setMessage('End time must be after start time'); return }
    setMessage('')
    try {
      await api.post('/seats/book', { user_id: user.id, seat_id: seatId, date, time_slot: timeSlot })
      setMessage(`Booked seat ${seatId}. Scan or enter this code at the seat to check in.`)
      setSelected(seatId)
      checkAvailability()
    } catch (err) {
      setMessage(err.response?.data?.error || 'Booking failed')
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 16, fontSize: 20 }}>Book your Seat</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>Date</div>
          <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>From</div>
            <input type="time" className="input-field" value={fromTime} onChange={e => setFromTime(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>To</div>
            <input type="time" className="input-field" value={toTime} onChange={e => setToTime(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary" style={{ width: '100%' }} onClick={checkAvailability} disabled={loading}>
          {loading ? 'Checking...' : 'Check Availability'}
        </button>
      </div>

      {message && (
        <div className="alert-banner">{message}</div>
      )}

      <div className="card">
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 16 }}>
          {COLS.map(col => (
            <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ROWS.map(row => {
                const seatId = `${col}${row}`
                const status = statusFor(seatId)
                return (
                  <div
                    key={seatId}
                    className={`seat seat-${status} ${selected === seatId ? 'seat-selected' : ''}`}
                    onClick={() => bookSeat(seatId)}
                    title={`${seatId} — ${status}`}
                  >
                    {seatId}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)', justifyContent: 'center' }}>
          <Legend colorClass="seat-available" label="Available" />
          <Legend colorClass="seat-reserved" label="Reserved" />
          <Legend colorClass="seat-occupied" label="Occupied" />
        </div>
      </div>
    </div>
  )
}

function Legend({ colorClass, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span className={colorClass} style={{ width: 14, height: 14, borderRadius: 4, display: 'inline-block' }} />
      {label}
    </span>
  )
}
