import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Évite l'écran blanc en cas d'erreur inattendue de rendu */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur Blacklane', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-950 p-6">
        <div className="max-w-md border border-blood-600/60 bg-ink-850 p-8">
          <p className="kicker mb-3">Incident</p>
          <h1 className="display text-4xl text-bone">Sortie de route.</h1>
          <p className="mt-3 text-sm text-ash">Une erreur inattendue a interrompu l’affichage. Rechargez la page ; si le problème persiste, prévenez un organisateur.</p>
          <button className="mt-6 bg-blood-500 px-5 py-2.5 font-display text-sm font-bold uppercase tracking-widest text-white" onClick={() => window.location.reload()}>
            Recharger
          </button>
        </div>
      </div>
    )
  }
}
