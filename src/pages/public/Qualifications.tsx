import { useEffect, useMemo, type ReactNode } from 'react'
import { Link } from '../../lib/router'
import { useData } from '../../hooks/useData'
import { getContent, getEvents, getGroupRanking, getPublicChallenges, getScales, getSeasons, getStageEntries, pickCurrentSeason } from '../../lib/api'
import { fillTemplate } from '../../lib/template'
import { formatShortDate } from '../../lib/format'
import { CHALLENGE_OUTCOME_LABEL, CHALLENGE_STATUS_LABEL, EVENT_STATUS_LABEL } from '../../lib/labels'
import type { BLEvent, GroupLabel, QualificationsContent, StageEntry } from '../../lib/types'
import { Container, PageHero, useSite } from '../../components/layout'
import { EmptyState, ErrorState, LoadingBlock, Skeleton } from '../../components/ui/primitives'
import { Icon, type IconName } from '../../components/ui/Icon'
import { cx } from '../../components/ui/cx'
import { ScaleTable } from '../../components/race/ScaleTable'
import { PositionChip } from '../../components/race/Badges'

function Block({ id, index, title, children, className }: { id?: string; index: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cx('scroll-mt-24 py-16', className)}>
      <Container>
        <div className="mb-10 flex items-end gap-5">
          <span className="font-display text-7xl font-black italic leading-none text-blood-500/90 sm:text-8xl">{index}</span>
          <h2 className="display pb-1 text-4xl text-bone sm:text-6xl">{title}</h2>
        </div>
        {children}
      </Container>
    </section>
  )
}

function Fact({ icon, value, label }: { icon: IconName; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-4 border border-ink-600 bg-ink-900/60 p-4">
      <Icon name={icon} size={26} className="shrink-0 text-blood-400" />
      <div>
        <p className="font-display text-3xl font-extrabold italic leading-none text-bone tabular">{value}</p>
        <p className="mt-1 text-xs uppercase tracking-wider text-smoke">{label}</p>
      </div>
    </div>
  )
}

function SessionsBoard({ sessions, stages, count }: { sessions: BLEvent[]; stages: StageEntry[]; count: number }) {
  const slots = Array.from({ length: Math.max(count, sessions.length) }, (_, i) => sessions.find((s) => s.session_number === i + 1) ?? null)
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {slots.map((s, i) => {
        const q = s ? stages.filter((st) => st.stage === 'runner' && st.source_event_id === s.id) : []
        return (
          <div key={i} className={cx('panel p-4', s?.status === 'completed' && 'border-ink-500')}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-smoke">SESSION {String(i + 1).padStart(2, '0')}</span>
              {s && <span className={cx('text-[0.68rem] uppercase tracking-wider', s.status === 'completed' ? 'text-smoke' : 'text-blood-400')}>{EVENT_STATUS_LABEL[s.status]}</span>}
            </div>
            {s ? (
              <Link to={`/calendrier/${s.id}`} className="display link-underline mt-2 block text-2xl text-bone">{s.name}</Link>
            ) : (
              <p className="display mt-2 text-2xl text-ink-400">À programmer</p>
            )}
            {s?.starts_at && <p className="mt-1 text-xs text-smoke">{formatShortDate(s.starts_at)}</p>}
            <ul className="mt-4 space-y-1.5">
              {q.length
                ? q.map((st) => (
                    <li key={st.pilot_id} className="flex items-center gap-2 text-sm">
                      <Icon name="check" size={14} className="text-blood-400" />
                      <Link to={`/pilotes/${st.pilot_id}`} className="text-bone hover:text-white">{st.pseudonym}</Link>
                    </li>
                  ))
                : Array.from({ length: 3 }).map((_, j) => <li key={j} className="h-5 border-b border-dashed border-ink-600" />)}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

function GroupBoard({ seasonId, group, events }: { seasonId: string; group: GroupLabel; events: BLEvent[] }) {
  const { settings } = useSite()
  const ranking = useData(() => getGroupRanking(seasonId, group), [seasonId, group])
  const gEvents = events.filter((e) => e.group_label === group && (e.kind === 'urban_run' || e.kind === 'navigation'))
  const cut = settings?.finalists_per_group ?? 3
  return (
    <div className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="display text-3xl text-bone">Groupe {group}</p>
        <span className="text-xs text-smoke">Top {cut} → finale</span>
      </div>
      {ranking.error ? (
        <ErrorState error={ranking.error} onRetry={ranking.reload} />
      ) : ranking.loading ? (
        <LoadingBlock rows={6} />
      ) : !ranking.data?.length ? (
        <p className="text-sm text-smoke">Groupe non constitué.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-600">
              <th className="label py-2 text-left">Pilote</th>
              {gEvents.map((e) => (
                <th key={e.id} className="label py-2 text-right">{e.kind === 'urban_run' ? 'Urban' : 'Nav.'}</th>
              ))}
              <th className="label py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {ranking.data.map((r, i) => (
              <tr key={r.pilot_id} className={cx('border-b border-ink-700', i === cut - 1 && 'border-b-blood-500/60')}>
                <td className="py-2">
                  <span className="inline-flex items-center gap-2">
                    <PositionChip position={r.tie_rank} size="sm" />
                    <Link to={`/pilotes/${r.pilot_id}`} className={cx('display text-lg', i < cut ? 'text-bone' : 'text-ash')}>{r.pseudonym}</Link>
                  </span>
                </td>
                {gEvents.map((e) => (
                  <td key={e.id} className="py-2 text-right font-mono text-ash tabular">
                    {e.status === 'completed' ? r.points_by_event[e.id] ?? 0 : '—'}
                  </td>
                ))}
                <td className="py-2 text-right font-display text-xl font-extrabold italic text-bone tabular">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function Qualifications({ preview }: { preview?: QualificationsContent }) {
  const { vars, settings } = useSite()
  const content = useData(async () => preview ?? (await getContent('qualifications')), [preview])
  const scales = useData(() => getScales(), [])
  const seasons = useData(() => getSeasons(), [])
  const season = seasons.data ? pickCurrentSeason(seasons.data) : null
  const events = useData(async () => (season ? getEvents(season.id) : []), [season?.id])
  const stages = useData(async () => (season ? getStageEntries(season.id) : []), [season?.id])
  const challenges = useData(() => getPublicChallenges(6), [])

  useEffect(() => {
    if (!preview) document.title = 'Qualifications — BLACKLANE'
  }, [preview])

  const scale = useMemo(() => {
    const list = scales.data ?? []
    return list.find((s) => s.id === season?.scale_id) ?? list.find((s) => s.is_default) ?? null
  }, [scales.data, season?.scale_id])

  const c = (preview ?? content.data) as QualificationsContent | null | undefined

  useEffect(() => {
    if (c && !preview && window.location.hash) {
      const el = document.getElementById(window.location.hash.slice(1))
      setTimeout(() => el?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    }
  }, [c])
  const t = (s: string | undefined) => fillTemplate(s, vars)
  const sessions = (events.data ?? []).filter((e) => e.kind === 'qualification')
  const groups = (['A', 'B', 'C', 'D'] as GroupLabel[]).slice(0, settings?.elite_group_count ?? 2)
  const finalists = (stages.data ?? []).filter((s) => s.stage === 'challenger')
  const elites = (stages.data ?? []).filter((s) => s.stage === 'elite')
  const runners = (stages.data ?? []).filter((s) => s.stage === 'runner')
  const groupsFormed = runners.some((r) => r.group_label)

  if (content.error) return <Container className="pb-20 pt-32"><ErrorState error={content.error} onRetry={content.reload} /></Container>
  if (!c) return <Container className="pb-20 pt-32"><LoadingBlock rows={6} /></Container>

  return (
    <>
      <PageHero kicker="Le processus de sélection" title="Qualifications">{t(c.intro)}</PageHero>

      <nav aria-label="Sommaire" className="sticky top-16 z-30 border-b border-ink-700 bg-ink-950/90 backdrop-blur lg:top-[72px]">
        <Container className="scrollbar-none flex gap-6 overflow-x-auto py-3 text-xs">
          {[
            ['#phase-1', 'Qualifications'],
            ['#phase-elite', 'Phase Élite'],
            ['#finale', 'Finale'],
            ['#challenge', 'Challenge Elite'],
            ['#deroule', 'Déroulé'],
          ].map(([href, label]) => (
            <a key={href} href={href} className="whitespace-nowrap font-display font-bold uppercase tracking-[0.18em] text-smoke hover:text-blood-400">{label}</a>
          ))}
        </Container>
      </nav>

      <Block id="phase-1" index="01" title={c.phase1.title.replace(/^Phase 1 — /, '')}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <p className="text-lg leading-relaxed text-ash">{t(c.phase1.text)}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Fact icon="flag" value={settings?.sessions_count ?? '—'} label="Sessions" />
              <Fact icon="users" value={settings?.max_pilots_per_session ?? '—'} label="Pilotes max. / session" />
              <Fact icon="check" value={settings?.qualifiers_per_session ?? '—'} label="Qualifiés / session" />
            </div>
            <p className="display mt-8 border-l-2 border-blood-500 pl-4 text-2xl text-bone">{t(c.phase1.summary)}</p>
          </div>
          <div className="panel p-5">
            <p className="label mb-3">Barème de points{scale ? ` — ${scale.name}` : ''}</p>
            {scales.loading ? <Skeleton className="h-72" /> : scale ? <ScaleTable entries={scale.entries} /> : <p className="text-sm text-smoke">Barème non défini.</p>}
          </div>
        </div>
        {season && (
          <div className="mt-12">
            <p className="label mb-4">{season.name} — état des sessions</p>
            {events.loading || stages.loading ? <LoadingBlock rows={2} /> : <SessionsBoard sessions={sessions} stages={stages.data ?? []} count={settings?.sessions_count ?? 4} />}
          </div>
        )}
      </Block>

      <Block id="phase-elite" index="02" title={c.phase2.title.replace(/^Phase 2 — /, '')} className="asphalt border-y border-ink-700">
        <p className="max-w-3xl text-lg leading-relaxed text-ash">{t(c.phase2.text)}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            { k: c.urban_run, icon: 'bolt' as IconName },
            { k: c.navigation, icon: 'gps' as IconName },
          ].map(({ k, icon }) => (
            <div key={k.title} className="panel p-6">
              <Icon name={icon} size={30} className="text-blood-400" />
              <p className="display mt-4 text-4xl text-bone">{k.title}</p>
              <p className="mt-3 leading-relaxed text-ash">{t(k.text)}</p>
            </div>
          ))}
        </div>
        {season && groupsFormed && (
          <div className="mt-12">
            <p className="label mb-4">{season.name} — classement des groupes (points cumulés)</p>
            <div className="grid gap-4 lg:grid-cols-2">
              {groups.map((g) => <GroupBoard key={g} seasonId={season.id} group={g} events={events.data ?? []} />)}
            </div>
          </div>
        )}
        <div className="mt-10 border border-ink-600 bg-ink-950/60 p-5">
          <p className="label mb-2">{c.tiebreak.title}</p>
          <p className="text-sm text-ash">{t(c.tiebreak.text)}</p>
        </div>
      </Block>

      <Block id="finale" index="03" title={c.finale.title}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_1fr]">
          <p className="display text-3xl leading-tight text-bone sm:text-4xl">{t(c.finale.text)}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="panel p-5">
              <p className="label mb-3">Finalistes</p>
              {finalists.length ? (
                <ul className="space-y-1.5">{finalists.map((f) => <li key={f.pilot_id}><Link to={`/pilotes/${f.pilot_id}`} className="display text-xl text-bone hover:text-white">{f.pseudonym}</Link></li>)}</ul>
              ) : (
                <p className="text-sm text-smoke">Désignés à l’issue de la phase Élite.</p>
              )}
            </div>
            <div className="panel border-blood-600/60 p-5">
              <p className="kicker mb-3">Elite de la saison</p>
              {elites.length ? (
                <ul className="space-y-1.5">{elites.map((f) => <li key={f.pilot_id} className="flex items-center gap-2"><Icon name="crown" size={16} className="text-blood-400" /><Link to={`/pilotes/${f.pilot_id}`} className="display text-xl text-bone hover:text-white">{f.pseudonym}</Link></li>)}</ul>
              ) : (
                <p className="text-sm text-smoke">Couronnés à l’issue de la finale.</p>
              )}
            </div>
          </div>
        </div>
      </Block>

      <Block id="challenge" index="04" title={c.challenge.title} className="border-y border-ink-700 bg-ink-900">
        <p className="max-w-3xl text-lg text-ash">{t(c.challenge.text)}</p>
        <ol className="mt-8 grid gap-3 md:grid-cols-4">
          {c.challenge.steps.map((s, i) => (
            <li key={i} className="panel p-5">
              <span className="grid size-9 place-items-center rounded-full border border-blood-500 font-display text-lg font-bold text-blood-400">{i + 1}</span>
              <p className="mt-4 text-sm leading-relaxed text-ash">{t(s)}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <p className="flex items-start gap-3 border border-emerald-400/30 bg-emerald-400/[0.05] p-4 text-sm text-ash"><Icon name="trophy" className="shrink-0 text-emerald-400" />{t(c.challenge.win)}</p>
          <p className="flex items-start gap-3 border border-blood-500/40 bg-blood-500/[0.06] p-4 text-sm text-ash"><Icon name="lock" className="shrink-0 text-blood-400" />{t(c.challenge.lose)}</p>
        </div>
        <div className="mt-10">
          <p className="label mb-4">Derniers Challenges Elite</p>
          {challenges.error ? (
            <ErrorState error={challenges.error} onRetry={challenges.reload} />
          ) : challenges.loading ? (
            <LoadingBlock rows={2} />
          ) : !challenges.data?.length ? (
            <EmptyState icon="swords" title="Aucun duel annoncé">Les duels programmés et leurs résultats apparaîtront ici.</EmptyState>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {challenges.data.map((ch) => (
                <li key={ch.id} className="flex flex-wrap items-center justify-between gap-3 border border-ink-600 bg-ink-950/50 px-4 py-3">
                  <span className="display text-xl">
                    <span className={ch.winner_id === ch.challenger_id ? 'text-blood-400' : 'text-bone'}>{ch.challenger_pseudonym}</span>
                    <span className="mx-2 font-mono text-sm not-italic text-smoke">vs</span>
                    <span className={ch.winner_id === ch.elite_id ? 'text-blood-400' : 'text-bone'}>{ch.elite_pseudonym}</span>
                  </span>
                  <span className="text-xs text-smoke">
                    {ch.status === 'completed' && ch.outcome ? CHALLENGE_OUTCOME_LABEL[ch.outcome] : `${CHALLENGE_STATUS_LABEL[ch.status]}${ch.scheduled_at ? ' · ' + formatShortDate(ch.scheduled_at) : ''}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Block>

      <Block id="deroule" index="05" title={c.calendar.title}>
        <ol className="grid gap-px bg-ink-600 sm:grid-cols-2 lg:grid-cols-4">
          {c.calendar.items.map((it, i) => (
            <li key={i} className={cx('bg-ink-950 p-5', i === c.calendar.items.length - 2 && 'bg-blood-900/40')}>
              <p className="font-mono text-xs text-blood-400">{it.label}</p>
              <p className="display mt-2 text-2xl text-bone">{it.text}</p>
            </li>
          ))}
        </ol>
      </Block>
    </>
  )
}
