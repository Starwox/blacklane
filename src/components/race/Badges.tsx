import { Badge } from '../ui/primitives'
import { Icon, type IconName } from '../ui/Icon'
import { cx } from '../ui/cx'
import { EVENT_STATUS_LABEL, EVENT_STATUS_TONE, KIND_LABEL, RANK_LABEL } from '../../lib/labels'
import type { EventKind, EventStatus, PilotRank } from '../../lib/types'

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <Badge tone={EVENT_STATUS_TONE[status]} dot={status === 'registration_open' || status === 'in_progress'}>
      {EVENT_STATUS_LABEL[status]}
    </Badge>
  )
}

export const RANK_ICON: Record<PilotRank, IconName> = {
  prospect: 'mask',
  runner: 'helmet',
  challenger: 'medal',
  elite: 'crown',
}

export function RankBadge({ rank, className }: { rank: PilotRank; className?: string }) {
  const cls: Record<PilotRank, string> = {
    prospect: 'text-smoke border-ink-500',
    runner: 'text-ash border-ink-400',
    challenger: 'text-bone border-bone/40',
    elite: 'text-blood-300 border-blood-500/70 bg-blood-500/10',
  }
  return (
    <span className={cx('inline-flex items-center gap-1.5 border px-1.5 py-0.5 font-display text-[0.68rem] font-bold uppercase tracking-[0.14em]', cls[rank], className)}>
      <Icon name={RANK_ICON[rank]} size={12} />
      {RANK_LABEL[rank]}
    </span>
  )
}

export const KIND_ICON: Record<EventKind, IconName> = {
  qualification: 'flag',
  urban_run: 'bolt',
  navigation: 'gps',
  finale: 'trophy',
  challenge: 'swords',
  exhibition: 'steering',
}

export function KindLabel({ kind, className }: { kind: EventKind; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-[0.16em] text-ash', className)}>
      <Icon name={KIND_ICON[kind]} size={14} className="text-blood-400" />
      {KIND_LABEL[kind]}
    </span>
  )
}

/** Pastille de position (P1, P2, P3 mis en valeur) */
export function PositionChip({ position, size = 'md' }: { position: number | null; size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'size-7 text-sm', md: 'size-9 text-base', lg: 'size-12 text-2xl' }[size]
  const style =
    position === 1
      ? 'bg-blood-500 text-white shadow-glow'
      : position === 2
        ? 'bg-bone text-ink-950'
        : position === 3
          ? 'border border-ash/70 text-bone'
          : 'border border-ink-600 text-smoke'
  return (
    <span className={cx('chamfer-sm inline-grid shrink-0 place-items-center font-display font-extrabold italic tabular', dims, style)}>
      {position ?? '—'}
    </span>
  )
}
