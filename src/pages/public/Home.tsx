import { useEffect, useMemo, useState } from 'react'
import { Link } from '../../lib/router'
import { useData } from '../../hooks/useData'
import { getContent, getEvents, getLatestResults, getSeasons, getStandings, pickCurrentSeason, upcomingEvents } from '../../lib/api'
import { formatDate, formatDateTime, formatNumber } from '../../lib/format'
import { fillTemplate } from '../../lib/template'
import { KIND_LABEL } from '../../lib/labels'
import type { BLEvent, HomeContent } from '../../lib/types'
import { Container, useSite } from '../../components/layout'
import { HeroBackdrop, HeroCar } from '../../components/brand/HeroScene'
import { LinkButton } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { EmptyState, ErrorState, LoadingBlock, SectionHeading, Skeleton } from '../../components/ui/primitives'
import { cx } from '../../components/ui/cx'
import { EventCard } from '../../components/race/EventCard'
import { StandingsTable } from '../../components/race/StandingsTable'
import { PhaseTimeline } from '../../components/race/PhaseTimeline'
import { EventStatusBadge, KindLabel, PositionChip } from '../../components/race/Badges'

function useCountdown(target: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!target) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [target])
  if (!target) return null
  const diff = new Date(target).getTime() - now
  if (diff <= 0) return null
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return { d, h, m, s }
}

function NextEventPanel({ event }: { event: BLEvent }) {
  const cd = useCountdown(event.status === 'cancelled' ? null : event.starts_at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <Link
      to={`/calendrier/${event.id}`}
      className="panel group block w-full max-w-sm bg-ink-950/70 p-5 backdrop-blur-md transition-colors hover:border-blood-500/60"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="kicker">Prochain événement</span>
        <EventStatusBadge status={event.status} />
      </div>
      <p className="display mt-3 text-3xl text-bone">{event.name}</p>
      <div className="mt-1"><KindLabel kind={event.kind} /></div>
      <p className="mt-3 text-sm text-ash">{formatDateTime(event.starts_at)}</p>
      {cd && (
        <div className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Compte à rebours">
          {[
            [cd.d, 'jours'],
            [cd.h, 'h'],
            [cd.m, 'min'],
            [cd.s, 's'],
          ].map(([v, l]) => (
            <div key={l as string} className="border border-ink-600 bg-ink-900/80 py-2 text-center">
              <p className="font-mono text-xl font-bold text-bone tabular">{pad(v as number)}</p>
              <p className="text-[0.6rem] uppercase tracking-widest text-smoke">{l}</p>
            </div>
          ))}
        </div>
      )}
      <span className="mt-4 inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-[0.16em] text-smoke group-hover:text-blood-400">
        Détails <Icon name="arrowRight" size={14} />
      </span>
    </Link>
  )
}

function Hero({ c, next }: { c: HomeContent['hero']; next: BLEvent | null | undefined }) {
  const secondaryHref = c.secondary_cta.href || (next ? `/calendrier/${next.id}` : '/calendrier')
  return (
    <section className="grain relative isolate flex min-h-[100svh] items-end overflow-hidden bg-ink-950 pb-14 pt-28 lg:items-center lg:pb-20">
      <div className="absolute inset-0 -z-20">
        {c.image_url ? (
          <img src={c.image_url} alt={c.image_alt} className="h-full w-full object-cover object-center opacity-70" fetchPriority="high" />
        ) : (
          <>
            <HeroBackdrop />
            <HeroCar className="absolute bottom-[6%] left-1/2 w-[135%] max-w-none -translate-x-1/2 opacity-60 sm:w-[95%] lg:bottom-[4%] lg:left-auto lg:right-[-4%] lg:w-[64%] lg:translate-x-0 lg:opacity-100" />
          </>
        )}
      </div>
      <div className="rain pointer-events-none absolute inset-0 -z-10 opacity-70" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-ink-950 via-ink-950/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-ink-950 via-ink-950/60 to-transparent" />

      <Container className="w-full">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="max-w-3xl">
            <p className="kicker reveal mb-6 flex items-center gap-3">
              <span className="h-px w-10 bg-blood-500" />
              {c.kicker}
            </p>
            <h1 className="reveal select-none font-display font-black italic uppercase leading-[0.82] tracking-[-0.02em] text-[clamp(4.3rem,15vw,11rem)]" style={{ animationDelay: '80ms' }}>
              <span className="text-bone">{c.title_left}</span>
              <span className="text-blood-500 text-shadow-glow">{c.title_right}</span>
            </h1>
            <div className="reveal mt-6 space-y-1 font-display text-2xl font-semibold uppercase tracking-[0.12em] sm:text-3xl" style={{ animationDelay: '180ms' }}>
              <p className="text-bone/90">{c.tagline_1}</p>
              <p className="text-blood-400">{c.tagline_2}</p>
            </div>
            <p className="reveal mt-8 inline-block border border-ink-500 bg-ink-950/60 px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.24em] text-ash backdrop-blur sm:text-base" style={{ animationDelay: '260ms' }}>
              {c.motto}
            </p>
            <div className="reveal mt-10 flex flex-wrap gap-3" style={{ animationDelay: '340ms' }}>
              <LinkButton to={c.primary_cta.href || '/classement'} size="lg" icon={<Icon name="trophy" size={16} />}>
                {c.primary_cta.label}
              </LinkButton>
              <LinkButton to={secondaryHref} size="lg" variant="outline" icon={<Icon name="calendar" size={16} />}>
                {c.secondary_cta.label}
              </LinkButton>
            </div>
          </div>
          <div className="reveal hidden lg:block" style={{ animationDelay: '420ms' }}>
            {next && <NextEventPanel event={next} />}
          </div>
        </div>
      </Container>
    </section>
  )
}

function Announcement({ a }: { a: HomeContent['announcement'] }) {
  if (!a.enabled || !a.text.trim()) return null
  return (
    <div className={cx('border-y', a.tone === 'alert' ? 'border-blood-600 bg-blood-900/60' : 'border-ink-600 bg-ink-850')}>
      <Container className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-3 text-bone">
          <Icon name={a.tone === 'alert' ? 'alert' : 'info'} className={a.tone === 'alert' ? 'text-blood-400' : 'text-smoke'} />
          {a.text}
        </p>
        {a.link_href && a.link_label && (
          <Link to={a.link_href} className="inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-[0.16em] text-blood-400 hover:text-blood-300">
            {a.link_label} <Icon name="arrowRight" size={14} />
          </Link>
        )}
      </Container>
    </div>
  )
}

function StatsSection({ c }: { c: HomeContent['stats'] }) {
  const { stats } = useSite()
  // Ordre fixe : l'ordre des clés n'est pas conservé par le stockage JSON
  const order: (keyof HomeContent['stats']['items'])[] = ['races_completed', 'pilots_participated', 'pilots_ranked', 'upcoming_events']
  const items = order.filter((k) => c.items[k]?.enabled).map((k) => [k, c.items[k]] as const)
  if (!items.length) return null
  return (
    <section aria-labelledby="stats-title" className="border-b border-ink-700 bg-ink-950 py-14">
      <Container>
        <h2 id="stats-title" className="label mb-6">{c.title}</h2>
        <div className={cx('grid gap-px bg-ink-600', items.length >= 4 ? 'grid-cols-2 lg:grid-cols-4' : items.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2')}>
          {items.map(([key, v], i) => (
            <div key={key} className="bg-ink-950 p-5 sm:p-7">
              <p className="font-mono text-[0.7rem] text-smoke">0{i + 1}</p>
              {stats ? (
                <p className={cx('mt-2 font-display text-6xl font-black italic leading-none tabular sm:text-7xl', i === 0 ? 'text-blood-400' : 'text-bone')}>
                  {formatNumber(stats[key] ?? 0)}
                </p>
              ) : (
                <Skeleton className="mt-3 h-14 w-24" />
              )}
              <p className="mt-3 font-display text-sm font-bold uppercase tracking-[0.16em] text-ash">{v.label}</p>
            </div>
          ))}
        </div>
        {stats && stats.races_completed === 0 && (
          <p className="mt-4 text-sm text-smoke">Aucune course n’a encore été enregistrée : les compteurs se mettront à jour après la première épreuve.</p>
        )}
      </Container>
    </section>
  )
}

function StandingsSection({ c }: { c: HomeContent['standings'] }) {
  const seasons = useData(() => getSeasons(), [])
  const season = seasons.data ? pickCurrentSeason(seasons.data) : null
  const standings = useData(async () => (season ? getStandings(season.id) : []), [season?.id])
  const rows = (standings.data ?? []).filter((r) => r.pilot_status !== 'archived').slice(0, c.limit)
  return (
    <section className="py-20">
      <Container>
        <SectionHeading
          kicker={season ? season.name : 'Saison'}
          title={c.title}
          action={<LinkButton to="/classement" variant="outline" icon={<Icon name="list" size={15} />}>Voir le classement complet</LinkButton>}
        >
          {c.subtitle}
        </SectionHeading>
        {seasons.error || standings.error ? (
          <ErrorState error={seasons.error || standings.error} onRetry={() => (seasons.error ? seasons.reload() : standings.reload())} />
        ) : seasons.loading || standings.loading ? (
          <LoadingBlock rows={6} />
        ) : !season ? (
          <EmptyState icon="calendar" title="Aucune saison ouverte">Le classement apparaîtra dès l’ouverture de la première saison.</EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState icon="trophy" title="Classement vierge">Aucun résultat officiel n’a encore été publié pour cette saison.</EmptyState>
        ) : (
          <StandingsTable rows={rows} />
        )}
      </Container>
    </section>
  )
}

function UpcomingSection({ c, events, loading, error, reload }: { c: HomeContent['upcoming']; events: BLEvent[]; loading: boolean; error: unknown; reload: () => void }) {
  let list = upcomingEvents(events)
  if (c.featured_only) list = list.filter((e) => e.featured)
  list = list.slice(0, c.limit)
  return (
    <section className="asphalt relative border-y border-ink-700 py-20">
      <Container>
        <SectionHeading
          kicker="Calendrier"
          title={c.title}
          action={<LinkButton to="/calendrier" variant="outline" icon={<Icon name="calendar" size={15} />}>Tout le calendrier</LinkButton>}
        />
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading ? (
          <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64" />)}</div>
        ) : list.length === 0 ? (
          <EmptyState icon="calendar" title="Aucune course annoncée">Les prochaines dates seront communiquées par DarkChat.</EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {list.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        )}
      </Container>
    </section>
  )
}

function PhasesSection({ c }: { c: HomeContent['phases'] }) {
  const { vars } = useSite()
  return (
    <section className="py-20">
      <Container>
        <SectionHeading
          kicker="Hiérarchie"
          title={c.title}
          action={<LinkButton to="/qualifications" variant="outline" icon={<Icon name="layers" size={15} />}>{c.cta_label}</LinkButton>}
        >
          {fillTemplate(c.intro, vars)}
        </SectionHeading>
        <PhaseTimeline items={c.items.map((it) => ({ ...it, description: fillTemplate(it.description, vars) }))} />
      </Container>
    </section>
  )
}

function OrganizersSection({ c }: { c: HomeContent['organizers'] }) {
  return (
    <section className="relative overflow-hidden border-y border-ink-700 bg-ink-900 py-20">
      <div className="pointer-events-none absolute -left-40 top-0 size-[480px] rounded-full bg-blood-500/[0.07] blur-3xl" />
      <Container className="relative">
        <p className="kicker mb-8 flex items-center gap-3"><span className="h-px w-10 bg-blood-500" />{c.title}</p>
        <div className="grid gap-px bg-ink-600 sm:grid-cols-2">
          {c.people.map((p) => (
            <div key={p.alias} className="bg-ink-900 p-8 sm:p-10">
              <Icon name="crown" size={28} className="text-blood-500" />
              <p className="display mt-4 text-6xl text-bone">{p.alias}</p>
              <p className="mt-2 font-display text-sm font-bold uppercase tracking-[0.22em] text-blood-400">{p.roles}</p>
              <p className="mt-5 text-lg italic text-ash">{p.verbs}</p>
            </div>
          ))}
        </div>
        {c.quote && <p className="display mt-10 text-center text-3xl text-bone sm:text-4xl">« {c.quote} »</p>}
      </Container>
    </section>
  )
}

function ResultsSection({ c }: { c: HomeContent['results'] }) {
  const latest = useData(() => getLatestResults(c.limit), [c.limit])
  return (
    <section className="py-20">
      <Container>
        <SectionHeading kicker="Résultats officiels" title={c.title} />
        {latest.error ? (
          <ErrorState error={latest.error} onRetry={latest.reload} />
        ) : latest.loading ? (
          <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}</div>
        ) : !latest.data?.length ? (
          <EmptyState icon="flag" title="Aucune course terminée">Les podiums apparaîtront ici après la première épreuve.</EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {latest.data.map(({ event, podium }) => (
              <Link key={event.id} to={`/calendrier/${event.id}`} className="panel group block p-5 transition-colors hover:border-blood-500/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="label">{KIND_LABEL[event.kind]}</span>
                  <span className="font-mono text-[0.7rem] text-smoke">{formatDate(event.starts_at)}</span>
                </div>
                <p className="display mt-2 text-2xl text-bone group-hover:text-white">{event.name}</p>
                <ol className="mt-5 space-y-2">
                  {podium.length === 0 && <li className="text-sm text-smoke">Aucun pilote classé.</li>}
                  {podium.map((r) => (
                    <li key={r.pilot_id} className="flex items-center gap-3">
                      <PositionChip position={r.position} size="sm" />
                      <span className={cx('display flex-1 text-xl', r.position === 1 ? 'text-bone' : 'text-ash')}>{r.pseudonym}</span>
                      <span className="font-mono text-sm text-smoke tabular">{r.points} pts</span>
                    </li>
                  ))}
                </ol>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </section>
  )
}

function RulesSection({ c }: { c: HomeContent['rules'] }) {
  return (
    <section className="asphalt relative border-y border-ink-700 py-20">
      <Container>
        <SectionHeading
          kicker="Règlement"
          title={c.title}
          action={<LinkButton to="/reglement" variant="outline" icon={<Icon name="shield" size={15} />}>{c.cta_label}</LinkButton>}
        />
        <ol className="grid border-l border-t border-ink-600 md:grid-cols-2 lg:grid-cols-3">
          {c.items.map((r, i) => (
            <li key={i} className="flex gap-5 border-b border-r border-ink-600 bg-ink-900/80 p-6">
              <span className="font-display text-4xl font-black italic leading-none text-blood-500 tabular">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <p className="display text-2xl text-bone">{r.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-ash">{r.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}

function Closing({ c }: { c: HomeContent['closing'] }) {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="rain pointer-events-none absolute inset-0 opacity-50" />
      <Container className="relative">
        <p className="display text-5xl leading-[0.95] text-bone sm:text-7xl lg:text-8xl">{c.line_1}</p>
        <p className="display mt-2 text-5xl leading-[0.95] text-blood-500 sm:text-7xl lg:text-8xl">{c.line_2}</p>
      </Container>
    </section>
  )
}

/** Page d'accueil. `preview` permet d'afficher un brouillon depuis le back-office. */
export default function Home({ preview }: { preview?: HomeContent }) {
  const content = useData(async () => preview ?? (await getContent('home')), [preview])
  const events = useData(() => getEvents(), [])
  const next = useMemo(() => upcomingEvents(events.data ?? []).find((e) => e.status !== 'cancelled') ?? null, [events.data])
  const c = preview ?? content.data

  useEffect(() => {
    if (!preview) document.title = 'BLACKLANE — Ils cherchent des coureurs. Nous cherchons des pilotes.'
  }, [preview])

  if (content.error && !preview) {
    return (
      <Container className="pb-20 pt-32">
        <ErrorState error={content.error} onRetry={content.reload} />
      </Container>
    )
  }
  if (!c) {
    return (
      <div className="min-h-[100svh] bg-ink-950 pt-32">
        <Container><LoadingBlock rows={3} /></Container>
      </div>
    )
  }

  return (
    <>
      <Hero c={c.hero} next={next} />
      <Announcement a={c.announcement} />
      {next && (
        <div className="border-b border-ink-700 bg-ink-950 px-4 py-6 lg:hidden">
          <NextEventPanel event={next} />
        </div>
      )}
      {c.stats.enabled && <StatsSection c={c.stats} />}
      {c.standings.enabled && <StandingsSection c={c.standings} />}
      {c.upcoming.enabled && (
        <UpcomingSection c={c.upcoming} events={events.data ?? []} loading={events.loading} error={events.error} reload={events.reload} />
      )}
      {c.phases.enabled && <PhasesSection c={c.phases} />}
      {c.organizers?.enabled && <OrganizersSection c={c.organizers} />}
      {c.results.enabled && <ResultsSection c={c.results} />}
      {c.rules.enabled && <RulesSection c={c.rules} />}
      {c.closing?.enabled && <Closing c={c.closing} />}
    </>
  )
}
