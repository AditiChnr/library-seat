import { useEffect, useState } from 'react'
import SignUp from './components/SignUp'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import BookSeat from './components/BookSeat'
import Scanner from './components/Scanner'
import PomodoroSettings from './components/PomodoroSettings'
import StudyTracker from './components/StudyTracker'
import BookAvailability from './components/BookAvailability'
import Profile from './components/Profile'

const PAGE_LABEL = {
  book: 'Book your Seat',
  scanner: 'Scanner',
  pomodoro: 'Pomodoro Settings',
  tracker: 'Study Tracker',
  books: 'Book Availability',
  profile: 'Profile',
}

export default function App() {
  const [authMode, setAuthMode] = useState('login') // 'login' | 'signup'
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('book')
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('ls_user')
    if (saved) setUser(JSON.parse(saved))
  }, [])

  const handleAuthed = (u) => {
    localStorage.setItem('ls_user', JSON.stringify(u))
    setUser(u)
  }

  const handleLogout = () => {
    localStorage.removeItem('ls_user')
    setUser(null)
  }

  if (!user) {
    return authMode === 'login'
      ? <Login onLoggedIn={handleAuthed} onSwitchToSignUp={() => setAuthMode('signup')} />
      : <SignUp onSignedUp={handleAuthed} onSwitchToLogin={() => setAuthMode('login')} />
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="top-bar">
        <button className="hamburger-btn" onClick={() => setDrawerOpen(true)}>&#9776;</button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{PAGE_LABEL[page]}</span>
      </div>

      <Sidebar
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        page={page}
        onNavigate={setPage}
        user={user}
      />

      <div style={{ padding: 20 }}>
        {page === 'book'     && <BookSeat user={user} />}
        {page === 'scanner'  && <Scanner user={user} />}
        {page === 'pomodoro' && <PomodoroSettings user={user} />}
        {page === 'tracker'  && <StudyTracker user={user} />}
        {page === 'books'    && <BookAvailability />}
        {page === 'profile'  && <Profile user={user} onLogout={handleLogout} />}
      </div>
    </div>
  )
}
