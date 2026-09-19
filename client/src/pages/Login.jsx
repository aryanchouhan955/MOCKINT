import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { login as apiLogin } from '../services/api'
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

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    if (error) setError('')
  }

  function validate() {
    if (!form.email.trim()) return 'Email is required.'
    if (!/\S+@\S+\.\S+/.test(form.email)) return 'Enter a valid email address.'
    if (!form.password) return 'Password is required.'
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

    const { data, error: apiError } = await apiLogin({
      email: form.email.trim(),
      password: form.password,
    })

    setIsLoading(false)

    if (apiError) {
      setError(apiError)
      return
    }

    // Backend returns { token, user } or { token, data: { user } }
    const jwt = data.token
    const userData = data.user || data.data?.user || null

    if (!jwt) {
      setError('Login failed. Please try again.')
      return
    }

    login(jwt, userData)
    navigate('/dashboard', { replace: true })
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
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your account to continue.</CardDescription>
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
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
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
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            <Button
              id="login-submit"
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="auth-submit-loading">
                  <span className="auth-loading-spinner" />
                  Signing in…
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <p className="auth-footer">
            Don&apos;t have an account?{' '}
            <Link
              to="/signup"
              className="auth-link"
            >
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
