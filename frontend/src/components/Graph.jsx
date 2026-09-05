import { useEffect, useState } from 'react'
import api from '../api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts'

export default function Graph({ user }) {
  const [days, setDays] = useState(7)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get('/sessions/graph', { params: { user_id: user.id, days } })
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days, user.id])

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.fill, fontSize: 13 }}>
            {p.name}: {Number(p.value).toFixed(2)}h
          </p>
        ))}
      </div>
    )
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    if (parts.length < 3) return dateStr
    return `${parts[1]}/${parts[2]}`
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[7, 14, 30].map(r => (
          <button key={r} onClick={() => setDays(r)} style={{
            padding: '6px 18px', borderRadius: 6,
            border: `1px solid ${days === r ? 'var(--accent)' : 'var(--border)'}`,
            background: days === r ? 'rgba(212,77,92,0.15)' : 'transparent',
            color: days === r ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: 'pointer', fontSize: 13
          }}>Last {r} days</button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Loading...</div>
        ) : data.every(d => !d.study && !d.sleep && !d.inactive) ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 20 }} barCategoryGap="20%">
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                tickFormatter={formatDate} angle={-45} textAnchor="end"
                interval={days > 14 ? 2 : 0} height={50} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => `${v}h`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)', paddingTop: 8 }} />
              <Bar dataKey="study" name="Study" stackId="a" fill="#4CAF50" />
              <Bar dataKey="sleep" name="Sleep" stackId="a" fill="#E0A828" />
              <Bar dataKey="inactive" name="Away" stackId="a" fill="#e74c3c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
