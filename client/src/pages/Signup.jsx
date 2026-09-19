import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signup as apiSignup } from '../services/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import '../styles/Login.css'

export default function Signup() {
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    if (error) setError('')
  }

  function validate() {
    if (!form.name.trim()) return 'Name is required.'
    if (!form.email.trim()) return 'Email is required.'
    if (!/\S+@\S+\.\S+/.test(form.email)) return 'Enter a valid email address.'
    if (!form.password) return 'Password is required.'
    if (form.password.length < 6) return 'Password must be at least 6 characters.'
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

    const { data, error: apiError } = await apiSignup({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
    })

    setIsLoading(false)

    if (apiError) {
      setError(apiError)
      return
    }

    // Signup successful — redirect to login
    navigate('/login', { replace: true, state: { fromSignup: true } })
  }

  return (
    <div className="auth-container">
      {/* Brand */}
      <div className="auth-brand">
        <span className="auth-logo">
          MOCKINT
        </span>
      </div>

      <Card className="auth-card">
        <CardHeader className="pb-4">
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Join AI Interviewer and start practicing today.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="auth-form">
            {error && (
              <div
                role="alert"
                className="auth-error"
              >
                {error}
              </div>
            )}

            <div className="auth-field-group">
              <Label htmlFor="signup-name">Name</Label>
              <Input
                id="signup-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Aryan Chouhan"
                value={form.name}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            <div className="auth-field-group">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            <div className="auth-field-group">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            <Button
              id="signup-submit"
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="auth-submit-loading">
                  <span className="auth-loading-spinner" />
                  Creating account…
                </span>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <p className="auth-footer">
            Already have an account?{' '}
            <Link
              to="/login"
              className="auth-link"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
