import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getInterviewHistory } from '../services/api'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'

export default function Dashboard() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState({
    interviews: '—',
    avgScore: '—',
    practiceHours: '—'
  })

  useEffect(() => {
    async function loadStats() {
      const { data, error } = await getInterviewHistory(token)
      if (error || !data?.data) return

      const history = data.data
      const totalInterviews = history.length
      
      let scoredCount = 0
      let totalScore = 0
      let totalMinutes = 0

      history.forEach(iv => {
        // Calculate duration based on scheduled duration for completed/in-progress
        // Alternatively, use duration of all created interviews. Let's use it for all.
        if (iv.duration) {
          totalMinutes += iv.duration
        }

        if (iv.overallScore && iv.overallScore !== 'insufficient_evidence') {
          totalScore += Number(iv.overallScore)
          scoredCount++
        }
      })

      const avgScore = scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : 'N/A'
      const practiceHours = totalMinutes > 0 ? (totalMinutes / 60).toFixed(1) : 0

      setStats({
        interviews: totalInterviews,
        avgScore,
        practiceHours
      })
    }
    loadStats()
  }, [token])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const displayName = user?.name || user?.email || 'there'

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-base font-semibold tracking-tight text-foreground">
            AI Interviewer
          </span>

          <nav className="flex items-center gap-1">
            <Button
              id="nav-dashboard"
              variant="ghost"
              size="sm"
              className="text-sm text-foreground"
              onClick={() => navigate('/dashboard')}
            >
              Dashboard
            </Button>

            <Button
              id="nav-history"
              variant="ghost"
              size="sm"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/history')}
            >
              History
            </Button>

            <Button
              id="nav-profile"
              variant="ghost"
              size="sm"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/profile')}
            >
              Profile
            </Button>

            <div className="ml-2 h-4 w-px bg-border" />

            <Button
              id="nav-logout"
              variant="ghost"
              size="sm"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={handleLogout}
            >
              Logout
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg text-center space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground uppercase tracking-widest font-medium">
              Dashboard
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
              Welcome, {displayName}
            </h1>
          </div>

          <p className="text-muted-foreground text-base max-w-sm mx-auto leading-relaxed">
            Practice technical interviews with an adaptive AI interviewer.
          </p>

          <div className="pt-2">
            <Button
              id="start-interview"
              size="lg"
              className="px-8"
              onClick={() => navigate('/interview/create')}
            >
              Start New Interview
            </Button>
          </div>

          {/* Stats placeholder cards */}
          <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-3">
            {[
              { label: 'Interviews', value: stats.interviews },
              { label: 'Avg. Score', value: stats.avgScore },
              { label: 'Practice Hours', value: stats.practiceHours },
            ].map((stat) => (
              <Card key={stat.label} className="text-center py-4 px-3">
                <CardContent className="p-0">
                  <p className="text-xl font-semibold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
