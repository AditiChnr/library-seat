import { useState } from 'react'
import api from '../api'

export default function Login({ onLoggedIn, onSwitchToSignUp }) {
  const [role, setRole] = useState('student')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!username || !password) { setError('Please enter username and password'); return }
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { role, username, password })
      onLoggedIn(res.data.user)
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="card" style={{ width: 380, padding: '36px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>Log In</div>
        </div>

        <div className="role-toggle" style={{ marginBottom: 16 }}>
          <button className={role === 'admin' ? 'active' : ''} onClick={() => setRole('admin')}>Admin</button>
          <button className={role === 'student' ? 'active' : ''} onClick={() => setRole('student')}>Student</button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>Username</div>
          <input
            className="input-field"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>Password</div>
          <input
            className="input-field"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {error && (
          <div style={{
            background: 'rgba(231,76,60,0.12)', border: '1px solid var(--danger)',
            color: 'var(--danger)', borderRadius: 8, padding: '10px 14px',
            fontSize: 13, marginBottom: 16
          }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onSwitchToSignUp}>
            Sign Up
          </button>
          <button className="btn-primary" style={{ flex: 1 }} disabled={loading} onClick={handleSubmit}>
            {loading ? 'Signing in...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
