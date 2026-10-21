import { Emblem, Wordmark } from '../components/brand/Logo'

/** Affiché tant que les variables d'environnement Supabase ne sont pas définies */
export default function SetupRequired() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-950 p-6">
      <div className="w-full max-w-xl border border-ink-600 bg-ink-850 p-8">
        <div className="flex items-center gap-3"><Emblem size={40} /><Wordmark /></div>
        <h1 className="display mt-8 text-4xl text-bone">Configuration requise</h1>
        <p className="mt-3 text-sm leading-relaxed text-ash">
          Le site n’est pas encore relié à sa base de données. Définissez les variables d’environnement suivantes
          (fichier <code className="font-mono text-bone">.env</code> en local, ou Netlify → Site configuration → Environment variables), puis relancez le build :
        </p>
        <pre className="mt-4 overflow-x-auto border border-ink-600 bg-ink-950 p-4 font-mono text-xs text-bone">
{`VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon-publique`}
        </pre>
        <p className="mt-4 text-xs text-smoke">Consultez le README du projet pour la procédure complète.</p>
      </div>
    </div>
  )
}
