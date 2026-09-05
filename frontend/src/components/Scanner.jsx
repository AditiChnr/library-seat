import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import api from '../api'

const today = () => new Date().toISOString().slice(0, 10)

export default function Scanner({ user }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [manualCode, setManualCode] = useState('')
  const [status, setStatus] = useState('')
  const [scanning, setScanning] = useState(false)

  // Session state — set once the student successfully checks in.
  const [seatId, setSeatId] = useState(null)
  const [workMins, setWorkMins] = useState(25)
  const [breakMins, setBreakMins] = useState(5)
  const [phase, setPhase] = useState('work')       // 'work' | 'break'
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [running, setRunning] = useState(false)
  const [completed, setCompleted] = useState(0)     // finished work blocks

  // Seconds banked since the last flush to the server.
  const pendingRef = useRef({ study: 0, inactive: 0 })

  const stopCameraRef = useRef(null)

  // ── Camera + QR scanning ────────────────────────────────────────────────

  useEffect(() => {
    if (seatId) return   // already checked in, camera no longer needed

    let stream
    let rafId

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setScanning(true)
        tick()
      } catch {
        setStatus('Camera not available — use the code field below.')
      }
    }

    const tick = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code?.data) {
          checkIn(code.data)
          return
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    start()
    stopCameraRef.current = () => {
      if (rafId) cancelAnimationFrame(rafId)
      stream?.getTracks().forEach(t => t.stop())
      setScanning(false)
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [seatId])

  // ── Check-in ────────────────────────────────────────────────────────────

  const checkIn = async (seatCode) => {
    setStatus('Verifying...')
    try {
      const res = await api.post('/seats/checkin', {
        user_id: user.id,
        seat_code: seatCode,
        date: today()
      })
      const seat = res.data.booking.seat_id
      setSeatId(seat)
      setStatus(`Checked in at seat ${seat}.`)
      stopCameraRef.current?.()

      // Pull this student's Pomodoro timings and arm the timer.
      try {
        const p = await api.get('/pomodoro/get', { params: { user_id: user.id } })
        setWorkMins(p.data.work_mins)
        setBreakMins(p.data.break_mins)
        setSecondsLeft(p.data.work_mins * 60)
      } catch {
        setSecondsLeft(25 * 60)
      }
      setPhase('work')
      setRunning(true)
    } catch (err) {
      setStatus(err.response?.data?.error || 'Check-in failed')
    }
  }

  // ── Timer tick ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      if (phase === 'work') pendingRef.current.study += 1
      else pendingRef.current.inactive += 1

      setSecondsLeft(s => {
        if (s > 1) return s - 1
        // Phase finished — swap over.
        if (phase === 'work') {
          setCompleted(c => c + 1)
          setPhase('break')
          return breakMins * 60
        }
        setPhase('work')
        return workMins * 60
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running, phase, workMins, breakMins])

  // ── Flush banked seconds to the server every 30s (and on unmount) ────────

  const flush = async () => {
    const { study, inactive } = pendingRef.current
    if (!study && !inactive) return
    pendingRef.current = { study: 0, inactive: 0 }
    try {
      await api.post('/sessions/append', {
        user_id: user.id,
        date: today(),
        study,
        sleep: 0,
        inactive
      })
    } catch {
      // Put them back so nothing is lost on a transient network error.
      pendingRef.current.study += study
      pendingRef.current.inactive += inactive
    }
  }

  useEffect(() => {
    if (!seatId) return
    const id = setInterval(flush, 30000)
    return () => {
      clearInterval(id)
      flush()
    }
  }, [seatId])

  const fmt = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const endSession = async () => {
    setRunning(false)
    await flush()
    setStatus('Session ended. You can check in again any time.')
    setSeatId(null)
    setCompleted(0)
  }

  // ── Timer view (after check-in) ─────────────────────────────────────────

  if (seatId) {
    const total = (phase === 'work' ? workMins : breakMins) * 60
    const pct = total ? ((total - secondsLeft) / total) * 100 : 0

    return (
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <h2 style={{ marginBottom: 16, fontSize: 20 }}>Study Session</h2>

        <div className="card" style={{ textAlign: 'center', padding: '28px 22px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', letterSpacing: 0.6 }}>
            SEAT {seatId}
          </div>

          <div style={{
            marginTop: 6, fontSize: 13, fontWeight: 700,
            color: phase === 'work' ? 'var(--accent)' : 'var(--text-secondary)',
            textTransform: 'uppercase', letterSpacing: 1
          }}>
            {phase === 'work' ? 'Focus' : 'Break'}
          </div>

          <div style={{
            fontSize: 58, fontWeight: 800, margin: '10px 0 4px',
            color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums'
          }}>
            {fmt(secondsLeft)}
          </div>

          <div style={{
            height: 6, borderRadius: 999, background: 'var(--surface-soft)',
            overflow: 'hidden', margin: '14px 0 18px'
          }}>
            <div style={{
              width: `${pct}%`, height: '100%', background: 'var(--accent)',
              transition: 'width 1s linear'
            }} />
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>
            {completed} focus block{completed === 1 ? '' : 's'} done today
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setRunning(r => !r)}>
              {running ? 'Pause' : 'Resume'}
            </button>
            <button
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() => {
                setPhase(p => (p === 'work' ? 'break' : 'work'))
                setSecondsLeft((phase === 'work' ? breakMins : workMins) * 60)
              }}
            >
              Skip
            </button>
          </div>

          <button className="btn-primary" style={{ width: '100%', marginTop: 10 }} onClick={endSession}>
            End session
          </button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
          Time is saved to your Study Tracker as you go.
        </div>
      </div>
    )
  }

  // ── Scanner view (before check-in) ──────────────────────────────────────

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 16, fontSize: 20 }}>Scanner</h2>

      <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
        <video ref={videoRef} muted playsInline style={{
          width: '100%', borderRadius: 8, background: '#000', display: scanning ? 'block' : 'none'
        }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {!scanning && (
          <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
            Waiting for camera permission...
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>
          Scan to verify your seat
        </div>
      </div>

      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, margin: '12px 0' }}>— or —</div>

      <div className="card">
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
          Enter unique seat code
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input-field"
            value={manualCode}
            onChange={e => setManualCode(e.target.value.toUpperCase())}
            placeholder="e.g. A1"
            onKeyDown={e => e.key === 'Enter' && checkIn(manualCode)}
          />
          <button className="btn-primary" onClick={() => checkIn(manualCode)}>Verify</button>
        </div>
      </div>

      {status && <div className="alert-banner" style={{ marginTop: 16 }}>{status}</div>}
    </div>
  )
}
