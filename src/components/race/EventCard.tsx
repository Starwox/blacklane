import { Link } from '../../lib/router'
import { formatDay, formatMonthShort, formatTime, formatWeekday, formatShortDate } from '../../lib/format'
import { PHASE_SHORT } from '../../lib/labels'
import type { BLEvent } from '../../lib/types'
import { Icon } from '../ui/Icon'
import { cx } from '../ui/cx'
import { EventStatusBadge, KindLabel } from './Badges'

export function EventCard({ event, participants, compact }: { event: BLEvent; participants?: number; compact?: boolean }) {
  const off = event.status === 'cancelled'
  return (
    <Link
      to={`/calendrier/${event.id}`}
      className={cx(
        'panel group flex h-full min-w-0 flex-col transition-all duration-300 hover:-translate-y-0.5 hover:border-blood-500/60',
        off && 'opacity-60',
      )}
    >
      <div className="flex items-stretch border-b border-ink-600">
        <div className="flex w-20 shrink-0 flex-col items-center justify-center border-r border-ink-600 bg-ink-900/70 py-3">
          {event.starts_at ? (
            <>
              <span className="font-display text-4xl font-extrabold italic leading-none text-bone tabular">{formatDay(event.starts_at)}</span>
              <span className="mt-1 font-display text-xs font-bold tracking-[0.2em] text-blood-400">{formatMonthShort(event.starts_at)}</span>
            </>
          ) : (
            <span className="px-2 text-center font-display text-xs font-bold uppercase tracking-widest text-smoke">Date à venir</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <KindLabel kind={event.kind} />
            {event.group_label && <span className="font-mono text-[0.7rem] text-smoke">GR. {event.group_label}</span>}
            {event.session_number && <span className="font-mono text-[0.7rem] text-smoke">S{event.session_number}</span>}
          </div>
          <h3 className={cx('display truncate text-2xl text-bone transition-colors group-hover:text-white', off && 'line-through decoration-blood-500/70')}>
            {event.name}
          </h3>
        </div>
      </div>
      <div className={cx('flex flex-1 flex-col gap-3 px-4 py-4 text-sm', compact && 'py-3')}>
        <div className="flex flex-wrap items-center gap-2">
          <EventStatusBadge status={event.status} />
          <span className="label">{PHASE_SHORT[event.phase]}</span>
        </div>
        <dl className="grid gap-1.5 text-ash">
          {event.starts_at && (
            <div className="flex items-center gap-2">
              <Icon name="clock" size={15} className="text-smoke" />
              <dd>
                {formatWeekday(event.starts_at)} · <span className="tabular text-bone">{formatTime(event.starts_at)}</span>
              </dd>
            </div>
          )}
          {event.location_rp && (
            <div className="flex items-center gap-2">
              <Icon name="pin" size={15} className="text-smoke" />
              <dd className="truncate">{event.location_rp}</dd>
            </div>
          )}
          {(event.capacity || participants != null) && (
            <div className="flex items-center gap-2">
              <Icon name="users" size={15} className="text-smoke" />
              <dd className="tabular">
                {participants != null && event.capacity
                  ? `${participants} / ${event.capacity} pilotes`
                  : event.capacity
                    ? `${event.capacity} places`
                    : `${participants} pilotes`}
              </dd>
            </div>
          )}
        </dl>
        {event.status === 'postponed' && (
          <p className="border-l-2 border-amber-400/70 pl-3 text-xs text-amber-400/90">
            {event.postponed_from ? `Initialement prévu le ${formatShortDate(event.postponed_from)}. ` : ''}
            {event.status_note ?? ''}
          </p>
        )}
        {event.status === 'cancelled' && event.status_note && (
          <p className="border-l-2 border-ink-400 pl-3 text-xs text-smoke">{event.status_note}</p>
        )}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-1 font-display text-xs font-bold uppercase tracking-[0.16em] text-smoke transition-colors group-hover:text-blood-400">
          Fiche de l’épreuve <Icon name="arrowRight" size={14} className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  )
}
