import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import api from '../api'

export default function Scanner({ user }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [manualCode, setManualCode] = useState('')
  const [status, setStatus] = useState('')
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
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
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const checkIn = async (seatCode) => {
    setStatus('Verifying...')
    try {
      const res = await api.post('/seats/checkin', {
        user_id: user.id,
        seat_code: seatCode,
        date: new Date().toISOString().slice(0, 10)
      })
      setStatus(`Checked in at seat ${res.data.booking.seat_id}!`)
    } catch (err) {
      setStatus(err.response?.data?.error || 'Check-in failed')
    }
  }

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
