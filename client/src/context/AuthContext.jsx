import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getCurrentUser } from '../services/api'

const AuthContext = createContext(null)

const TOKEN_KEY = 'ai_interviewer_token'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)

  // Restore session on mount
  useEffect(() => {
    async function restoreSession() {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      if (!storedToken) {
        setLoading(false)
        return
      }

      const { data, error } = await getCurrentUser(storedToken)

      if (error || !data) {
        // Token is invalid or expired — clear everything
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
      } else {
        setToken(storedToken)
        setUser(data.user || data)
      }

      setLoading(false)
    }

    restoreSession()
  }, [])

  /**
   * Store token + user after a successful login/signup.
   * Components call this with the raw API response.
   */
  const login = useCallback((jwt, userData) => {
    localStorage.setItem(TOKEN_KEY, jwt)
    setToken(jwt)
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    loading,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
