import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getInterviewHistory } from '../services/api'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { ThemeToggle } from '../components/ThemeToggle'
import '../styles/Dashboard.css'

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
    <div className="dashboard-container">
      {/* Top Navigation */}
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <span className="dashboard-logo">
            MOCKINT
          </span>

          <nav className="dashboard-nav">
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

            <div className="dashboard-nav-divider" />
            <ThemeToggle />

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
      <main className="dashboard-main">
        <div className="dashboard-content">
          <div className="dashboard-title-group">
            <p className="dashboard-subtitle">
              Dashboard
            </p>
            <h1 className="dashboard-title">
              Welcome, {displayName}
            </h1>
          </div>

          <p className="dashboard-description">
            Practice technical interviews with an adaptive AI interviewer.
          </p>

          <div className="dashboard-action">
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
          <div className="dashboard-stats-grid">
            {[
              { label: 'Interviews', value: stats.interviews },
              { label: 'Avg. Score', value: stats.avgScore },
              { label: 'Practice Hours', value: stats.practiceHours },
            ].map((stat) => (
              <Card key={stat.label} className="dashboard-stat-card">
                <CardContent className="dashboard-stat-content">
                  <p className="dashboard-stat-value">{stat.value}</p>
                  <p className="dashboard-stat-label">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
