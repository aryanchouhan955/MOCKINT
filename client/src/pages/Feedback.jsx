import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getInterview } from '../services/api'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import '../styles/Feedback.css'

function ScoreCircle({ score, label }) {
  const isNa = score === 'insufficient_evidence' || score === null || score === undefined
  const displayScore = isNa ? 'N/A' : score
  
  let color = 'text-muted-foreground border-border'
  if (!isNa) {
    if (score >= 8) color = 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10'
    else if (score >= 6) color = 'text-amber-400 border-amber-400/20 bg-amber-400/10'
    else color = 'text-rose-400 border-rose-400/20 bg-rose-400/10'
  }

  return (
    <div className="fb-score-circle">
      <div className={`fb-score-circle-inner ${color}`}>
        <span className="fb-score-circle-val">{displayScore}</span>
      </div>
      <span className="fb-score-circle-label">{label}</span>
    </div>
  )
}

export default function Feedback() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()
  const location = useLocation()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [interview, setInterview] = useState(null)

  useEffect(() => {
    async function fetchFeedback() {
      // Use state if available (from Complete or Cancel flow) to avoid unnecessary fetch
      if (location.state?.interview?.feedback) {
        setInterview(location.state.interview)
        setLoading(false)
        return
      }

      const { data, error } = await getInterview(id, token)
      if (error) {
        setError(error)
      } else {
        setInterview(data.data)
      }
      setLoading(false)
    }

    fetchFeedback()
  }, [id, token, location.state])

  if (loading) {
    return (
      <div className="fb-loading-container">
        <div className="fb-loading-content">
          <div className="fb-loading-spinner" />
          <p className="fb-loading-text">Loading feedback…</p>
        </div>
      </div>
    )
  }

  if (error || !interview) {
    return (
      <div className="fb-error-container">
        <div className="fb-error-content">
          <p className="fb-error-title">Unable to load feedback</p>
          <p className="fb-error-text">{error || 'Interview not found'}</p>
          <Button onClick={() => navigate('/dashboard')} variant="outline" size="sm">
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const { status, feedback, role, difficulty } = interview
  const isCancelled = status === 'cancelled'

  return (
    <div className="fb-container">
      {/* Header */}
      <header className="fb-header">
        <div className="fb-header-inner">
          <div>
            <h1 className="fb-title">Interview Feedback</h1>
            <p className="fb-subtitle">{role} · {difficulty}</p>
          </div>
          <div className="fb-header-actions">
            <Button variant="outline" size="sm" onClick={() => navigate('/history')}>
              View History
            </Button>
            <Button size="sm" onClick={() => navigate('/dashboard')}>
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="fb-main">
        
        {isCancelled && (
          <div className="fb-cancelled-banner">
            <h3 className="fb-cancelled-title">Interview Cancelled</h3>
            <p className="fb-cancelled-text">This interview was cancelled early. The feedback below is based on limited evidence.</p>
          </div>
        )}

        {!feedback ? (
          <Card className="fb-no-feedback">
            <p className="text-muted-foreground">No feedback was generated for this interview.</p>
          </Card>
        ) : (
          <>
            {/* Overall & Summary */}
            <Card>
              <CardHeader className="fb-overall-header">
                <div className="fb-overall-layout">
                  <div>
                    <CardTitle className="fb-overall-title">Overall Assessment</CardTitle>
                    <CardDescription className="fb-overall-desc">{feedback.overall?.comment}</CardDescription>
                  </div>
                  <div className="fb-score-box">
                    <div className="fb-score-val">{feedback.overall?.score !== 'insufficient_evidence' ? feedback.overall?.score : 'N/A'}</div>
                    <div className="fb-score-label">Score</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="fb-summary-content">
                <p className="fb-summary-text">{feedback.summary}</p>
              </CardContent>
            </Card>

            {/* Category Scores */}
            <div>
              <h2 className="fb-section-title">Categories</h2>
              <div className="fb-categories-grid">
                <ScoreCircle score={feedback.technicalAbility?.score} label="Technical" />
                <ScoreCircle score={feedback.projectKnowledge?.score} label="Project" />
                <ScoreCircle score={feedback.dsa?.score} label="DSA" />
                <ScoreCircle score={feedback.csFundamentals?.score} label="CS Fund." />
                <ScoreCircle score={feedback.behavioral?.score} label="Behavioral" />
                <ScoreCircle score={feedback.communication?.score} label="Comm." />
              </div>
            </div>

            {/* Detailed Lists */}
            <div className="fb-lists-grid">
              <Card className="fb-card-strengths">
                <CardHeader className="pb-3">
                  <CardTitle className="fb-list-title-strengths">
                    <span className="fb-list-title-icon">✓</span> Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="fb-list">
                    {feedback.strengths?.length > 0 ? (
                      feedback.strengths.map((str, i) => <li key={i} className="fb-list-item-strength">{str}</li>)
                    ) : (
                      <li className="fb-list-empty">No strengths identified based on this evidence.</li>
                    )}
                  </ul>
                </CardContent>
              </Card>

              <Card className="fb-card-weaknesses">
                <CardHeader className="pb-3">
                  <CardTitle className="fb-list-title-weaknesses">
                    <span className="fb-list-title-icon">△</span> Areas to Improve
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="fb-list">
                    {feedback.weaknesses?.length > 0 ? (
                      feedback.weaknesses.map((weak, i) => <li key={i} className="fb-list-item-weakness">{weak}</li>)
                    ) : (
                      <li className="fb-list-empty">No weaknesses identified based on this evidence.</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Suggestions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="fb-card-suggestions-title">
                  <span className="fb-list-title-icon">★</span> Actionable Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="fb-suggestions-list">
                  {feedback.suggestions?.length > 0 ? (
                    feedback.suggestions.map((sug, i) => (
                      <li key={i} className="fb-suggestion-item">
                        <span className="fb-suggestion-num">{i + 1}.</span>
                        <span className="fb-suggestion-text">{sug}</span>
                      </li>
                    ))
                  ) : (
                    <li className="fb-list-empty">No specific suggestions provided.</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
