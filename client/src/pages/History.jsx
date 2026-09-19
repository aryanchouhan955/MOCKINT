import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getInterviewHistory } from '../services/api'
import { Button } from '../components/ui/button'
import { ThemeToggle } from '../components/ThemeToggle'
import '../styles/History.css'

function DifficultyBadge({ difficulty }) {
  const colors = {
    easy: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    hard: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
  }
  return (
    <span className={`hist-badge-common ${colors[difficulty] || 'text-muted-foreground border-border'}`}>
      {difficulty}
    </span>
  )
}

function StatusBadge({ status }) {
  const colors = {
    completed: 'text-emerald-400',
    in_progress: 'text-blue-400',
    cancelled: 'text-muted-foreground',
    created: 'text-muted-foreground',
  }
  
  const formatted = status.replace('_', ' ')
  
  return (
    <span className={`hist-status ${colors[status] || 'text-muted-foreground'}`}>
      {formatted}
    </span>
  )
}

export default function History() {
  const navigate = useNavigate()
  const { token } = useAuth()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [interviews, setInterviews] = useState([])

  useEffect(() => {
    async function fetchHistory() {
      const { data, error } = await getInterviewHistory(token)
      if (error) {
        setError(error)
      } else {
        // Assume API returns { success: true, data: [...] } and backend sorts by date descending
        // If backend doesn't sort, we can sort here, but prompt says "Sort/display according to the backend response. Do not implement client-side sorting unless necessary."
        setInterviews(data.data || [])
      }
      setLoading(false)
    }

    fetchHistory()
  }, [token])

  if (loading) {
    return (
      <div className="hist-loading-container">
        <div className="hist-loading-content">
          <div className="hist-loading-spinner" />
          <p className="hist-loading-text">Loading history…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="hist-error-container">
        <div className="hist-error-content">
          <p className="hist-error-title">Unable to load history</p>
          <p className="hist-error-text">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="hist-container">
      <header className="hist-header">
        <div className="hist-header-inner">
          <h1 className="hist-title">Interview History</h1>
          <div className="hist-header-actions">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              Dashboard
            </Button>
            <Button size="sm" onClick={() => navigate('/interview/create')}>
              New Interview
            </Button>
          </div>
        </div>
      </header>

      <main className="hist-main">
        {interviews.length === 0 ? (
          <div className="hist-empty">
            <h2 className="hist-empty-title">No interviews yet.</h2>
            <p className="hist-empty-text">
              Start your first AI interview<br />
              to see your results here.
            </p>
            <Button onClick={() => navigate('/interview/create')}>Start Interview</Button>
          </div>
        ) : (
          <div className="hist-list">
            {interviews.map((iv) => {
              const score = iv.overallScore
              const displayScore = score === 'insufficient_evidence' || score == null ? 'N/A' : `${score}/10`
              const date = new Date(iv.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
              
              return (
                <div key={iv.id} className="hist-card">
                  <div className="hist-card-left">
                    <h3 className="hist-card-role">{iv.role}</h3>
                    <div className="hist-card-meta">
                      <DifficultyBadge difficulty={iv.difficulty} />
                      <span>·</span>
                      <StatusBadge status={iv.status} />
                    </div>
                  </div>
                  
                  <div className="hist-card-right">
                    <div className="hist-card-score-group">
                      <span className="hist-card-score">Score: {displayScore}</span>
                      <span className="hist-card-date">{date}</span>
                    </div>
                    
                    <Button variant="outline" size="sm" onClick={() => navigate(`/history/${iv.id}`)}>
                      View
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
