import { useEffect, useState } from 'react'
import api from '../api'
import Graph from './Graph'

function fmt(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}h ${m}m`
}

export default function StudyTracker({ user }) {
  const [today, setToday] = useState({ study: 0, sleep: 0, inactive: 0 })

  const load = () => {
    api.get('/sessions/today', { params: { user_id: user.id } })
      .then(r => setToday(r.data))
      .catch(() => {})
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [user.id])

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 16, fontSize: 20 }}>Study Tracker</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--success)', marginBottom: 4 }}>STUDY HOURS TODAY</div>
          <div className="timer-display" style={{ color: 'var(--success)', fontSize: 22 }}>{fmt(today.study)}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--warning)', marginBottom: 4 }}>BREAK HOURS TODAY</div>
          <div className="timer-display" style={{ color: 'var(--warning)', fontSize: 22 }}>{fmt(today.inactive)}</div>
        </div>
      </div>

      <Graph user={user} />
    </div>
  )
}
