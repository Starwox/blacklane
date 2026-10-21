import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from '../../lib/router'
import { supabase } from '../../lib/supabase'
import { errorMessage } from '../../lib/errors'
import { Emblem } from '../../components/brand/Logo'
import { Button } from '../../components/ui/Button'
import { TextInput } from '../../components/ui/Form'
import { Notice } from '../../components/ui/primitives'

/** Définition du mot de passe (lien d'invitation ou de réinitialisation) */
export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setReady(Boolean(s)))
    return () => data.subscription.unsubscribe()
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 10) return setError('Le mot de passe doit contenir au moins 10 caractères.')
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.')
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => navigate('/admin', { replace: true }), 1500)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="asphalt flex min-h-dvh items-center justify-center p-4">
      <div className="panel w-full max-w-md bg-ink-900 p-7">
        <Emblem size={44} />
        <h1 className="display mt-5 text-4xl text-bone">Définir le mot de passe</h1>
        {!ready ? (
          <Notice tone="warning" className="mt-5">Lien invalide ou expiré. Demandez un nouveau lien depuis la page de connexion.</Notice>
        ) : done ? (
          <Notice tone="success" className="mt-5">Mot de passe enregistré. Redirection…</Notice>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <TextInput label="Nouveau mot de passe" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint="10 caractères minimum." />
            <TextInput label="Confirmation" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {error && <p role="alert" className="text-sm text-blood-300">{error}</p>}
            <Button type="submit" className="w-full" size="lg" loading={busy}>Enregistrer</Button>
          </form>
        )}
      </div>
    </div>
  )
}
