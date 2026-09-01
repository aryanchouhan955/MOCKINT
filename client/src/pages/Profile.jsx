import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getInterviewHistory } from '../services/api'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

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
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground pb-20">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Profile</h1>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              Dashboard
            </Button>
            <Button size="sm" onClick={() => navigate('/history')}>
              View History
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 mt-8 space-y-8">
        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">User Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Name</p>
              <p className="text-base font-medium">{displayName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Email</p>
              <p className="text-base font-medium">{user?.email}</p>
            </div>
            
            <div className="pt-4">
              <Button variant="destructive" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Your Progress</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="text-center py-6 px-4">
              <CardContent className="p-0">
                <p className="text-3xl font-bold text-foreground">{stats.interviews}</p>
                <p className="text-sm text-muted-foreground mt-2 uppercase tracking-wider font-medium">Interviews</p>
              </CardContent>
            </Card>
            <Card className="text-center py-6 px-4">
              <CardContent className="p-0">
                <p className="text-3xl font-bold text-foreground">{stats.avgScore}</p>
                <p className="text-sm text-muted-foreground mt-2 uppercase tracking-wider font-medium">Avg. Score</p>
              </CardContent>
            </Card>
            <Card className="text-center py-6 px-4">
              <CardContent className="p-0">
                <p className="text-3xl font-bold text-foreground">{stats.practiceHours}</p>
                <p className="text-sm text-muted-foreground mt-2 uppercase tracking-wider font-medium">Practice Hours</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  )
}
