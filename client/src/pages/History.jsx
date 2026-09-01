import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getInterviewHistory } from '../services/api'
import { Button } from '../components/ui/button'

function DifficultyBadge({ difficulty }) {
  const colors = {
    easy: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    hard: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
  }
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium capitalize ${colors[difficulty] || 'text-muted-foreground border-border'}`}>
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
    <span className={`text-sm capitalize font-medium ${colors[status] || 'text-muted-foreground'}`}>
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
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading history…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-foreground font-medium">Unable to load history</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground pb-20">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Interview History</h1>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              Dashboard
            </Button>
            <Button size="sm" onClick={() => navigate('/interview/create')}>
              New Interview
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 mt-8 space-y-6">
        {interviews.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg bg-card">
            <h2 className="text-lg font-medium text-foreground mb-2">No interviews yet.</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Start your first AI interview<br />
              to see your results here.
            </p>
            <Button onClick={() => navigate('/interview/create')}>Start Interview</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {interviews.map((iv) => {
              const score = iv.overallScore
              const displayScore = score === 'insufficient_evidence' || score == null ? 'N/A' : `${score}/10`
              const date = new Date(iv.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
              
              return (
                <div key={iv.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-lg border border-border bg-card hover:bg-muted/5 transition-colors gap-4">
                  <div className="space-y-1.5">
                    <h3 className="text-base font-medium text-foreground truncate max-w-sm">{iv.role}</h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <DifficultyBadge difficulty={iv.difficulty} />
                      <span>·</span>
                      <StatusBadge status={iv.status} />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-1/2">
                    <div className="flex flex-col sm:items-end gap-1">
                      <span className="text-sm font-medium text-foreground">Score: {displayScore}</span>
                      <span className="text-xs text-muted-foreground">{date}</span>
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
