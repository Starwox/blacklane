import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { cx } from './cx'
import { errorMessage } from '../../lib/errors'

type ToastKind = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  success: (msg: string) => void
  error: (err: unknown) => void
  info: (msg: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)
let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++seq
    setItems((prev) => [...prev.slice(-3), { id, kind, message }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 3800)
  }, [])

  const api: ToastApi = {
    success: (m) => push('success', m),
    error: (e) => push('error', errorMessage(e)),
    info: (m) => push('info', m),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex flex-col items-center gap-2 p-4 sm:items-end" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={cx(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 border bg-ink-850/95 px-4 py-3 text-sm shadow-2xl backdrop-blur animate-[rise_.25s_ease_both]',
              t.kind === 'success' && 'border-emerald-400/40',
              t.kind === 'error' && 'border-blood-500/70',
              t.kind === 'info' && 'border-ink-500',
            )}
          >
            <Icon
              name={t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : 'info'}
              className={cx('mt-0.5 shrink-0', t.kind === 'success' ? 'text-emerald-400' : t.kind === 'error' ? 'text-blood-400' : 'text-smoke')}
            />
            <p className="flex-1 text-bone">{t.message}</p>
            <button className="text-smoke hover:text-bone" onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))} aria-label="Fermer">
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans <ToastProvider>')
  return ctx
}
