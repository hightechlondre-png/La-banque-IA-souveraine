import React, { createContext, useState, useContext, useEffect, useCallback } from 'react'
import { base44, getToken } from '@/api/base44Client'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [isLoadingPublicSettings] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [appPublicSettings] = useState({
    id: 'aegis-core-net',
    public_settings: { app_name: 'AEGIS-Q' },
  })

  const checkUserAuth = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setIsAuthenticated(false)
      setUser(null)
      setIsLoadingAuth(false)
      return
    }
    try {
      setIsLoadingAuth(true)
      const me = await base44.auth.me()
      setUser(me)
      setIsAuthenticated(true)
      setAuthError(null)
    } catch (e) {
      setIsAuthenticated(false)
      setUser(null)
      if (e?.response?.status === 401) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' })
      }
    } finally {
      setIsLoadingAuth(false)
    }
  }, [])

  useEffect(() => {
    checkUserAuth()
  }, [checkUserAuth])

  const logout = (shouldRedirect = true) => {
    setUser(null)
    setIsAuthenticated(false)
    if (shouldRedirect) base44.auth.logout()
  }

  const navigateToLogin = () => {
    if (typeof window !== 'undefined') window.location.href = '/login'
  }

  const loginWithCredentials = async (email, password) => {
    await base44.auth.login(email, password)
    await checkUserAuth()
  }

  const registerWithCredentials = async (email, password, full_name) => {
    await base44.auth.register(email, password, full_name)
    await checkUserAuth()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        logout,
        navigateToLogin,
        checkAppState: checkUserAuth,
        checkUserAuth,
        loginWithCredentials,
        registerWithCredentials,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
