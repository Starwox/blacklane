import { Fragment, useEffect, useState } from 'react'
import { useData } from '../../hooks/useData'
import { listAudit } from '../../lib/admin-api'
import { formatDateTimeShort } from '../../lib/format'
import { AdminPageHeader } from './AdminLayout'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/primitives'

const ENTITIES: { value: string; label: string }[] = [
  { value: '', label: 'Tout' },
  { value: 'results', label: 'Résultats' },
  { value: 'events', label: 'Événements' },
  { value: 'pilots', label: 'Pilotes' },
  { value: 'point_adjustments', label: 'Corrections de points' },
  { value: 'point_scale_entries', label: 'Barèmes' },
  { value: 'competition_settings', label: 'Paramètres' },
  { value: 'stage_entries', label: 'Phases' },
  { value: 'elite_challenges', label: 'Challenges' },
  { value: 'seasons', label: 'Saisons' },
  { value: 'site_content', label: 'Publications' },
  { value: 'admin_users', label: 'Comptes' },
  { value: 'database', label: 'Export / purge' },
]

const ACTION_LABEL: Record<string, string> = {
  insert: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  'results.save': 'Saisie des résultats',
  'results.clear': 'Effacement des résultats',
  'points.recalculate': 'Recalcul des points',
  'stage.confirm_qualifiers': 'Validation des qualifiés',
  'stage.revert_qualifiers': 'Annulation des qualifiés',
  'stage.assign_groups': 'Constitution des groupes',
  'stage.reset_groups': 'Réinitialisation des groupes',
  'stage.confirm_finalists': 'Validation des finalistes',
  'stage.revert_finalists': 'Annulation des finalistes',
  'stage.confirm_elite': 'Désignation des Elite',
  'stage.revert_elite': 'Annulation des Elite',
  'challenge.resolve': 'Résultat de Challenge',
  'challenge.decline': 'Refus de Challenge',
  'content.publish': 'Publication de contenu',
  'season.status': 'Statut de saison',
  'data.export': 'Export des données',
  'data.purge_demo': 'Purge de la démo',
}

const PAGE = 50

export default function Audit() {
  const [entity, setEntity] = useState('')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<number | null>(null)
  const data = useData(() => listAudit({ limit: PAGE, offset: page * PAGE, entity: entity || undefined }), [entity, page])

  useEffect(() => {
    document.title = 'Journal — Back-office'
  }, [])

  const pages = Math.max(1, Math.ceil((data.data?.total ?? 0) / PAGE))

  return (
    <>
      <AdminPageHeader title="Journal des actions">
        Trace horodatée des actions sensibles : résultats, barèmes, publications, suppressions, comptes. Le journal ne peut être ni modifié ni effacé depuis le site.
      </AdminPageHeader>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select className="field w-auto" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(0) }} aria-label="Filtrer">
          {ENTITIES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
        <span className="text-xs text-smoke">{data.data?.total ?? 0} entrée(s)</span>
      </div>
      {data.error ? (
        <ErrorState error={data.error} onRetry={data.reload} />
      ) : data.loading ? (
        <LoadingBlock rows={10} />
      ) : !data.data?.rows.length ? (
        <EmptyState icon="history" title="Journal vide" />
      ) : (
        <div className="overflow-x-auto border border-ink-600">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-ink-900">
              <tr>{['Date', 'Auteur', 'Action', 'Élément', ''].map((h) => <th key={h} className="label px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.data.rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-t border-ink-700 align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-smoke">{formatDateTimeShort(r.at)}</td>
                    <td className="px-4 py-2.5 text-bone">{r.actor_name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-ash">{ACTION_LABEL[r.action] ?? r.action}</td>
                    <td className="px-4 py-2.5 text-xs text-smoke">
                      {ENTITIES.find((e) => e.value === r.entity)?.label ?? r.entity}
                      {r.entity_id && <span className="ml-1 font-mono">{r.entity_id.slice(0, 13)}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {r.details != null && (
                        <button className="text-xs text-smoke underline hover:text-bone" onClick={() => setOpen(open === r.id ? null : r.id)}>
                          {open === r.id ? 'Masquer' : 'Détails'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {open === r.id && (
                    <tr className="bg-ink-900/60">
                      <td colSpan={5} className="px-4 py-3">
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all font-mono text-[0.72rem] text-ash">{JSON.stringify(r.details, null, 2)}</pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Précédent</Button>
          <span className="text-xs text-smoke">Page {page + 1} / {pages}</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Suivant</Button>
        </div>
      )}
    </>
  )
}
