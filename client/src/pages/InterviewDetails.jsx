import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getInterview } from '../services/api'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'

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
    <div className="flex flex-col items-center justify-center p-4 rounded-lg border border-border bg-card shadow-sm">
      <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 mb-2 ${color}`}>
        <span className="text-lg font-bold">{displayScore}</span>
      </div>
      <span className="text-xs text-center text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
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
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium capitalize ${colors[difficulty] || 'text-muted-foreground border-border'}`}>
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
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading details…</p>
        </div>
      </div>
    )
  }

  if (error || !interview) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-foreground font-medium">Unable to load details</p>
          <p className="text-sm text-muted-foreground">{error || 'Interview not found'}</p>
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
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground pb-20">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight truncate max-w-[200px] sm:max-w-md">{role}</h1>
            <p className="text-sm text-muted-foreground">{date}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/history')}>
              Back
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 mt-8 space-y-8">
        
        {/* Info Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</div>
            <div className="font-medium capitalize">{status.replace('_', ' ')}</div>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Difficulty</div>
            <div className="mt-0.5"><DifficultyBadge difficulty={difficulty} /></div>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Duration</div>
            <div className="font-medium">{duration} min</div>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Questions</div>
            <div className="font-medium">{questionsAsked} / {questionCount}</div>
          </div>
        </div>

        {/* Conversation */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Conversation History</h2>
          <div className="space-y-6">
            {conversation?.length > 0 ? (
              conversation.map((msg, i) => (
                <div key={i} className={`p-4 rounded-lg border ${msg.role === 'interviewer' ? 'border-primary/20 bg-primary/5' : 'border-border bg-card'}`}>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className={msg.role === 'interviewer' ? 'text-primary' : 'text-muted-foreground'}>
                      {msg.role === 'interviewer' ? 'Interviewer' : 'You'}
                    </span>
                    {msg.role === 'interviewer' && msg.topic && (
                      <span className="text-muted-foreground/60">{msg.topic}</span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic">No conversation recorded.</p>
            )}
          </div>
        </section>

        {/* Feedback Section */}
        {feedback && (
          <section className="pt-8 border-t border-border mt-12 space-y-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold tracking-tight">Interview Feedback</h2>
              <p className="text-sm text-muted-foreground mt-1">Generated by AI after the interview ended.</p>
            </div>

            {status === 'cancelled' && (
              <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 flex flex-col gap-1">
                <h3 className="font-semibold">Interview Cancelled</h3>
                <p className="text-sm opacity-90">This interview was cancelled early. The feedback below is based on limited evidence.</p>
              </div>
            )}

            {/* Overall & Summary */}
            <Card>
              <CardHeader className="border-b border-border bg-muted/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl">Overall Assessment</CardTitle>
                    <CardDescription className="mt-1.5 text-base">{feedback.overall?.comment}</CardDescription>
                  </div>
                  <div className="shrink-0 text-center bg-card border border-border p-3 rounded-lg shadow-sm">
                    <div className="text-3xl font-bold">{feedback.overall?.score !== 'insufficient_evidence' ? feedback.overall?.score : 'N/A'}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Score</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-foreground leading-relaxed">{feedback.summary}</p>
              </CardContent>
            </Card>

            {/* Category Scores */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Categories</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <ScoreCircle score={feedback.technicalAbility?.score} label="Technical" />
                <ScoreCircle score={feedback.projectKnowledge?.score} label="Project" />
                <ScoreCircle score={feedback.dsa?.score} label="DSA" />
                <ScoreCircle score={feedback.csFundamentals?.score} label="CS Fund." />
                <ScoreCircle score={feedback.behavioral?.score} label="Behavioral" />
                <ScoreCircle score={feedback.communication?.score} label="Comm." />
              </div>
            </div>

            {/* Detailed Lists */}
            <div className="grid sm:grid-cols-2 gap-6">
              <Card className="bg-emerald-500/5 border-emerald-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-emerald-500 flex items-center gap-2">
                    <span className="text-lg">✓</span> Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {feedback.strengths?.length > 0 ? (
                      feedback.strengths.map((str, i) => <li key={i} className="pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-emerald-500">{str}</li>)
                    ) : (
                      <li className="text-muted-foreground italic">No strengths identified based on this evidence.</li>
                    )}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-rose-500/5 border-rose-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-rose-500 flex items-center gap-2">
                    <span className="text-lg">△</span> Areas to Improve
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {feedback.weaknesses?.length > 0 ? (
                      feedback.weaknesses.map((weak, i) => <li key={i} className="pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-rose-500">{weak}</li>)
                    ) : (
                      <li className="text-muted-foreground italic">No weaknesses identified based on this evidence.</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Suggestions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-amber-500 flex items-center gap-2">
                  <span className="text-lg">★</span> Actionable Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  {feedback.suggestions?.length > 0 ? (
                    feedback.suggestions.map((sug, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="shrink-0 text-amber-500/70">{i + 1}.</span>
                        <span className="leading-relaxed">{sug}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-muted-foreground italic">No specific suggestions provided.</li>
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
