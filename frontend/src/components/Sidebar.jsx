const PAGES = [
  { key: 'book',    label: 'Book your Seat' },
  { key: 'scanner', label: 'Scanner' },
  { key: 'pomodoro',label: 'Pomodoro Settings' },
  { key: 'tracker', label: 'Study Tracker' },
  { key: 'books',   label: 'Book Availability' },
  { key: 'profile', label: 'Profile' },
]

export default function Sidebar({ open, onClose, page, onNavigate, user }) {
  if (!open) return null
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div style={{ padding: '0 22px 18px', fontSize: 12, color: 'var(--text-muted)' }}>
          Signed in as <b style={{ color: 'var(--text-secondary)' }}>{user?.username}</b>
        </div>
        {PAGES.map(p => (
          <div
            key={p.key}
            className={`drawer-item ${page === p.key ? 'active' : ''}`}
            onClick={() => { onNavigate(p.key); onClose() }}
          >
            {p.label}
          </div>
        ))}
      </div>
    </>
  )
}
