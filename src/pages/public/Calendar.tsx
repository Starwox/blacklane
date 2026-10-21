import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from '../../lib/router'
import { useData } from '../../hooks/useData'
import { getEvents, upcomingEvents } from '../../lib/api'
import { dayKey, formatMonthYear, formatTime } from '../../lib/format'
import { EVENT_STATUS_LABEL, EVENT_STATUSES, KIND_LABEL, KINDS, PHASE_SHORT, PHASES } from '../../lib/labels'
import type { BLEvent, EventKind, EventPhase, EventStatus } from '../../lib/types'
import { Container, PageHero } from '../../components/layout'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/primitives'
import { Segmented } from '../../components/ui/Form'
import { Icon } from '../../components/ui/Icon'
import { cx } from '../../components/ui/cx'
import { EventCard } from '../../components/race/EventCard'
import { KIND_ICON } from '../../components/race/Badges'

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function MonthGrid({ events, month, onMonth }: { events: BLEvent[]; month: Date; onMonth: (d: Date) => void }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))]
  while (cells.length % 7) cells.push(null)
  const byDay = new Map<string, BLEvent[]>()
  for (const e of events) {
    if (!e.starts_at) continue
    const k = dayKey(e.starts_at)
    byDay.set(k, [...(byDay.get(k) ?? []), e])
  }
  const todayKey = dayKey(new Date())
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  return (
    <div className="panel-flat">
      <div className="flex items-center justify-between border-b border-ink-600 px-4 py-3">
        <button className="grid size-9 place-items-center border border-ink-600 text-ash hover:text-bone" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Mois précédent">
          <Icon name="chevronLeft" />
        </button>
        <p className="display text-3xl text-bone">{formatMonthYear(new Date(month.getFullYear(), month.getMonth(), 15))}</p>
        <button className="grid size-9 place-items-center border border-ink-600 text-ash hover:text-bone" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Mois suivant">
          <Icon name="chevronRight" />
        </button>
      </div>
      <div className="grid grid-cols-7 border-b border-ink-700 text-center">
        {WEEKDAYS.map((d) => (
          <div key={d} className="label py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const list = d ? byDay.get(key(d)) ?? [] : []
          const isToday = d && key(d) === todayKey
          return (
            <div key={i} className={cx('min-h-[92px] border-b border-r border-ink-700 p-1.5 sm:min-h-[118px] sm:p-2', !d && 'bg-ink-900/40', (i + 1) % 7 === 0 && 'border-r-0')}>
              {d && (
                <>
                  <p className={cx('mb-1 font-mono text-xs', isToday ? 'inline-block bg-blood-500 px-1.5 text-white' : 'text-smoke')}>{d.getDate()}</p>
                  <ul className="space-y-1">
                    {list.map((e) => (
                      <li key={e.id}>
                        <Link
                          to={`/calendrier/${e.id}`}
                          title={`${e.name} — ${EVENT_STATUS_LABEL[e.status]}`}
                          className={cx(
                            'flex items-center gap-1 border-l-2 bg-white/[0.03] px-1.5 py-1 text-[0.7rem] leading-tight transition-colors hover:bg-blood-500/15',
                            e.status === 'cancelled' ? 'border-ink-400 text-smoke line-through' : e.status === 'postponed' ? 'border-amber-400 text-amber-400' : e.status === 'completed' ? 'border-ink-400 text-ash' : 'border-blood-500 text-bone',
                          )}
                        >
                          <Icon name={KIND_ICON[e.kind]} size={11} className="hidden shrink-0 sm:block" />
                          <span className="truncate">
                            <span className="hidden font-mono sm:inline">{formatTime(e.starts_at)} </span>
                            {e.name}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Calendar() {
  const [params, setParams] = useSearchParams()
  const view = params.get('vue') === 'mois' ? 'mois' : 'liste'
  const kind = (params.get('type') as EventKind | null) ?? ''
  const phase = (params.get('phase') as EventPhase | null) ?? ''
  const status = (params.get('statut') as EventStatus | null) ?? ''
  const events = useData(() => getEvents(), [])
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  useEffect(() => {
    document.title = 'Calendrier — BLACKLANE'
  }, [])

  const filtered = useMemo(
    () =>
      (events.data ?? [])
        .filter((e) => e.kind !== 'challenge')
        .filter((e) => (kind ? e.kind === kind : true))
        .filter((e) => (phase ? e.phase === phase : true))
        .filter((e) => (status ? e.status === status : true)),
    [events.data, kind, phase, status],
  )
  const upcoming = useMemo(() => upcomingEvents(filtered), [filtered])
  const upcomingIds = new Set(upcoming.map((e) => e.id))
  const past = filtered.filter((e) => !upcomingIds.has(e.id)).sort((a, b) => (b.starts_at ?? '').localeCompare(a.starts_at ?? ''))

  return (
    <>
      <PageHero kicker="Saison en cours" title="Calendrier">
        Dates, lieux de rendez-vous RP et modalités de participation. Les convocations officielles passent exclusivement par DarkChat.
      </PageHero>
      <Container className="py-12">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-3 lg:max-w-3xl">
            <label className="block">
              <span className="label mb-1.5 block">Type d’épreuve</span>
              <select className="field" value={kind} onChange={(e) => setParams({ type: e.target.value })}>
                <option value="">Tous les types</option>
                {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label mb-1.5 block">Phase</span>
              <select className="field" value={phase} onChange={(e) => setParams({ phase: e.target.value })}>
                <option value="">Toutes les phases</option>
                {PHASES.map((p) => <option key={p} value={p}>{PHASE_SHORT[p]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label mb-1.5 block">Statut</span>
              <select className="field" value={status} onChange={(e) => setParams({ statut: e.target.value })}>
                <option value="">Tous les statuts</option>
                {EVENT_STATUSES.map((s) => <option key={s} value={s}>{EVENT_STATUS_LABEL[s]}</option>)}
              </select>
            </label>
          </div>
          <Segmented
            label="Affichage"
            value={view}
            onChange={(v) => setParams({ vue: v === 'mois' ? 'mois' : null })}
            options={[
              { value: 'liste', label: <><Icon name="list" size={14} /> Liste</> },
              { value: 'mois', label: <><Icon name="grid" size={14} /> Calendrier</> },
            ]}
          />
        </div>

        {events.error ? (
          <ErrorState error={events.error} onRetry={events.reload} />
        ) : events.loading ? (
          <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64" />)}</div>
        ) : view === 'mois' ? (
          <MonthGrid events={filtered} month={month} onMonth={setMonth} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="calendar" title="Aucun événement">
            {kind || phase || status ? 'Aucun événement ne correspond à ces filtres.' : 'Aucun événement n’a encore été publié.'}
          </EmptyState>
        ) : (
          <div className="space-y-14">
            <section>
              <h2 className="display mb-5 flex items-center gap-3 text-3xl text-bone">
                <span className="size-2 animate-pulse bg-blood-500" /> À venir
                <span className="font-mono text-sm not-italic text-smoke">{upcoming.length}</span>
              </h2>
              {upcoming.length ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{upcoming.map((e) => <EventCard key={e.id} event={e} />)}</div>
              ) : (
                <EmptyState icon="calendar" title="Rien de programmé">Les prochaines dates seront annoncées prochainement.</EmptyState>
              )}
            </section>
            {past.length > 0 && (
              <section>
                <h2 className="display mb-5 flex items-center gap-3 text-3xl text-ash">
                  Passés et annulés <span className="font-mono text-sm not-italic text-smoke">{past.length}</span>
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{past.map((e) => <EventCard key={e.id} event={e} compact />)}</div>
              </section>
            )}
          </div>
        )}
      </Container>
    </>
  )
}
