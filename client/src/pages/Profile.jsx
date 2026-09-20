import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getInterviewHistory, getCurrentUser, saveApiKey, deleteApiKey, saveGeminiModel } from '../services/api'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { ThemeToggle } from '../components/ThemeToggle'
import '../styles/Profile.css'

// ── Gemini models offered to users ──────────────────────────────────────────
const GEMINI_MODELS = [
  {
    id: 'default',
    label: 'System Default',
    name: 'gemini-2.5-flash',
    desc: 'Fast & free — used when no preference is set',
    badge: 'Default',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    name: 'gemini-2.5-flash',
    desc: 'Fast responses, great for real-time interviews',
    badge: 'Fast',
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    name: 'gemini-2.5-pro',
    desc: 'Most capable model — deeper analysis & feedback',
    badge: 'Best',
  },
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    name: 'gemini-2.0-flash',
    desc: 'Previous generation flash — stable & reliable',
    badge: null,
  },
  {
    id: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    name: 'gemini-1.5-flash',
    desc: 'Lightweight model, lower quota consumption',
    badge: null,
  },
  {
    id: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    name: 'gemini-1.5-pro',
    desc: 'Previous Pro generation — strong reasoning',
    badge: null,
  },
]

export default function Profile() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState({
    interviews: '—',
    avgScore: '—',
    practiceHours: '—'
  })

  // ── API Key state ──────────────────────────────────────────────────────────
  const [hasCustomKey, setHasCustomKey] = useState(false)
  const [maskedKey, setMaskedKey]       = useState(null)
  const [apiKeyInput, setApiKeyInput]   = useState('')
  const [showKey, setShowKey]           = useState(false)
  const [keyStatus, setKeyStatus]       = useState(null)
  const [keySaving, setKeySaving]       = useState(false)
  const [keyDeleting, setKeyDeleting]   = useState(false)

  // ── Gemini Model state ─────────────────────────────────────────────────────
  const [selectedModel, setSelectedModel]   = useState('default')
  const [savedModel, setSavedModel]         = useState('default')
  const [modelStatus, setModelStatus]       = useState(null)
  const [modelSaving, setModelSaving]       = useState(false)

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
        if (iv.duration) totalMinutes += iv.duration
        if (iv.overallScore && iv.overallScore !== 'insufficient_evidence') {
          totalScore += Number(iv.overallScore)
          scoredCount++
        }
      })

      setStats({
        interviews: totalInterviews,
        avgScore: scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : 'N/A',
        practiceHours: totalMinutes > 0 ? (totalMinutes / 60).toFixed(1) : 0,
      })
    }

    async function loadUserPrefs() {
      const { data } = await getCurrentUser(token)
      if (data?.user) {
        setHasCustomKey(!!data.user.hasCustomKey)
        setMaskedKey(data.user.maskedKey || null)
        const m = data.user.geminiModel || 'default'
        setSelectedModel(m)
        setSavedModel(m)
      }
    }

    loadStats()
    loadUserPrefs()
  }, [token])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  async function handleSaveKey() {
    if (!apiKeyInput.trim()) {
      setKeyStatus({ type: 'error', msg: 'Please enter your Gemini API key.' })
      return
    }
    setKeySaving(true)
    setKeyStatus(null)
    const { data, error } = await saveApiKey(apiKeyInput.trim(), token)
    setKeySaving(false)
    if (error) {
      setKeyStatus({ type: 'error', msg: error })
    } else {
      setHasCustomKey(true)
      setMaskedKey(data.maskedKey)
      setApiKeyInput('')
      setKeyStatus({ type: 'success', msg: 'API key saved! Your interviews will now use your personal key.' })
    }
  }

  async function handleDeleteKey() {
    setKeyDeleting(true)
    setKeyStatus(null)
    const { error } = await deleteApiKey(token)
    setKeyDeleting(false)
    if (error) {
      setKeyStatus({ type: 'error', msg: error })
    } else {
      setHasCustomKey(false)
      setMaskedKey(null)
      setApiKeyInput('')
      setKeyStatus({ type: 'success', msg: 'API key removed. Interviews will use the system key.' })
    }
  }

  async function handleSaveModel() {
    setModelSaving(true)
    setModelStatus(null)
    const modelToSave = selectedModel === 'default' ? 'default' : selectedModel
    const { data, error } = await saveGeminiModel(modelToSave, token)
    setModelSaving(false)
    if (error) {
      setModelStatus({ type: 'error', msg: error })
    } else {
      setSavedModel(selectedModel)
      const label = GEMINI_MODELS.find(m => m.id === selectedModel)?.label || selectedModel
      setModelStatus({ type: 'success', msg: `Model set to ${label}.` })
    }
  }

  const displayName = user?.name || user?.email || 'User'
  const modelChanged = selectedModel !== savedModel

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

        {/* Gemini API Key */}
        <Card className="prof-user-card">
          <CardHeader>
            <div className="prof-apikey-header">
              <CardTitle className="prof-card-title">Gemini API Key</CardTitle>
              <span className={`prof-apikey-badge ${hasCustomKey ? 'prof-apikey-badge--active' : 'prof-apikey-badge--system'}`}>
                {hasCustomKey ? '✓ Custom Key Active' : '↳ Using System Key'}
              </span>
            </div>
            <p className="prof-apikey-desc">
              Provide your own{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="prof-apikey-link">
                Google AI Studio API key
              </a>{' '}
              to avoid rate limits. Your key is encrypted before being stored and is never shared.
            </p>
          </CardHeader>
          <CardContent className="prof-apikey-content">
            {hasCustomKey && maskedKey && (
              <div className="prof-apikey-current">
                <span className="prof-info-label">Current key</span>
                <div className="prof-apikey-masked">
                  <span className="prof-apikey-masked-val">{maskedKey}</span>
                  <Button
                    id="remove-api-key-btn"
                    variant="ghost"
                    size="sm"
                    className="prof-apikey-remove-btn"
                    onClick={handleDeleteKey}
                    disabled={keyDeleting}
                  >
                    {keyDeleting ? 'Removing…' : 'Remove key'}
                  </Button>
                </div>
              </div>
            )}

            <div className="prof-apikey-field">
              <label htmlFor="gemini-api-key" className="prof-info-label">
                {hasCustomKey ? 'Replace with a new key' : 'Enter your API key'}
              </label>
              <div className="prof-apikey-input-row">
                <input
                  id="gemini-api-key"
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={e => { setApiKeyInput(e.target.value); setKeyStatus(null) }}
                  placeholder="AIzaSy…"
                  className="prof-apikey-input"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="prof-apikey-toggle"
                  onClick={() => setShowKey(v => !v)}
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
              <p className="prof-apikey-hint">
                Keys start with <code className="prof-apikey-code">AIza</code> and are available free from{' '}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="prof-apikey-link">
                  Google AI Studio
                </a>.
              </p>
            </div>

            {keyStatus && (
              <div className={`prof-apikey-status prof-apikey-status--${keyStatus.type}`}>
                {keyStatus.type === 'success' ? '✓ ' : '✕ '}{keyStatus.msg}
              </div>
            )}

            <Button
              id="save-api-key-btn"
              onClick={handleSaveKey}
              disabled={keySaving || !apiKeyInput.trim()}
              size="sm"
              className="prof-apikey-save-btn"
            >
              {keySaving ? 'Saving…' : hasCustomKey ? 'Update Key' : 'Save Key'}
            </Button>
          </CardContent>
        </Card>

        {/* Gemini Model Selector */}
        <Card className="prof-user-card">
          <CardHeader>
            <div className="prof-apikey-header">
              <CardTitle className="prof-card-title">Gemini Model</CardTitle>
              <span className="prof-model-badge">
                {GEMINI_MODELS.find(m => m.id === savedModel)?.label || 'System Default'}
              </span>
            </div>
            <p className="prof-apikey-desc">
              Choose which Gemini model powers your mock interviews. Pro models produce richer feedback but consume more quota.
            </p>
          </CardHeader>
          <CardContent className="prof-model-content">
            <div className="prof-model-grid" role="radiogroup" aria-label="Gemini model selection">
              {GEMINI_MODELS.map(m => (
                <label
                  key={m.id}
                  htmlFor={`model-${m.id}`}
                  className={`prof-model-option ${selectedModel === m.id ? 'prof-model-option--selected' : ''}`}
                >
                  <input
                    type="radio"
                    id={`model-${m.id}`}
                    name="geminiModel"
                    value={m.id}
                    checked={selectedModel === m.id}
                    onChange={() => { setSelectedModel(m.id); setModelStatus(null) }}
                    className="prof-model-radio"
                  />
                  <div className="prof-model-info">
                    <div className="prof-model-name-row">
                      <span className="prof-model-name">{m.label}</span>
                      {m.badge && (
                        <span className={`prof-model-pill prof-model-pill--${m.badge.toLowerCase()}`}>
                          {m.badge}
                        </span>
                      )}
                      {savedModel === m.id && (
                        <span className="prof-model-saved-dot" title="Currently saved" />
                      )}
                    </div>
                    <span className="prof-model-desc">{m.desc}</span>
                    {m.id !== 'default' && (
                      <code className="prof-model-id">{m.name}</code>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {modelStatus && (
              <div className={`prof-apikey-status prof-apikey-status--${modelStatus.type}`}>
                {modelStatus.type === 'success' ? '✓ ' : '✕ '}{modelStatus.msg}
              </div>
            )}

            <Button
              id="save-gemini-model-btn"
              onClick={handleSaveModel}
              disabled={modelSaving || !modelChanged}
              size="sm"
              className="prof-apikey-save-btn"
            >
              {modelSaving ? 'Saving…' : modelChanged ? 'Apply Model' : 'Model Saved'}
            </Button>
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
