import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isConfigured } from './supabase'
import type { AdminProfile, AdminRole } from './types'
import { ROLE_LEVEL } from './labels'

interface AuthState {
  session: Session | null
  profile: AdminProfile | null
  /** Chargement initial de la session */
  loading: boolean
  /** Vrai si une erreur réseau a empêché de vérifier le profil */
  profileError: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  can: (role: AdminRole) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

async function fetchProfile(): Promise<AdminProfile | null> {
  const { data, error } = await supabase.rpc('my_admin_profile')
  if (error) throw error
  const rows = (data ?? []) as AdminProfile[]
  return rows[0] ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState(false)

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null)
      setProfileError(false)
      return
    }
    try {
      setProfile(await fetchProfile())
      setProfileError(false)
    } catch {
      setProfileError(true)
    }
  }, [])

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false)
      return
    }
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      await loadProfile(data.session)
      if (mounted) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Différé : évite d'appeler l'API depuis le callback d'authentification
        setTimeout(() => void loadProfile(s), 0)
      }
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      setSession(data.session)
      await loadProfile(data.session)
    },
    [loadProfile],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(() => loadProfile(session), [loadProfile, session])

  const can = useCallback((role: AdminRole) => (profile ? profile.level >= ROLE_LEVEL[role] : false), [profile])

  return (
    <AuthContext.Provider value={{ session, profile, loading, profileError, signIn, signOut, refreshProfile, can }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
