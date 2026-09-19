import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createInterview } from '../services/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Select } from '../components/ui/select'
import { ThemeToggle } from '../components/ThemeToggle'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import '../styles/CreateInterview.css'

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

const DEFAULT_FORM = {
  resume: '',
  role: '',
  difficulty: 'medium',
  questionCount: '5',
  duration: '30',
}

export default function CreateInterview() {
  const navigate = useNavigate()
  const { token } = useAuth()

  const [form, setForm] = useState(DEFAULT_FORM)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    if (error) setError('')
  }

  function validate() {
    if (!form.resume.trim()) return 'Resume is required.'
    if (form.resume.trim().length > 5000)
      return 'Resume is too long (maximum 5000 characters).'
    if (!form.role.trim()) return 'Target role is required.'

    const qCount = Number(form.questionCount)
    if (!Number.isInteger(qCount) || qCount < 1 || qCount > 20)
      return 'Number of questions must be between 1 and 20.'

    const dur = Number(form.duration)
    if (!Number.isFinite(dur) || dur < 1 || dur > 120)
      return 'Duration must be between 1 and 120 minutes.'

    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)
    setError('')

    const { data, error: apiError } = await createInterview(
      {
        resume: form.resume.trim(),
        role: form.role.trim(),
        difficulty: form.difficulty,
        questionCount: Number(form.questionCount),
        duration: Number(form.duration),
      },
      token
    )

    setIsLoading(false)

    if (apiError) {
      setError(apiError)
      return
    }

    const interviewId = data.data?.interviewId
    if (!interviewId) {
      setError('Unexpected response from server. Please try again.')
      return
    }

    navigate(`/interview/${interviewId}`, { replace: true })
  }

  return (
    <div className="ci-container">
      {/* Top Navigation */}
      <header className="ci-header">
        <div className="ci-header-inner">
          <button
            onClick={() => navigate('/dashboard')}
            className="ci-logo"
          >
            MOCKINT
          </button>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              onClick={() => navigate('/dashboard')}
              className="ci-back-btn"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="ci-main">
        <div className="ci-content">
          <div className="ci-title-group">
            <p className="ci-subtitle">
              New Interview
            </p>
            <h1 className="ci-title">
              Configure your interview
            </h1>
            <p className="ci-description">
              Paste your resume and choose a role. Gemini will generate tailored questions.
            </p>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Interview Setup</CardTitle>
              <CardDescription>All fields are required.</CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} noValidate className="ci-form">
                {error && (
                  <div
                    role="alert"
                    className="ci-error"
                  >
                    {error}
                  </div>
                )}

                {/* Resume */}
                <div className="ci-field-group">
                  <Label htmlFor="ci-resume">Resume</Label>
                  <Textarea
                    id="ci-resume"
                    name="resume"
                    placeholder="Paste your resume text here (max 5000 characters)…"
                    value={form.resume}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="min-h-[160px]"
                  />
                  <p className="ci-field-hint-right">
                    {form.resume.length} / 5000
                  </p>
                </div>

                {/* Target Role */}
                <div className="ci-field-group">
                  <Label htmlFor="ci-role">Target Role</Label>
                  <Input
                    id="ci-role"
                    name="role"
                    type="text"
                    placeholder="e.g. Frontend Engineer, Backend Developer, Data Scientist"
                    value={form.role}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>

                {/* Difficulty + Questions row */}
                <div className="ci-row">
                  <div className="ci-field-group">
                    <Label htmlFor="ci-difficulty">Difficulty</Label>
                    <Select
                      id="ci-difficulty"
                      name="difficulty"
                      value={form.difficulty}
                      onChange={handleChange}
                      disabled={isLoading}
                    >
                      {DIFFICULTY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="ci-field-group">
                    <Label htmlFor="ci-question-count">Questions</Label>
                    <Input
                      id="ci-question-count"
                      name="questionCount"
                      type="number"
                      min="1"
                      max="20"
                      placeholder="5"
                      value={form.questionCount}
                      onChange={handleChange}
                      disabled={isLoading}
                    />
                    <p className="ci-field-hint">1 – 20</p>
                  </div>
                </div>

                {/* Duration */}
                <div className="ci-field-group">
                  <Label htmlFor="ci-duration">Duration (minutes)</Label>
                  <Input
                    id="ci-duration"
                    name="duration"
                    type="number"
                    min="1"
                    max="120"
                    placeholder="30"
                    value={form.duration}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                  <p className="ci-field-hint">1 – 120 minutes</p>
                </div>

                <Button
                  id="ci-submit"
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="ci-submit-loading">
                      <span className="ci-loading-spinner" />
                      Generating first question…
                    </span>
                  ) : (
                    'Start Interview'
                  )}
                </Button>

                {isLoading && (
                  <p className="ci-loading-text">
                    Gemini is generating your first question. This may take a few seconds.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
