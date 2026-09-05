import { useEffect, useState, Fragment } from 'react'
import api from '../api'

export default function BookAvailability() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  const search = (q) => {
    api.get('/books/search', { params: { q } })
      .then(r => setResults(r.data))
      .catch(() => {})
  }

  useEffect(() => { search('') }, [])

  return (
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 16, fontSize: 20 }}>Book Availability</h2>

      <div className="card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            className="input-field"
            placeholder="Book title"
            value={query}
            onChange={e => { setQuery(e.target.value); search(e.target.value) }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px 0', fontSize: 13 }}>
          <div style={{ color: 'var(--text-secondary)', fontWeight: 600, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>Name</div>
          <div style={{ color: 'var(--text-secondary)', fontWeight: 600, paddingBottom: 6, borderBottom: '1px solid var(--border)', textAlign: 'right' }}>Copies left</div>

          {results.length === 0 && (
            <div style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
              No books found
            </div>
          )}

          {results.map(b => (
            <Fragment key={b.title}>
              <div style={{ padding: '8px 0' }}>{b.title}</div>
              <div style={{
                padding: '8px 0', textAlign: 'right',
                color: b.copies_left > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700
              }}>
                {b.copies_left}
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
