import { useState } from 'react'
import api from '../api'

export default function SignUp({ onSignedUp, onSwitchToLogin }) {
  const [role, setRole] = useState('student')
  const [code, setCode] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // Student details — collected up front so the profile card is filled in
  // from the moment the account is created.
  const [name, setName] = useState('')
  const [semester, setSemester] = useState('')
  const [branch, setBranch] = useState('')
  const [uniqueId, setUniqueId] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!username || !password || !code) {
      setError('Code, username and password are required')
      return
    }
    if (role === 'student' && (!name || !uniqueId)) {
      setError('Name and college unique ID are required')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/signup', {
        role, code, username, password, phone, email,
        name,
        semester,
        branch,
        unique_id: uniqueId
      })
      onSignedUp(res.data.user)
    } catch (err) {
      setError(err.response?.data?.error || 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 16px'
    }}>
      <div className="card" style={{ width: 400, padding: '36px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>Sign Up</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Who are you?
          </div>
        </div>

        <div className="role-toggle" style={{ marginBottom: 16 }}>
          <button className={role === 'admin' ? 'active' : ''} onClick={() => setRole('admin')}>Admin</button>
          <button className={role === 'student' ? 'active' : ''} onClick={() => setRole('student')}>Student</button>
        </div>

        <Field label="Code" value={code} onChange={setCode} placeholder="Invite code for your role" />
        <Field label="Username" value={username} onChange={setUsername} />
        <Field label="Password" value={password} onChange={setPassword} type="password" />

        {role === 'student' && (
          <>
            <Divider label="Student details" />
            <Field label="Full name" value={name} onChange={setName} placeholder="As on your college ID" />
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Field label="Semester" value={semester} onChange={setSemester} placeholder="e.g. 3" />
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Branch" value={branch} onChange={setBranch} placeholder="e.g. CSE" />
              </div>
            </div>
            <Field label="College unique ID" value={uniqueId} onChange={setUniqueId} placeholder="e.g. 2GI25CS009" />
            <Divider label="Contact" />
          </>
        )}

        <Field label="Phone no." value={phone} onChange={setPhone} placeholder="For password reset" />
        <Field label="Email" value={email} onChange={setEmail} placeholder="For account recovery" />

        {error && (
          <div style={{
            background: 'rgba(168,56,61,0.14)', border: '1px solid var(--danger)',
            color: 'var(--danger)', borderRadius: 8, padding: '10px 14px',
            fontSize: 13, marginBottom: 16
          }}>{error}</div>
        )}

        <button className="btn-primary" style={{ width: '100%' }} disabled={loading} onClick={handleSubmit}>
          {loading ? 'Signing up...' : 'Sign Up!'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={onSwitchToLogin}>
            Log in
          </span>
        </div>
      </div>
    </div>
  )
}

function Divider({ label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      margin: '18px 0 12px', fontSize: 11, letterSpacing: 0.6,
      textTransform: 'uppercase', color: 'var(--text-muted)'
    }}>
      <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      {label}
      <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>{label}</div>
      <input
        className="input-field"
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}
