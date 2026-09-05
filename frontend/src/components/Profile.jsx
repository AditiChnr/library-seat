import { useEffect, useState } from 'react'
import api from '../api'
import StudentIDCard from './StudentIDCard'

export default function Profile({ user, onLogout }) {
  const [profile, setProfile] = useState(user)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get(`/profile/${user.id}`).then(r => setProfile(r.data)).catch(() => {})
  }, [user.id])

  const field = (key, label) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>{label}</div>
      <input
        className="input-field"
        value={profile[key] || ''}
        onChange={e => setProfile({ ...profile, [key]: e.target.value })}
      />
    </div>
  )

  const save = async () => {
    await api.post(`/profile/${user.id}`, {
      name: profile.name,
      semester: profile.semester,
      branch: profile.branch,
      phone: profile.phone,
      email: profile.email,
      unique_id: profile.unique_id
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const displayName = profile.name || profile.username

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 20, fontSize: 20 }}>Profile</h2>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <StudentIDCard
          photoUrl={
            profile.photo_url ||
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=773344&textColor=F5E9E2`
          }
          name={displayName}
          semester={profile.semester ? `Semester ${profile.semester}` : 'Semester'}
          branch={profile.branch || 'Branch'}
          uniqueId={profile.unique_id || 'Unique ID'}
        />
      </div>


      <button
        className="btn-secondary"
        style={{ width: '100%', marginTop: 20 }}
        onClick={() => setEditing(e => !e)}
      >
        {editing ? 'Close' : 'Edit profile'}
      </button>

      {editing && (
        <div className="card" style={{ marginTop: 12 }}>
          {field('name', 'Name')}
          {field('semester', 'Semester')}
          {field('branch', 'Branch')}
          {field('unique_id', 'College Unique ID')}
          {field('phone', 'Phone')}
          {field('email', 'Email')}

          <button className="btn-primary" style={{ width: '100%', marginTop: 4 }} onClick={save}>
            {saved ? 'Saved!' : 'Save changes'}
          </button>
        </div>
      )}

      <button className="btn-secondary" style={{ width: '100%', marginTop: 16 }} onClick={onLogout}>
        Sign out
      </button>
    </div>
  )
}
