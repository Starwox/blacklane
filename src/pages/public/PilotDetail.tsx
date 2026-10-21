import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from '../../lib/router'
import { useData } from '../../hooks/useData'
import { getPilot, getPilotRankings, getPilotStages, getPilotStandings } from '../../lib/api'
import { cumulativeProgression } from '../../lib/scoring'
import { formatShortDate, ordinal } from '../../lib/format'
import { KIND_LABEL, OUTCOME_LABEL, PHASE_SHORT, PILOT_STATUS_LABEL, STAGE_LABEL } from '../../lib/labels'
import { Container } from '../../components/layout'
import { EmptyState, ErrorState, LoadingBlock, DemoBadge, StatTile } from '../../components/ui/primitives'
import { Icon } from '../../components/ui/Icon'
import { LinkButton } from '../../components/ui/Button'
import { cx } from '../../components/ui/cx'
import { PositionChip, RankBadge } from '../../components/race/Badges'
import { ChartCard, LineChart } from '../../components/charts/Charts'

export default function PilotDetail() {
  const { id } = useParams<{ id: string }>()
  const pilot = useData(() => getPilot(id), [id])
  const standings = useData(() => getPilotStandings(id), [id])
  const rankings = useData(() => getPilotRankings(id), [id])
  const stages = useData(() => getPilotStages(id), [id])
  const [seasonId, setSeasonId] = useState<string | null>(null)

  const seasonsWithData = useMemo(
    () => [...(standings.data ?? [])].sort((a, b) => (a.season_status === 'active' ? -1 : b.season_status === 'active' ? 1 : b.season_name.localeCompare(a.season_name))),
    [standings.data],
  )
  const current = seasonsWithData.find((s) => s.season_id === seasonId) ?? seasonsWithData[0] ?? null

  useEffect(() => {
    if (pilot.data) document.title = `${pilot.data.pseudonym} — BLACKLANE`
  }, [pilot.data])

  const seasonResults = useMemo(
    () => (rankings.data ?? []).filter((r) => !current || r.season_id === current.season_id),
    [rankings.data, current],
  )
  const progression = useMemo(() => cumulativeProgression(seasonResults), [seasonResults])

  if (pilot.error) return <Container className="pb-20 pt-32"><ErrorState error={pilot.error} onRetry={pilot.reload} /></Container>
  if (pilot.loading) return <Container className="pb-20 pt-32"><LoadingBlock rows={6} /></Container>
  if (!pilot.data)
    return (
      <Container className="pb-20 pt-32">
        <EmptyState icon="user" title="Pilote introuvable" action={<LinkButton to="/classement" variant="outline">Retour au classement</LinkButton>}>
          Ce pilote n’existe pas ou n’est plus visible.
        </EmptyState>
      </Container>
    )

  const p = pilot.data
  return (
    <>
      <section className="asphalt relative overflow-hidden border-b border-ink-600 pb-12 pt-32 lg:pt-40">
        <div className="rain pointer-events-none absolute inset-0 opacity-50" />
        <span aria-hidden className="pointer-events-none absolute -right-6 bottom-[-0.2em] select-none font-display text-[clamp(8rem,26vw,22rem)] font-black italic uppercase leading-none text-white/[0.025]">
          {p.pseudonym}
        </span>
        <Container className="relative">
          <Link to="/classement" className="mb-8 inline-flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.18em] text-smoke hover:text-bone">
            <Icon name="arrowLeft" size={14} /> Classement
          </Link>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="reveal">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <RankBadge rank={p.rank} />
                {p.status !== 'active' && <span className="label">{PILOT_STATUS_LABEL[p.status]}</span>}
                {p.is_demo && <DemoBadge />}
              </div>
              <h1 className="display text-7xl text-bone sm:text-8xl lg:text-9xl">{p.pseudonym}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ash">
                {p.tag && (
                  <span className="border border-bone/30 bg-bone/90 px-2 py-0.5 font-mono text-sm font-bold text-ink-950">{p.tag}</span>
                )}
                {p.vehicle && (
                  <span className="inline-flex items-center gap-2"><Icon name="steering" size={16} className="text-smoke" /> {p.vehicle}</span>
                )}
              </div>
              {p.bio && <p className="mt-5 max-w-2xl text-ash">{p.bio}</p>}
            </div>
            {seasonsWithData.length > 1 && (
              <label className="block">
                <span className="label mb-1.5 block">Saison</span>
                <select className="field min-w-56" value={current?.season_id ?? ''} onChange={(e) => setSeasonId(e.target.value)}>
                  {seasonsWithData.map((s) => (
                    <option key={s.season_id} value={s.season_id}>{s.season_name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </Container>
      </section>

      <Container className="space-y-10 py-12">
        {standings.error ? (
          <ErrorState error={standings.error} onRetry={standings.reload} />
        ) : !current ? (
          <EmptyState icon="flag" title="Aucune course officielle">Ce pilote n’a pas encore de résultat publié.</EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile label="Position" value={ordinal(current.position)} accent={current.position <= 3} hint={current.season_name} />
            <StatTile label="Points cumulés" value={current.points} hint={current.adjustments ? `dont ${current.adjustments > 0 ? '+' : ''}${current.adjustments} de correction` : undefined} />
            <StatTile label="Participations" value={current.races} />
            <StatTile label="Victoires" value={current.wins} />
            <StatTile label="Podiums" value={current.podiums} hint={current.podium_rate != null ? `${current.podium_rate.toLocaleString('fr-FR')} % de podiums` : undefined} />
          </div>
        )}

        {stages.data && stages.data.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {stages.data.map((s) => (
              <span key={s.season_id + s.stage} className="inline-flex items-center gap-2 border border-ink-500 px-3 py-1.5 text-xs text-ash">
                <Icon name={s.stage === 'elite' ? 'crown' : s.stage === 'challenger' ? 'medal' : 'helmet'} size={14} className="text-blood-400" />
                {STAGE_LABEL[s.stage]}
                {s.group_label && <span className="font-mono text-smoke">· Groupe {s.group_label}</span>}
                {s.source === 'challenge' && <span className="text-smoke">· via Challenge</span>}
              </span>
            ))}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Progression des points" subtitle="Points cumulés après chaque épreuve de la saison">
            <LineChart
              labels={progression.map((p) => p.label)}
              series={[{ id: 'cum', name: 'Points cumulés', values: progression.map((p) => p.cumulative) }]}
            />
          </ChartCard>
          <ChartCard title="Position par épreuve" subtitle="1 = victoire · les abandons ne sont pas représentés">
            <LineChart
              labels={progression.map((p) => p.label)}
              series={[{ id: 'pos', name: 'Position', color: '#ece8e1', values: progression.map((p) => p.position) }]}
              invert
            />
          </ChartCard>
        </div>

        <section>
          <h2 className="display mb-4 text-3xl text-bone">Historique des résultats</h2>
          {rankings.error ? (
            <ErrorState error={rankings.error} onRetry={rankings.reload} />
          ) : rankings.loading ? (
            <LoadingBlock rows={4} />
          ) : !rankings.data?.length ? (
            <EmptyState icon="flag" title="Aucun résultat">Les résultats apparaîtront après la première course officielle.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-600">
                    {['Date', 'Épreuve', 'Phase', 'Résultat', 'Points'].map((h, i) => (
                      <th key={h} scope="col" className={cx('label px-3 py-3', i === 4 && 'text-right')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rankings.data.map((r) => (
                    <tr key={r.event_id} className="board-row border-b border-ink-700">
                      <td className="px-3 py-3 font-mono text-xs text-smoke">{formatShortDate(r.starts_at)}</td>
                      <td className="px-3 py-3">
                        <Link to={`/calendrier/${r.event_id}`} className="link-underline text-bone">{r.event_name}</Link>
                        <span className="ml-2 text-xs text-smoke">{KIND_LABEL[r.kind]}</span>
                      </td>
                      <td className="px-3 py-3 text-ash">{PHASE_SHORT[r.phase]}{r.group_label ? ` · Gr. ${r.group_label}` : ''}</td>
                      <td className="px-3 py-3">
                        {r.outcome === 'finished' ? (
                          <span className="inline-flex items-center gap-2"><PositionChip position={r.position} size="sm" /></span>
                        ) : (
                          <span className="font-display text-sm font-bold uppercase tracking-wider text-smoke">{OUTCOME_LABEL[r.outcome]}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular">
                        <span className="text-bone">{r.points}</span>
                        {r.adjustment !== 0 && <span className="ml-1 text-xs text-amber-400">({r.adjustment > 0 ? '+' : ''}{r.adjustment})</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </Container>
    </>
  )
}
