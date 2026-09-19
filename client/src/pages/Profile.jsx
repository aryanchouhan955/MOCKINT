import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getInterviewHistory } from '../services/api'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { ThemeToggle } from '../components/ThemeToggle'
import '../styles/Profile.css'

export default function Profile() {
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

  const displayName = user?.name || user?.email || 'User'

  return (
    <div className="prof-container">
      <header className="prof-header">
        <div className="prof-header-inner">
          <h1 className="prof-title">Profile</h1>
          <div className="prof-header-actions">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              Dashboard
            </Button>
            <Button size="sm" onClick={() => navigate('/history')}>
              View History
            </Button>
          </div>
        </div>
      </header>

      <main className="prof-main">
        {/* User Info */}
        <Card className="prof-user-card">
          <CardHeader>
            <CardTitle className="prof-card-title">User Information</CardTitle>
          </CardHeader>
          <CardContent className="prof-info-content">
            <div>
              <p className="prof-info-label">Name</p>
              <p className="prof-info-val">{displayName}</p>
            </div>
            <div>
              <p className="prof-info-label">Email</p>
              <p className="prof-info-val">{user?.email}</p>
            </div>
            
            <div className="prof-actions">
              <Button variant="destructive" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <section>
          <h2 className="prof-section-title">Your Progress</h2>
          <div className="prof-stats-grid">
            <Card className="prof-stat-card">
              <CardContent className="prof-stat-content">
                <p className="prof-stat-val">{stats.interviews}</p>
                <p className="prof-stat-label">Interviews</p>
              </CardContent>
            </Card>
            <Card className="prof-stat-card">
              <CardContent className="prof-stat-content">
                <p className="prof-stat-val">{stats.avgScore}</p>
                <p className="prof-stat-label">Avg. Score</p>
              </CardContent>
            </Card>
            <Card className="prof-stat-card">
              <CardContent className="prof-stat-content">
                <p className="prof-stat-val">{stats.practiceHours}</p>
                <p className="prof-stat-label">Practice Hours</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  )
}
