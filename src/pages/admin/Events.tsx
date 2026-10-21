import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from '../../lib/router'
import { useData } from '../../hooks/useData'
import { listEvents, listSeasons } from '../../lib/admin-api'
import { formatDateTimeShort } from '../../lib/format'
import { EVENT_STATUS_LABEL, EVENT_STATUSES, KIND_LABEL, KINDS, PHASE_SHORT } from '../../lib/labels'
import type { BLEvent } from '../../lib/types'
import { AdminPageHeader } from './AdminLayout'
import { LinkButton } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { DemoBadge, EmptyState, ErrorState, LoadingBlock } from '../../components/ui/primitives'
import { Segmented } from '../../components/ui/Form'
import { EventStatusBadge } from '../../components/race/Badges'
import { cx } from '../../components/ui/cx'

const needsResults = (e: BLEvent) =>
  e.status === 'in_progress' || (!['completed', 'cancelled'].includes(e.status) && !!e.starts_at && new Date(e.starts_at) < new Date())

export default function Events() {
  const [params, setParams] = useSearchParams()
  const events = useData(() => listEvents(), [])
  const seasons = useData(() => listSeasons(), [])
  const view = params.get('vue') ?? 'tous'
  const season = params.get('saison') ?? ''
  const kind = params.get('type') ?? ''
  const status = params.get('statut') ?? ''

  useEffect(() => {
    document.title = 'Courses — Back-office'
  }, [])

  const seasonName = useMemo(() => new Map((seasons.data ?? []).map((s) => [s.id, s.name])), [seasons.data])
  const list = useMemo(() => {
    const now = Date.now()
    return (events.data ?? [])
      .filter((e) => (season ? e.season_id === season : true))
      .filter((e) => (kind ? e.kind === kind : true))
      .filter((e) => (status ? e.status === status : true))
      .filter((e) =>
        view === 'a-venir'
          ? !['completed', 'cancelled'].includes(e.status) && (!e.starts_at || new Date(e.starts_at).getTime() >= now)
          : view === 'a-saisir'
            ? needsResults(e)
            : view === 'terminees'
              ? e.status === 'completed'
              : true,
      )
  }, [events.data, season, kind, status, view])

  return (
    <>
      <AdminPageHeader
        title="Courses & résultats"
        actions={<LinkButton to="/admin/courses/nouveau" icon={<Icon name="plus" size={15} />}>Créer une course</LinkButton>}
      >
        Sessions de qualification, épreuves Élite, finale et exhibitions. Les points sont calculés automatiquement à partir du barème lors de la saisie des résultats.
      </AdminPageHeader>

      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Segmented
          label="Vue"
          value={view}
          onChange={(v) => setParams({ vue: v === 'tous' ? null : v })}
          options={[
            { value: 'tous', label: 'Toutes' },
            { value: 'a-venir', label: 'À venir' },
            { value: 'a-saisir', label: 'Résultats à saisir' },
            { value: 'terminees', label: 'Terminées' },
          ]}
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <select className="field" value={season} onChange={(e) => setParams({ saison: e.target.value })} aria-label="Saison">
            <option value="">Toutes les saisons</option>
            {(seasons.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="field" value={kind} onChange={(e) => setParams({ type: e.target.value })} aria-label="Type">
            <option value="">Tous les types</option>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
          <select className="field" value={status} onChange={(e) => setParams({ statut: e.target.value })} aria-label="Statut">
            <option value="">Tous les statuts</option>
            {EVENT_STATUSES.map((s) => <option key={s} value={s}>{EVENT_STATUS_LABEL[s]}</option>)}
          </select>
        </div>
      </div>

      {events.error ? (
        <ErrorState error={events.error} onRetry={events.reload} />
      ) : events.loading ? (
        <LoadingBlock rows={8} />
      ) : list.length === 0 ? (
        <EmptyState icon="flag" title="Aucune course" action={<LinkButton to="/admin/courses/nouveau">Créer une course</LinkButton>}>
          {events.data?.length ? 'Aucune course ne correspond à ces filtres.' : 'Créez la première session de qualification.'}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto border border-ink-600">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-ink-900">
              <tr>
                {['Date', 'Épreuve', 'Type / phase', 'Saison', 'Statut', 'Public', ''].map((h) => <th key={h} className="label px-4 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className={cx('border-t border-ink-700 hover:bg-white/[0.02]', e.status === 'cancelled' && 'opacity-60')}>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ash">{formatDateTimeShort(e.starts_at)}</td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/courses/${e.id}`} className="font-semibold text-bone hover:text-blood-300">{e.name}</Link>
                    {e.featured && <Icon name="star" size={13} className="ml-1.5 inline text-amber-400" aria-label="Mis en avant" />}
                    {e.is_demo && <DemoBadge />}
                  </td>
                  <td className="px-4 py-3 text-ash">
                    {KIND_LABEL[e.kind]}
                    <span className="block text-xs text-smoke">
                      {PHASE_SHORT[e.phase]}{e.session_number ? ` · S${e.session_number}` : ''}{e.group_label ? ` · Gr. ${e.group_label}` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-smoke">{e.season_id ? seasonName.get(e.season_id) : 'Hors saison'}</td>
                  <td className="px-4 py-3">
                    <EventStatusBadge status={e.status} />
                    {needsResults(e) && <span className="mt-1 block text-[0.7rem] text-amber-400">Résultats à saisir</span>}
                  </td>
                  <td className="px-4 py-3">{e.is_published ? <Icon name="eye" size={16} className="text-ash" aria-label="Publié" /> : <span className="text-xs text-smoke">Brouillon</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/courses/${e.id}${e.status !== 'completed' && !needsResults(e) ? '' : '?onglet=resultats'}`} className="inline-flex items-center gap-1 text-xs text-smoke hover:text-bone">
                      {needsResults(e) ? 'Saisir' : 'Gérer'} <Icon name="chevronRight" size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
