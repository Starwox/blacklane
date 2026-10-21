import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

/** Vrai lorsque les variables d'environnement publiques sont renseignées */
export const isConfigured = Boolean(url && anonKey)

/**
 * Client Supabase partagé. Seule la clé « anon » (publique par conception)
 * est utilisée côté navigateur : toutes les écritures sont protégées par
 * les règles RLS et les fonctions SQL qui vérifient le rôle administrateur.
 */
export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'public-anon-key-missing', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'blacklane-admin-session',
  },
})

export const MEDIA_BUCKET = 'media'
