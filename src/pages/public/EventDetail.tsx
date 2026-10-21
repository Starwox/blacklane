import { useEffect } from 'react'
import { Link, useParams } from '../../lib/router'
import { useData } from '../../hooks/useData'
import { getEvent, getEventRankings, getParticipants, getStageEntries } from '../../lib/api'
import { formatDateTime, formatShortDate, formatTime } from '../../lib/format'
import { OUTCOME_LABEL, PHASE_LABEL } from '../../lib/labels'
import { Container } from '../../components/layout'
import { EmptyState, ErrorState, LoadingBlock, Notice, DemoBadge } from '../../components/ui/primitives'
import { Icon } from '../../components/ui/Icon'
import { LinkButton } from '../../components/ui/Button'
import { cx } from '../../components/ui/cx'
import { RichText } from '../../components/race/RichText'
import { EventStatusBadge, KindLabel, PositionChip, RankBadge } from '../../components/race/Badges'

export default function EventDetail() {
  const { id } = useParams<{ id: string }>()
  const event = useData(() => getEvent(id), [id])
  const participants = useData(() => getParticipants(id), [id])
  const results = useData(() => getEventRankings([id]), [id])
  const seasonId = event.data?.season_id
  const stages = useData(async () => (seasonId ? getStageEntries(seasonId) : []), [seasonId])

  useEffect(() => {
    if (event.data) document.title = `${event.data.name} — BLACKLANE`
  }, [event.data])

  if (event.error) return <Container className="pb-20 pt-32"><ErrorState error={event.error} onRetry={event.reload} /></Container>
  if (event.loading) return <Container className="pb-20 pt-32"><LoadingBlock rows={5} /></Container>
  if (!event.data)
    return (
      <Container className="pb-20 pt-32">
        <EmptyState icon="calendar" title="Événement introuvable" action={<LinkButton to="/calendrier" variant="outline">Retour au calendrier</LinkButton>}>
          Cet événement n’existe pas ou n’a pas encore été publié.
        </EmptyState>
      </Container>
    )

  const e = event.data
  const qualified = new Set((stages.data ?? []).filter((s) => s.stage === 'runner' && s.source_event_id === e.id).map((s) => s.pilot_id))
  const finished = (results.data ?? []).filter((r) => r.outcome === 'finished')
  const others = (results.data ?? []).filter((r) => r.outcome !== 'finished')

  return (
    <>
      <section className="asphalt relative overflow-hidden border-b border-ink-600 pb-12 pt-32 lg:pt-40">
        <div className="rain pointer-events-none absolute inset-0 opacity-50" />
        <Container className="relative">
          <Link to="/calendrier" className="mb-8 inline-flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.18em] text-smoke hover:text-bone">
            <Icon name="arrowLeft" size={14} /> Calendrier
          </Link>
          <div className="reveal flex flex-wrap items-center gap-3">
            <KindLabel kind={e.kind} />
            <EventStatusBadge status={e.status} />
            {e.is_demo && <DemoBadge />}
          </div>
          <h1 className={cx('display reveal mt-4 text-6xl text-bone sm:text-7xl lg:text-8xl', e.status === 'cancelled' && 'line-through decoration-blood-500/70')}>{e.name}</h1>
          <p className="reveal mt-3 font-display text-sm font-bold uppercase tracking-[0.2em] text-blood-400">
            {PHASE_LABEL[e.phase]}
            {e.session_number ? ` · Session ${e.session_number}` : ''}
            {e.group_label ? ` · Groupe ${e.group_label}` : ''}
          </p>
        </Container>
      </section>

      <Container className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-10">
          {e.status === 'cancelled' && (
            <Notice tone="danger" title="Événement annulé">{e.status_note || 'Cet événement a été annulé par les organisateurs.'}</Notice>
          )}
          {e.status === 'postponed' && (
            <Notice tone="warning" title="Événement reporté">
              {e.postponed_from && <>Initialement prévu le {formatShortDate(e.postponed_from)} à {formatTime(e.postponed_from)}. </>}
              {e.starts_at ? <>Nouvelle date : {formatDateTime(e.starts_at)}. </> : 'Nouvelle date à confirmer. '}
              {e.status_note}
            </Notice>
          )}

          {e.description && (
            <section>
              <h2 className="label mb-3">Présentation</h2>
              <RichText text={e.description} />
            </section>
          )}

          {e.status === 'completed' ? (
            <section>
              <h2 className="display mb-4 text-4xl text-bone">Résultats officiels</h2>
              {results.error ? (
                <ErrorState error={results.error} onRetry={results.reload} />
              ) : results.loading ? (
                <LoadingBlock rows={5} />
              ) : !results.data?.length ? (
                <EmptyState icon="flag" title="Résultats non publiés">Les résultats de cette épreuve n’ont pas encore été saisis.</EmptyState>
              ) : (
                <>
                  <ol className="space-y-1.5">
                    {[...finished, ...others].map((r) => (
                      <li key={r.pilot_id} className={cx('board-row flex items-center gap-4 border border-ink-600 px-3 py-2.5', r.position === 1 && 'border-l-2 border-l-blood-500 bg-blood-500/[0.07]')}>
                        {r.outcome === 'finished' ? (
                          <PositionChip position={r.position} size="md" />
                        ) : (
                          <span className="chamfer-sm grid size-9 place-items-center border border-ink-600 font-mono text-[0.62rem] text-smoke">{r.outcome.toUpperCase()}</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <Link to={`/pilotes/${r.pilot_id}`} className="display link-underline text-2xl text-bone">{r.pseudonym}</Link>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-smoke">
                            {r.outcome !== 'finished' && <span>{OUTCOME_LABEL[r.outcome]}</span>}
                            {r.time_label && <span className="font-mono">{r.time_label}</span>}
                            {e.kind === 'navigation' && r.checkpoint_ok != null && (
                              <span className={r.checkpoint_ok ? 'text-emerald-400' : 'text-blood-300'}>Checkpoint {r.checkpoint_ok ? 'validé' : 'manqué'}</span>
                            )}
                            {r.adjustment !== 0 && <span className="text-amber-400">Correction {r.adjustment > 0 ? '+' : ''}{r.adjustment}</span>}
                          </div>
                        </div>
                        {qualified.has(r.pilot_id) && (
                          <span className="hidden border border-blood-500/70 bg-blood-500/10 px-2 py-0.5 font-display text-[0.68rem] font-bold uppercase tracking-[0.14em] text-blood-300 sm:inline">Qualifié</span>
                        )}
                        <span className="text-right">
                          <span className="font-display text-2xl font-extrabold italic text-bone tabular">{r.points}</span>
                          <span className="ml-1 text-[0.65rem] uppercase text-smoke">pts</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  {qualified.size > 0 && (
                    <p className="mt-4 text-sm text-ash">
                      <span className="text-blood-400">{qualified.size} pilotes qualifiés</span> pour la phase Élite à l’issue de cette session.
                    </p>
                  )}
                </>
              )}
            </section>
          ) : (
            <section>
              <h2 className="display mb-4 text-4xl text-bone">Pilotes engagés</h2>
              {participants.error ? (
                <ErrorState error={participants.error} onRetry={participants.reload} />
              ) : participants.loading ? (
                <LoadingBlock rows={3} />
              ) : !participants.data?.length ? (
                <EmptyState icon="users" title="Liste non communiquée">La liste des pilotes sera publiée par les organisateurs.</EmptyState>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {participants.data.map((p) => (
                    <li key={p.pilot_id} className="flex items-center justify-between gap-3 border border-ink-600 px-4 py-3">
                      <Link to={`/pilotes/${p.pilot_id}`} className="display link-underline text-xl text-bone">{p.pilots?.pseudonym ?? 'Pilote'}</Link>
                      {p.pilots && <RankBadge rank={p.pilots.rank} />}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="panel p-5">
            <p className="label mb-4">Informations</p>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="flex items-center gap-2 text-smoke"><Icon name="clock" size={15} /> Date et heure</dt>
                <dd className="mt-1 text-bone">{formatDateTime(e.starts_at)}</dd>
              </div>
              {e.location_rp && (
                <div>
                  <dt className="flex items-center gap-2 text-smoke"><Icon name="pin" size={15} /> Lieu RP</dt>
                  <dd className="mt-1 text-bone">{e.location_rp}</dd>
                </div>
              )}
              {e.capacity && (
                <div>
                  <dt className="flex items-center gap-2 text-smoke"><Icon name="users" size={15} /> Places</dt>
                  <dd className="mt-1 text-bone tabular">
                    {participants.data ? `${participants.data.length} / ${e.capacity}` : e.capacity} pilotes
                  </dd>
                </div>
              )}
              {!e.counts_for_standings && (
                <div>
                  <dt className="flex items-center gap-2 text-smoke"><Icon name="info" size={15} /> Classement</dt>
                  <dd className="mt-1 text-ash">Épreuve hors classement général.</dd>
                </div>
              )}
            </dl>
          </div>
          {e.participation_info && (
            <div className="panel-flat p-5">
              <p className="label mb-3">Modalités de participation</p>
              <RichText text={e.participation_info} />
            </div>
          )}
          {(e.kind === 'urban_run' || e.kind === 'navigation') && (
            <LinkButton to="/qualifications#phase-elite" variant="outline" className="w-full" icon={<Icon name="layers" size={15} />}>
              Classement du groupe
            </LinkButton>
          )}
        </aside>
      </Container>
    </>
  )
}
