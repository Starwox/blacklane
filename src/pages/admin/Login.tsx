import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from '../../lib/router'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { errorMessage } from '../../lib/errors'
import { Emblem, Wordmark } from '../../components/brand/Logo'
import { Button } from '../../components/ui/Button'
import { TextInput } from '../../components/ui/Form'
import { Notice } from '../../components/ui/primitives'
import { Icon } from '../../components/ui/Icon'

export default function Login({ notAuthorized, networkError }: { notAuthorized?: boolean; networkError?: boolean }) {
  const { signIn, signOut, session, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [sent, setSent] = useState(false)

  const next = params.get('suite')
  const safeNext = next && next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password)
        navigate(safeNext, { replace: true })
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/admin/reinitialiser`,
        })
        if (error) throw error
        setSent(true)
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="asphalt relative flex min-h-dvh items-center justify-center overflow-hidden p-4">
      <div className="rain pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blood-500/10 blur-3xl" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-8 flex flex-col items-center gap-4">
          <Emblem size={64} glow />
          <Wordmark size="lg" />
        </Link>
        <div className="panel bg-ink-900/90 p-7 backdrop-blur">
          <p className="kicker mb-1">Accès organisateurs</p>
          <h1 className="display text-4xl text-bone">{mode === 'login' ? 'Connexion' : 'Mot de passe oublié'}</h1>

          {notAuthorized && session && (
            <Notice tone="danger" className="mt-5" title="Compte non autorisé">
              Ce compte ({session.user.email}) n’a pas accès au back-office. Contactez un organisateur.
              <button className="mt-3 block text-xs uppercase tracking-wider text-blood-300 underline" onClick={() => void signOut()}>Se déconnecter</button>
            </Notice>
          )}
          {networkError && (
            <Notice tone="warning" className="mt-5" title="Vérification impossible">
              Le serveur ne répond pas.
              <button className="mt-3 block text-xs uppercase tracking-wider text-amber-400 underline" onClick={() => void refreshProfile()}>Réessayer</button>
            </Notice>
          )}

          {sent ? (
            <Notice tone="success" className="mt-5">
              Si un compte existe pour cette adresse, un lien de réinitialisation vient d’être envoyé.
            </Notice>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              <TextInput label="Adresse e-mail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
              {mode === 'login' && (
                <TextInput label="Mot de passe" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              )}
              {error && <p role="alert" className="text-sm text-blood-300">{error}</p>}
              <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!email || (mode === 'login' && !password)} icon={<Icon name="lock" size={15} />}>
                {mode === 'login' ? 'Se connecter' : 'Envoyer le lien'}
              </Button>
            </form>
          )}
          <button
            className="mt-5 text-xs text-smoke underline-offset-4 hover:text-bone hover:underline"
            onClick={() => {
              setMode(mode === 'login' ? 'forgot' : 'login')
              setSent(false)
              setError(null)
            }}
          >
            {mode === 'login' ? 'Mot de passe oublié ?' : 'Retour à la connexion'}
          </button>
        </div>
        <p className="mt-6 text-center text-xs text-ink-400">Accès réservé. Toutes les actions sont journalisées.</p>
      </div>
    </div>
  )
}
