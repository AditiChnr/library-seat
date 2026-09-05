import { useEffect, useState } from 'react'
import api from '../api'

export default function PomodoroSettings({ user }) {
  const [workMins, setWorkMins] = useState(25)
  const [breakMins, setBreakMins] = useState(5)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get('/pomodoro/get', { params: { user_id: user.id } })
      .then(r => { setWorkMins(r.data.work_mins); setBreakMins(r.data.break_mins) })
      .catch(() => {})
  }, [user.id])

  const save = async () => {
    await api.post('/pomodoro/set', { user_id: user.id, work_mins: workMins, break_mins: breakMins })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 20, fontSize: 20 }}>Pomodoro Settings</h2>

      <div className="card">
        <TimeField label="Study time (minutes)" value={workMins} onChange={setWorkMins} min={5} max={120} />
        <TimeField label="Break time (minutes)" value={breakMins} onChange={setBreakMins} min={1} max={60} />

        <button className="btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={save}>
          {saved ? 'Saved!' : 'Set!'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
        Your seat's Pi will pick up the new timings automatically within ~10 seconds.
      </div>
    </div>
  )
}

function TimeField({ label, value, onChange, min, max }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn-secondary" style={{ padding: '6px 12px' }}
          onClick={() => onChange(Math.max(min, value - 5))}>-5</button>
        <input
          type="number"
          className="input-field"
          value={value}
          min={min}
          max={max}
          onChange={e => {
            const n = parseInt(e.target.value)
            if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
          }}
          style={{ textAlign: 'center', fontSize: 18, fontWeight: 700 }}
        />
        <button className="btn-secondary" style={{ padding: '6px 12px' }}
          onClick={() => onChange(Math.min(max, value + 5))}>+5</button>
      </div>
    </div>
  )
}
