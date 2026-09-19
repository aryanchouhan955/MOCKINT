import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getInterview } from '../services/api'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { ThemeToggle } from '../components/ThemeToggle'
import '../styles/InterviewDetails.css'

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
    <div className="id-score-circle">
      <div className={`id-score-circle-inner ${color}`}>
        <span className="id-score-circle-val">{displayScore}</span>
      </div>
      <span className="id-score-circle-label">{label}</span>
    </div>
  )
}

function DifficultyBadge({ difficulty }) {
  const colors = {
    easy: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    hard: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
  }
  return (
    <span className={`id-badge-common ${colors[difficulty] || 'text-muted-foreground border-border'}`}>
      {difficulty}
    </span>
  )
}

export default function InterviewDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [interview, setInterview] = useState(null)

  useEffect(() => {
    async function fetchInterview() {
      const { data, error } = await getInterview(id, token)
      if (error) {
        setError(error)
      } else {
        setInterview(data.data)
      }
      setLoading(false)
    }
    fetchInterview()
  }, [id, token])

  if (loading) {
    return (
      <div className="id-loading-container">
        <div className="id-loading-content">
          <div className="id-loading-spinner" />
          <p className="id-loading-text">Loading details…</p>
        </div>
      </div>
    )
  }

  if (error || !interview) {
    return (
      <div className="id-error-container">
        <div className="id-error-content">
          <p className="id-error-title">Unable to load details</p>
          <p className="id-error-text">{error || 'Interview not found'}</p>
          <Button onClick={() => navigate('/history')} variant="outline" size="sm">
            Back to History
          </Button>
        </div>
      </div>
    )
  }

  const { role, difficulty, duration, questionCount, questionsAsked, status, createdAt, conversation, feedback } = interview
  const date = new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="id-container">
      {/* Header */}
      <header className="id-header">
        <div className="id-header-inner">
          <div>
            <h1 className="id-title">{role}</h1>
            <p className="id-subtitle">{date}</p>
          </div>
          <div className="id-header-actions">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={() => navigate('/history')}>
              Back
            </Button>
          </div>
        </div>
      </header>

      <main className="id-main">
        
        {/* Info Cards */}
        <div className="id-info-grid">
          <div className="id-info-card">
            <div className="id-info-label">Status</div>
            <div className="id-info-val-capitalize">{status.replace('_', ' ')}</div>
          </div>
          <div className="id-info-card">
            <div className="id-info-label">Difficulty</div>
            <div className="id-info-val-badge"><DifficultyBadge difficulty={difficulty} /></div>
          </div>
          <div className="id-info-card">
            <div className="id-info-label">Duration</div>
            <div className="id-info-val">{duration} min</div>
          </div>
          <div className="id-info-card">
            <div className="id-info-label">Questions</div>
            <div className="id-info-val">{questionsAsked} / {questionCount}</div>
          </div>
        </div>

        {/* Conversation */}
        <section>
          <h2 className="id-section-title">Conversation History</h2>
          <div className="id-conv-list">
            {conversation?.length > 0 ? (
              conversation.map((msg, i) => (
                <div key={i} className={msg.role === 'interviewer' ? 'id-msg-interviewer' : 'id-msg-user'}>
                  <div className="id-msg-header">
                    <span className={msg.role === 'interviewer' ? 'id-msg-role-interviewer' : 'id-msg-role-user'}>
                      {msg.role === 'interviewer' ? 'Interviewer' : 'You'}
                    </span>
                    {msg.role === 'interviewer' && msg.topic && (
                      <span className="id-msg-topic">{msg.topic}</span>
                    )}
                  </div>
                  <p className="id-msg-text">{msg.text}</p>
                </div>
              ))
            ) : (
              <p className="id-conv-empty">No conversation recorded.</p>
            )}
          </div>
        </section>

        {/* Feedback Section */}
        {feedback && (
          <section className="id-feedback-section">
            <div className="id-feedback-header-group">
              <h2 className="id-feedback-title">Interview Feedback</h2>
              <p className="id-feedback-subtitle">Generated by AI after the interview ended.</p>
            </div>

            {status === 'cancelled' && (
              <div className="id-cancelled-banner">
                <h3 className="id-cancelled-title">Interview Cancelled</h3>
                <p className="id-cancelled-text">This interview was cancelled early. The feedback below is based on limited evidence.</p>
              </div>
            )}

            {/* Overall & Summary */}
            <Card>
              <CardHeader className="id-overall-header">
                <div className="id-overall-layout">
                  <div>
                    <CardTitle className="id-overall-title">Overall Assessment</CardTitle>
                    <CardDescription className="id-overall-desc">{feedback.overall?.comment}</CardDescription>
                  </div>
                  <div className="id-score-box">
                    <div className="id-score-val">{feedback.overall?.score !== 'insufficient_evidence' ? feedback.overall?.score : 'N/A'}</div>
                    <div className="id-score-label">Score</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="id-summary-content">
                <p className="id-summary-text">{feedback.summary}</p>
              </CardContent>
            </Card>

            {/* Category Scores */}
            <div>
              <h3 className="id-categories-title">Categories</h3>
              <div className="id-categories-grid">
                <ScoreCircle score={feedback.technicalAbility?.score} label="Technical" />
                <ScoreCircle score={feedback.projectKnowledge?.score} label="Project" />
                <ScoreCircle score={feedback.dsa?.score} label="DSA" />
                <ScoreCircle score={feedback.csFundamentals?.score} label="CS Fund." />
                <ScoreCircle score={feedback.behavioral?.score} label="Behavioral" />
                <ScoreCircle score={feedback.communication?.score} label="Comm." />
              </div>
            </div>

            {/* Detailed Lists */}
            <div className="id-lists-grid">
              <Card className="id-card-strengths">
                <CardHeader className="pb-3">
                  <CardTitle className="id-list-title-strengths">
                    <span className="id-list-title-icon">✓</span> Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="id-list">
                    {feedback.strengths?.length > 0 ? (
                      feedback.strengths.map((str, i) => <li key={i} className="id-list-item-strength">{str}</li>)
                    ) : (
                      <li className="id-list-empty">No strengths identified based on this evidence.</li>
                    )}
                  </ul>
                </CardContent>
              </Card>

              <Card className="id-card-weaknesses">
                <CardHeader className="pb-3">
                  <CardTitle className="id-list-title-weaknesses">
                    <span className="id-list-title-icon">△</span> Areas to Improve
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="id-list">
                    {feedback.weaknesses?.length > 0 ? (
                      feedback.weaknesses.map((weak, i) => <li key={i} className="id-list-item-weakness">{weak}</li>)
                    ) : (
                      <li className="id-list-empty">No weaknesses identified based on this evidence.</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Suggestions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="id-card-suggestions-title">
                  <span className="id-list-title-icon">★</span> Actionable Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="id-suggestions-list">
                  {feedback.suggestions?.length > 0 ? (
                    feedback.suggestions.map((sug, i) => (
                      <li key={i} className="id-suggestion-item">
                        <span className="id-suggestion-num">{i + 1}.</span>
                        <span className="id-suggestion-text">{sug}</span>
                      </li>
                    ))
                  ) : (
                    <li className="id-list-empty">No specific suggestions provided.</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </section>
        )}

      </main>
    </div>
  )
}
