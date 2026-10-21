import { useMemo } from 'react'
import { Link } from '../../lib/router'
import { useData } from '../../hooks/useData'
import { useAuth } from '../../lib/auth'
import { getStats, upcomingEvents } from '../../lib/api'
import { listChallenges, listEvents, listPilots, listSeasons } from '../../lib/admin-api'
import { formatDateTimeShort, formatShortDate } from '../../lib/format'
import { KIND_LABEL } from '../../lib/labels'
import { AdminPageHeader } from './AdminLayout'
import { ErrorState, LoadingBlock, Notice, StatTile, EmptyState, DemoBadge } from '../../components/ui/primitives'
import { Icon, type IconName } from '../../components/ui/Icon'
import { EventStatusBadge } from '../../components/race/Badges'

function QuickAction({ to, icon, label, hint }: { to: string; icon: IconName; label: string; hint: string }) {
  return (
    <Link to={to} className="panel group flex items-center gap-4 p-4 transition-colors hover:border-blood-500/60">
      <span className="chamfer-sm grid size-11 shrink-0 place-items-center bg-blood-500/15 text-blood-400 transition-colors group-hover:bg-blood-500 group-hover:text-white">
        <Icon name={icon} size={20} />
      </span>
      <span>
        <span className="display block text-xl text-bone">{label}</span>
        <span className="text-xs text-smoke">{hint}</span>
      </span>
    </Link>
  )
}

export default function Dashboard() {
  const { profile, can } = useAuth()
  const data = useData(async () => {
    const [pilots, events, seasons, stats, challenges] = await Promise.all([
      listPilots(),
      listEvents(),
      listSeasons(),
      getStats(),
      can('admin') ? listChallenges() : Promise.resolve([]),
    ])
    return { pilots, events, seasons, stats, challenges }
  }, [])

  const d = data.data
  const derived = useMemo(() => {
    if (!d) return null
    const active = d.seasons.find((s) => s.status === 'active') ?? null
    const completed = d.events.filter((e) => e.status === 'completed' && e.kind !== 'challenge')
    const toScore = d.events.filter((e) => e.status === 'in_progress' || (e.status !== 'completed' && e.status !== 'cancelled' && e.starts_at && new Date(e.starts_at) < new Date()))
    return {
      active,
      pilots: d.pilots.filter((p) => p.status !== 'archived').length,
      completed,
      upcoming: upcomingEvents(d.events).slice(0, 5),
      latest: [...completed].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5),
      toScore,
      unpublished: d.events.filter((e) => !e.is_published && e.status !== 'cancelled').length,
      pendingChallenges: d.challenges.filter((c) => c.status === 'pending').length,
    }
  }, [d])

  return (
    <>
      <AdminPageHeader kicker={derived?.active ? derived.active.name : 'Aucune saison active'} title={`Bonsoir, ${profile?.display_name ?? ''}`}>
        Vue d’ensemble de la ligue. Toutes les modifications sont répercutées immédiatement sur le site public.
      </AdminPageHeader>

      {data.error ? (
        <ErrorState error={data.error} onRetry={data.reload} />
      ) : !d || !derived ? (
        <LoadingBlock rows={6} />
      ) : (
        <div className="space-y-8">
          {d.stats.has_demo && (
            <Notice tone="warning" title="Données de démonstration présentes">
              Des pilotes et événements fictifs (marqués « démo ») sont visibles sur le site public. Supprimez-les avant la mise en production depuis{' '}
              <Link to="/admin/donnees" className="text-amber-400 underline">Export & données</Link>.
            </Notice>
          )}
          {!derived.active && (
            <Notice tone="info" title="Aucune saison active">
              Créez et activez une saison pour y rattacher les épreuves : <Link to="/admin/saisons" className="text-blood-400 underline">Saisons</Link>.
            </Notice>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Pilotes enregistrés" value={derived.pilots} hint="hors archivés" />
            <StatTile label="Courses terminées" value={derived.completed.length} accent />
            <StatTile label="Événements à venir" value={derived.upcoming.length} hint={derived.unpublished ? `${derived.unpublished} non publié(s)` : undefined} />
            <StatTile label="Pilotes classés" value={d.stats.pilots_ranked} hint="saison active" />
          </div>

          <section>
            <h2 className="label mb-3">Actions rapides</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <QuickAction to="/admin/pilotes?nouveau=1" icon="plus" label="Ajouter un pilote" hint="Pseudonyme, plaque, véhicule" />
              <QuickAction to="/admin/courses/nouveau" icon="flag" label="Créer une course" hint="Session, épreuve, finale…" />
              {can('admin') && <QuickAction to="/admin/courses?vue=a-saisir" icon="edit" label="Saisir des résultats" hint="Points calculés automatiquement" />}
              {can('admin') && <QuickAction to="/admin/pilotes" icon="trophy" label="Modifier le classement" hint="Corrections justifiées" />}
            </div>
          </section>

          {derived.toScore.length > 0 && can('admin') && (
            <Notice tone="warning" title="Résultats en attente">
              {derived.toScore.length} épreuve(s) passée(s) sans résultats :{' '}
              {derived.toScore.slice(0, 4).map((e, i) => (
                <span key={e.id}>
                  {i > 0 && ', '}
                  <Link to={`/admin/courses/${e.id}?onglet=resultats`} className="text-amber-400 underline">{e.name}</Link>
                </span>
              ))}
            </Notice>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="panel-flat p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="display text-2xl text-bone">Prochains événements</h2>
                <Link to="/admin/courses" className="text-xs text-smoke hover:text-bone">Tout voir</Link>
              </div>
              {derived.upcoming.length === 0 ? (
                <EmptyState icon="calendar" title="Rien de programmé" action={<Link to="/admin/courses/nouveau" className="text-sm text-blood-400 underline">Créer une course</Link>} />
              ) : (
                <ul className="divide-y divide-ink-700">
                  {derived.upcoming.map((e) => (
                    <li key={e.id}>
                      <Link to={`/admin/courses/${e.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-white/[0.02]">
                        <span className="min-w-0">
                          <span className="block truncate text-bone">{e.name}{e.is_demo && <DemoBadge />}</span>
                          <span className="text-xs text-smoke">{KIND_LABEL[e.kind]} · {formatDateTimeShort(e.starts_at)}{!e.is_published && ' · non publié'}</span>
                        </span>
                        <EventStatusBadge status={e.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="panel-flat p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="display text-2xl text-bone">Derniers résultats enregistrés</h2>
                {can('admin') && derived.pendingChallenges > 0 && (
                  <Link to="/admin/challenges" className="text-xs text-amber-400 underline">{derived.pendingChallenges} défi(s) en attente</Link>
                )}
              </div>
              {derived.latest.length === 0 ? (
                <EmptyState icon="flag" title="Aucune course terminée" />
              ) : (
                <ul className="divide-y divide-ink-700">
                  {derived.latest.map((e) => (
                    <li key={e.id}>
                      <Link to={`/admin/courses/${e.id}?onglet=resultats`} className="flex items-center justify-between gap-3 py-3 hover:bg-white/[0.02]">
                        <span className="min-w-0">
                          <span className="block truncate text-bone">{e.name}{e.is_demo && <DemoBadge />}</span>
                          <span className="text-xs text-smoke">{KIND_LABEL[e.kind]} · couru le {formatShortDate(e.starts_at)}</span>
                        </span>
                        <span className="text-xs text-smoke">modifié le {formatShortDate(e.updated_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  )
}
