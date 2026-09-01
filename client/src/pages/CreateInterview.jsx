import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createInterview } from '../services/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Select } from '../components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'

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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-base font-semibold tracking-tight text-foreground hover:text-primary transition-colors"
          >
            AI Interviewer
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-xl">
          <div className="mb-6">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-1">
              New Interview
            </p>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              Configure your interview
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Paste your resume and choose a role. Gemini will generate tailored questions.
            </p>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Interview Setup</CardTitle>
              <CardDescription>All fields are required.</CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                {error && (
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {error}
                  </div>
                )}

                {/* Resume */}
                <div className="space-y-1.5">
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
                  <p className="text-xs text-muted-foreground text-right">
                    {form.resume.length} / 5000
                  </p>
                </div>

                {/* Target Role */}
                <div className="space-y-1.5">
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
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

                  <div className="space-y-1.5">
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
                    <p className="text-xs text-muted-foreground">1 – 20</p>
                  </div>
                </div>

                {/* Duration */}
                <div className="space-y-1.5">
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
                  <p className="text-xs text-muted-foreground">1 – 120 minutes</p>
                </div>

                <Button
                  id="ci-submit"
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      Generating first question…
                    </span>
                  ) : (
                    'Start Interview'
                  )}
                </Button>

                {isLoading && (
                  <p className="text-center text-xs text-muted-foreground">
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
