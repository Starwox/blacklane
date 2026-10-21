import type { ReactNode } from 'react'
import { cx } from './cx'
import { Icon, type IconName } from './Icon'
import { Button } from './Button'
import { errorMessage } from '../../lib/errors'
import type { Tone } from '../../lib/labels'

const toneClass: Record<Tone, string> = {
  neutral: 'border-ink-500 text-ash bg-white/[0.03]',
  red: 'border-blood-500/70 text-blood-300 bg-blood-500/10',
  bone: 'border-bone/40 text-bone bg-bone/[0.06]',
  muted: 'border-ink-500 text-smoke line-through decoration-smoke/60',
  success: 'border-emerald-400/50 text-emerald-400 bg-emerald-400/10',
  warning: 'border-amber-400/50 text-amber-400 bg-amber-400/10',
}

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 border px-2 py-0.5 font-display text-[0.68rem] font-bold uppercase tracking-[0.14em] whitespace-nowrap',
        toneClass[tone],
        tone === 'muted' && 'no-underline',
        className,
      )}
    >
      {dot && <span className={cx('size-1.5 rounded-full bg-current', tone === 'red' && 'animate-pulse')} />}
      <span className={tone === 'muted' ? 'line-through decoration-smoke/60' : undefined}>{children}</span>
    </span>
  )
}

export function DemoBadge() {
  return (
    <span className="ml-1.5 inline-flex border border-amber-400/40 px-1 font-mono text-[0.6rem] uppercase tracking-wider text-amber-400" title="Donnée de démonstration">
      démo
    </span>
  )
}

export function SectionHeading({
  kicker,
  title,
  children,
  action,
  className,
  as: As = 'h2',
}: {
  kicker?: string
  title: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
  as?: 'h1' | 'h2' | 'h3'
}) {
  return (
    <div className={cx('mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-2xl">
        {kicker && <p className="kicker mb-3 flex items-center gap-3"><span className="h-px w-8 bg-blood-500" />{kicker}</p>}
        <As className={cx('display text-bone', As === 'h1' ? 'text-5xl sm:text-6xl lg:text-7xl' : 'text-4xl sm:text-5xl')}>{title}</As>
        {children && <div className="mt-4 text-[0.98rem] leading-relaxed text-ash">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function EmptyState({
  icon = 'flag',
  title,
  children,
  action,
  className,
}: {
  icon?: IconName
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('relative flex flex-col items-center justify-center border border-dashed border-ink-500 px-6 py-12 text-center', className)}>
      <span className="mb-4 grid size-12 place-items-center border border-ink-500 text-blood-400">
        <Icon name={icon} size={22} />
      </span>
      <p className="display text-2xl text-bone">{title}</p>
      {children && <div className="mt-2 max-w-md text-sm text-smoke">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cx('flex flex-col items-start gap-3 border border-blood-600/60 bg-blood-900/40 p-5 sm:flex-row sm:items-center', className)}>
      <Icon name="alert" className="shrink-0 text-blood-400" />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-bone">Chargement impossible</p>
        <p className="text-ash">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} icon={<Icon name="refresh" size={14} />}>
          Réessayer
        </Button>
      )}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse bg-ink-700/70', className)} />
}

export function LoadingBlock({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx('space-y-2', className)} aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  )
}

export function Notice({ tone = 'info', children, className, title }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: ReactNode; className?: string; title?: string }) {
  const cls = {
    info: 'border-ink-500 bg-white/[0.025] text-ash',
    warning: 'border-amber-400/40 bg-amber-400/[0.06] text-ash',
    danger: 'border-blood-500/60 bg-blood-900/40 text-ash',
    success: 'border-emerald-400/40 bg-emerald-400/[0.06] text-ash',
  }[tone]
  const icon: IconName = tone === 'success' ? 'check' : tone === 'info' ? 'info' : 'alert'
  const iconCls = { info: 'text-smoke', warning: 'text-amber-400', danger: 'text-blood-400', success: 'text-emerald-400' }[tone]
  return (
    <div className={cx('flex gap-3 border p-4 text-sm leading-relaxed', cls, className)}>
      <Icon name={icon} className={cx('mt-0.5 shrink-0', iconCls)} />
      <div className="min-w-0 flex-1">
        {title && <p className="mb-1 font-semibold text-bone">{title}</p>}
        {children}
      </div>
    </div>
  )
}

/** Petit indicateur chiffré (compteurs) */
export function StatTile({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className={cx('panel p-5', accent && 'border-blood-600/60')}>
      <p className="label">{label}</p>
      <p className={cx('mt-3 font-display text-5xl font-extrabold italic tabular leading-none', accent ? 'text-blood-400' : 'text-bone')}>{value}</p>
      {hint && <p className="mt-2 text-xs text-smoke">{hint}</p>}
    </div>
  )
}
