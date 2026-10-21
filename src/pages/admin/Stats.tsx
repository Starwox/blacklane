import { useEffect, useMemo, useState } from 'react'
import { useData } from '../../hooks/useData'
import { listEvents, listSeasons } from '../../lib/admin-api'
import { getSeasonRankings } from '../../lib/api'
import { aggregateStandings, standingsTimeline } from '../../lib/scoring'
import { formatMonthYear, formatShortDate } from '../../lib/format'
import { PHASE_SHORT } from '../../lib/labels'
import type { EventPhase, EventRanking } from '../../lib/types'
import { AdminPageHeader } from './AdminLayout'
import { BarChart, ChartCard, HBarList, LineChart, colorAt } from '../../components/charts/Charts'
import { EmptyState, ErrorState, LoadingBlock, StatTile } from '../../components/ui/primitives'
import { cx } from '../../components/ui/cx'

const PHASE_OPTS: (EventPhase | '')[] = ['', 'qualifications', 'elite', 'finale']

export default function Stats() {
  const seasons = useData(() => listSeasons(), [])
  const events = useData(() => listEvents(), [])
  const [seasonId, setSeasonId] = useState<string>('')
  const [phase, setPhase] = useState<EventPhase | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [picked, setPicked] = useState<string[] | null>(null)

  useEffect(() => {
    document.title = 'Statistiques — Back-office'
  }, [])
  useEffect(() => {
    if (!seasonId && seasons.data?.length) setSeasonId(seasons.data.find((s) => s.status === 'active')?.id ?? seasons.data[0].id)
  }, [seasons.data, seasonId])

  const rankings = useData(async () => (seasonId ? getSeasonRankings(seasonId) : []), [seasonId])

  const rows: EventRanking[] = useMemo(
    () =>
      (rankings.data ?? [])
        .filter((r) => (phase ? r.phase === phase : true))
        .filter((r) => (from ? (r.starts_at ?? '') >= from : true))
        .filter((r) => (to ? (r.starts_at ?? '') <= to + 'T23:59:59' : true)),
    [rankings.data, phase, from, to],
  )

  const agg = useMemo(() => aggregateStandings(rows), [rows])
  const pilots = picked ?? agg.slice(0, 5).map((a) => a.pilot_id)
  const nameOf = useMemo(() => new Map(agg.map((a) => [a.pilot_id, a.pseudonym])), [agg])

  const eventsOrdered = useMemo(() => {
    const m = new Map<string, { id: string; name: string; date: string | null }>()
    for (const r of rows) m.set(r.event_id, { id: r.event_id, name: r.event_name, date: r.starts_at })
    return [...m.values()].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  }, [rows])

  const cumulative = useMemo(() => {
    return pilots.map((pid, i) => {
      let total = 0
      return {
        id: pid,
        name: nameOf.get(pid) ?? '?',
        color: colorAt(i),
        values: eventsOrdered.map((e) => {
          const r = rows.find((x) => x.event_id === e.id && x.pilot_id === pid)
          total += r?.points ?? 0
          return total
        }),
      }
    })
  }, [pilots, eventsOrdered, rows, nameOf])

  const timeline = useMemo(() => standingsTimeline(rows), [rows])
  const positionSeries = pilots.map((pid, i) => ({
    id: pid,
    name: nameOf.get(pid) ?? '?',
    color: colorAt(i),
    values: timeline.map((t) => t.positions.get(pid) ?? null),
  }))

  const seasonEvents = (events.data ?? []).filter((e) => e.season_id === seasonId && e.kind !== 'challenge' && (phase ? e.phase === phase : true))
  const byMonth = useMemo(() => {
    const m = new Map<string, { label: string; done: number; planned: number }>()
    for (const e of seasonEvents) {
      if (!e.starts_at) continue
      if (from && e.starts_at < from) continue
      if (to && e.starts_at > to + 'T23:59:59') continue
      const k = e.starts_at.slice(0, 7)
      const cur = m.get(k) ?? { label: formatMonthYear(e.starts_at), done: 0, planned: 0 }
      if (e.status === 'completed') cur.done++
      else if (e.status !== 'cancelled') cur.planned++
      m.set(k, cur)
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => ({ label: v.label, values: { done: v.done, planned: v.planned } }))
  }, [seasonEvents, from, to])

  const participantsPerEvent = eventsOrdered.map((e) => ({ label: e.name, values: { n: rows.filter((r) => r.event_id === e.id).length } }))
  const winsPodiums = agg.filter((a) => a.podiums > 0).slice(0, 10).map((a) => ({ label: a.pseudonym, values: { wins: a.wins, podiums: a.podiums - a.wins } }))
  const phaseSplit = useMemo(() => {
    const top = agg.slice(0, 8)
    return top.map((a) => {
      const values: Record<string, number> = {}
      for (const ph of ['qualifications', 'elite', 'finale'] as EventPhase[])
        values[ph] = (rankings.data ?? []).filter((r) => r.pilot_id === a.pilot_id && r.phase === ph).reduce((s, r) => s + r.points, 0)
      return { label: a.pseudonym, values }
    })
  }, [agg, rankings.data])
  const avg = agg.filter((a) => a.races > 0).map((a) => ({ label: a.pseudonym, value: Math.round((a.points / a.races) * 10) / 10, sub: `${a.races} course(s)` })).sort((a, b) => b.value - a.value).slice(0, 10)

  const loading = seasons.loading || rankings.loading || events.loading
  const error = seasons.error || rankings.error || events.error

  return (
    <>
      <AdminPageHeader title="Statistiques">Graphiques calculés à partir des résultats officiels enregistrés (épreuves publiées et terminées). Ils se mettent à jour à chaque saisie ou correction.</AdminPageHeader>

      <div className="panel-flat mb-6 grid gap-3 p-4 md:grid-cols-4">
        <label className="block">
          <span className="label mb-1.5 block">Saison</span>
          <select className="field" value={seasonId} onChange={(e) => { setSeasonId(e.target.value); setPicked(null) }}>
            {(seasons.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label mb-1.5 block">Phase</span>
          <select className="field" value={phase} onChange={(e) => { setPhase(e.target.value as EventPhase | ''); setPicked(null) }}>
            {PHASE_OPTS.map((p) => <option key={p} value={p}>{p ? PHASE_SHORT[p] : 'Toutes les phases'}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label mb-1.5 block">Du</span>
          <input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block">
          <span className="label mb-1.5 block">Au</span>
          <input type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {agg.length > 0 && (
          <div className="md:col-span-4">
            <span className="label mb-2 block">Pilotes comparés ({pilots.length}/8)</span>
            <div className="flex flex-wrap gap-1.5">
              {agg.map((a) => {
                const on = pilots.includes(a.pilot_id)
                return (
                  <button
                    key={a.pilot_id}
                    type="button"
                    onClick={() => setPicked(on ? pilots.filter((p) => p !== a.pilot_id) : pilots.length >= 8 ? pilots : [...pilots, a.pilot_id])}
                    className={cx('border px-2.5 py-1 text-xs transition-colors', on ? 'border-blood-500 bg-blood-500/15 text-bone' : 'border-ink-600 text-smoke hover:text-bone')}
                    aria-pressed={on}
                  >
                    {on && <span className="mr-1.5 inline-block size-2" style={{ background: colorAt(pilots.indexOf(a.pilot_id)) }} />}
                    {a.pseudonym}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => { void rankings.reload(); void events.reload() }} />
      ) : loading ? (
        <LoadingBlock rows={6} />
      ) : !rows.length ? (
        <EmptyState icon="chart" title="Aucune course enregistrée">Aucun résultat officiel ne correspond à ces filtres. Les graphiques apparaîtront après la première course terminée.</EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Épreuves" value={eventsOrdered.length} hint={eventsOrdered.length ? `du ${formatShortDate(eventsOrdered[0].date)} au ${formatShortDate(eventsOrdered[eventsOrdered.length - 1].date)}` : undefined} />
            <StatTile label="Pilotes classés" value={agg.length} />
            <StatTile label="Participations" value={rows.length} hint={`${(rows.length / Math.max(1, eventsOrdered.length)).toFixed(1).replace('.', ',')} pilotes / épreuve`} />
            <StatTile label="Points distribués" value={rows.reduce((s, r) => s + r.points, 0)} accent />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard title="Évolution des points" subtitle="Points cumulés des pilotes sélectionnés, épreuve après épreuve">
              <LineChart labels={eventsOrdered.map((e) => e.name)} series={cumulative} height={300} />
            </ChartCard>
            <ChartCard title="Progression au classement" subtitle="Position au classement après chaque épreuve (1 = en tête)">
              <LineChart labels={timeline.map((t) => eventsOrdered.find((e) => e.id === t.event_id)?.name ?? '')} series={positionSeries} invert height={300} />
            </ChartCard>
            <ChartCard title="Victoires et podiums" subtitle="Victoires et autres podiums (2e et 3e places)">
              <BarChart data={winsPodiums} stacked keys={[{ key: 'wins', name: 'Victoires', color: '#e1141e' }, { key: 'podiums', name: '2e / 3e place', color: '#ece8e1' }]} />
            </ChartCard>
            <ChartCard title="Répartition des points par phase" subtitle="Top 8 du classement filtré">
              <BarChart
                data={phaseSplit}
                stacked
                keys={[
                  { key: 'qualifications', name: 'Qualifications', color: '#8a857f' },
                  { key: 'elite', name: 'Élite', color: '#e1141e' },
                  { key: 'finale', name: 'Finale', color: '#ece8e1' },
                ]}
              />
            </ChartCard>
            <ChartCard title="Courses organisées par mois" subtitle="Épreuves terminées et programmées">
              <BarChart data={byMonth} stacked keys={[{ key: 'done', name: 'Terminées', color: '#e1141e' }, { key: 'planned', name: 'À venir', color: '#4a4a53' }]} />
            </ChartCard>
            <ChartCard title="Participants par épreuve" subtitle="Pilotes ayant un résultat officiel">
              <BarChart data={participantsPerEvent} keys={[{ key: 'n', name: 'Participants', color: '#e1141e' }]} />
            </ChartCard>
            <ChartCard title="Comparaison des performances" subtitle="Points moyens par course" className="xl:col-span-2">
              <HBarList items={avg} format={(v) => v.toLocaleString('fr-FR')} />
            </ChartCard>
          </div>
        </div>
      )}
    </>
  )
}
