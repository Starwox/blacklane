import { useEffect, useMemo } from 'react'
import { useData } from '../../hooks/useData'
import { useSearchParams } from '../../lib/router'
import { getSeasonRankings, getSeasons, getStandings, pickCurrentSeason } from '../../lib/api'
import { aggregateStandings } from '../../lib/scoring'
import { PHASE_SHORT, RANK_LABEL, RANKS, SEASON_STATUS_LABEL } from '../../lib/labels'
import type { EventPhase, PilotRank, PilotStatus } from '../../lib/types'
import { Container, PageHero } from '../../components/layout'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/primitives'
import { Icon } from '../../components/ui/Icon'
import { Segmented } from '../../components/ui/Form'
import { StandingsTable, type SortKey, type StandingRow } from '../../components/race/StandingsTable'

type View = 'general' | Extract<EventPhase, 'qualifications' | 'elite' | 'finale'>
const VIEWS: { value: View; label: string }[] = [
  { value: 'general', label: 'Général' },
  { value: 'qualifications', label: PHASE_SHORT.qualifications },
  { value: 'elite', label: PHASE_SHORT.elite },
  { value: 'finale', label: PHASE_SHORT.finale },
]

export default function Standings() {
  const [params, setParams] = useSearchParams()
  const seasons = useData(() => getSeasons(), [])
  const seasonId = params.get('saison') ?? (seasons.data ? pickCurrentSeason(seasons.data)?.id : undefined) ?? null
  const season = seasons.data?.find((s) => s.id === seasonId) ?? null
  const view = (params.get('vue') as View) || 'general'
  const sort = (params.get('tri') as SortKey) || 'position'
  const q = params.get('q') ?? ''
  const rank = (params.get('rang') as PilotRank | null) ?? ''
  const status = params.get('statut') ?? 'actifs'

  const general = useData(async () => (seasonId ? getStandings(seasonId) : []), [seasonId])
  const rankings = useData(async () => (seasonId && view !== 'general' ? getSeasonRankings(seasonId) : []), [seasonId, view])

  useEffect(() => {
    document.title = 'Classement — BLACKLANE'
  }, [])

  const rows: StandingRow[] = useMemo(() => {
    const info = new Map((general.data ?? []).map((s) => [s.pilot_id, s]))
    let base: (StandingRow & { pilot_status?: PilotStatus })[]
    if (view === 'general') {
      base = (general.data ?? []).map((s) => ({ ...s }))
    } else {
      base = aggregateStandings((rankings.data ?? []).filter((r) => r.phase === view)).map((a) => {
        const s = info.get(a.pilot_id)
        return { ...a, tag: s?.tag ?? null, rank: s?.rank, is_demo: s?.is_demo, pilot_status: s?.pilot_status }
      })
    }
    return base
      .filter((r) => (status === 'tous' ? true : status === 'archives' ? r.pilot_status === 'archived' : r.pilot_status !== 'archived'))
      .filter((r) => (rank ? r.rank === rank : true))
      .filter((r) => (q ? r.pseudonym.toLowerCase().includes(q.trim().toLowerCase()) : true))
  }, [general.data, rankings.data, view, status, rank, q])

  const loading = seasons.loading || general.loading || (view !== 'general' && rankings.loading)
  const error = seasons.error || general.error || rankings.error

  return (
    <>
      <PageHero kicker={season ? `${season.name} · ${SEASON_STATUS_LABEL[season.status]}` : 'Classement'} title="Classement">
        Les points officiels de chaque pilote, calculés à partir des résultats publiés et du barème de la saison.
      </PageHero>
      <Container className="py-12">
        <div className="panel-flat mb-6 grid gap-4 p-4 lg:grid-cols-[auto_1fr_auto_auto_auto] lg:items-end">
          <label className="block">
            <span className="label mb-1.5 block">Saison</span>
            <select className="field min-w-52" value={seasonId ?? ''} onChange={(e) => setParams({ saison: e.target.value })} disabled={!seasons.data?.length}>
              {(seasons.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.status === 'closed' ? '(archive)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label mb-1.5 block">Rechercher un pilote</span>
            <span className="relative block">
              <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-smoke" />
              <input className="field pl-9" type="search" placeholder="Pseudonyme…" value={q} onChange={(e) => setParams({ q: e.target.value })} />
            </span>
          </label>
          <label className="block">
            <span className="label mb-1.5 block">Rang</span>
            <select className="field" value={rank} onChange={(e) => setParams({ rang: e.target.value })}>
              <option value="">Tous les rangs</option>
              {RANKS.map((r) => <option key={r} value={r}>{RANK_LABEL[r]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label mb-1.5 block">Statut</span>
            <select className="field" value={status} onChange={(e) => setParams({ statut: e.target.value === 'actifs' ? null : e.target.value })}>
              <option value="actifs">Pilotes en activité</option>
              <option value="archives">Archivés</option>
              <option value="tous">Tous</option>
            </select>
          </label>
          <label className="block">
            <span className="label mb-1.5 block">Trier par</span>
            <select className="field" value={sort} onChange={(e) => setParams({ tri: e.target.value === 'position' ? null : e.target.value })}>
              <option value="position">Points</option>
              <option value="wins">Victoires</option>
              <option value="podiums">Podiums</option>
              <option value="races">Courses disputées</option>
            </select>
          </label>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Segmented label="Classement" value={view} onChange={(v) => setParams({ vue: v === 'general' ? null : v })} options={VIEWS} />
          <p className="text-xs text-smoke">
            {view === 'general'
              ? 'Classement général : toutes les épreuves de la saison, corrections officielles incluses.'
              : `Points obtenus uniquement sur les épreuves « ${PHASE_SHORT[view]} ».`}
          </p>
        </div>

        {error ? (
          <ErrorState error={error} onRetry={() => { void seasons.reload(); void general.reload(); void rankings.reload() }} />
        ) : loading ? (
          <LoadingBlock rows={8} />
        ) : !seasons.data?.length ? (
          <EmptyState icon="calendar" title="Aucune saison">Le classement apparaîtra dès l’ouverture de la première saison.</EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState icon="search" title="Aucun pilote">
            {q || rank || status !== 'actifs' ? 'Aucun pilote ne correspond à ces filtres.' : 'Aucun résultat officiel n’a encore été publié pour cette sélection.'}
          </EmptyState>
        ) : (
          <StandingsTable rows={rows} sort={sort} onSortChange={(k) => setParams({ tri: k === 'position' ? null : k })} caption="Classement des pilotes" />
        )}
        <p className="mt-6 text-xs text-smoke">
          En cas d’égalité de points, les pilotes partagent la même position. Seuls les pseudonymes RP sont affichés.
        </p>
      </Container>
    </>
  )
}
