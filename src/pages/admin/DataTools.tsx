import { useEffect, useState } from 'react'
import { useData } from '../../hooks/useData'
import { useAuth } from '../../lib/auth'
import { exportAll, listSeasons, purgeDemo } from '../../lib/admin-api'
import { getStandings, getStats } from '../../lib/api'
import { downloadFile, stamp, toCsv } from '../../lib/csv'
import { AdminPageHeader } from './AdminLayout'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Notice } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/Toast'
import { useSite } from '../../components/layout/SiteContext'

export default function DataTools() {
  const toast = useToast()
  const { can } = useAuth()
  const { reloadStats } = useSite()
  const seasons = useData(() => listSeasons(), [])
  const stats = useData(() => getStats(), [])
  const [seasonId, setSeasonId] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [purge, setPurge] = useState(false)

  useEffect(() => {
    document.title = 'Export & données — Back-office'
  }, [])
  useEffect(() => {
    if (!seasonId && seasons.data?.length) setSeasonId(seasons.data.find((s) => s.status === 'active')?.id ?? seasons.data[0].id)
  }, [seasons.data, seasonId])

  return (
    <>
      <AdminPageHeader title="Export & données">Sauvegardes manuelles et nettoyage avant la mise en production.</AdminPageHeader>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel-flat space-y-4 p-5">
          <h2 className="display text-2xl text-bone">Sauvegarde complète (JSON)</h2>
          <p className="text-sm text-ash">
            Exporte toutes les tables : pilotes, saisons, événements, résultats, corrections, phases, challenges, contenus et historique des rangs.
            Conservez ce fichier en lieu sûr : il contient les notes internes.
          </p>
          <Button
            icon={<Icon name="download" size={15} />}
            loading={busy === 'json'}
            onClick={async () => {
              setBusy('json')
              try {
                const data = await exportAll()
                downloadFile(`blacklane-sauvegarde-${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json')
                toast.success('Sauvegarde téléchargée.')
              } catch (e) {
                toast.error(e)
              } finally {
                setBusy(null)
              }
            }}
          >
            Télécharger la sauvegarde
          </Button>
          <Notice tone="info">
            Supabase effectue aussi des sauvegardes automatiques quotidiennes de la base (selon votre offre). Voir Supabase → Database → Backups.
          </Notice>
        </section>

        <section className="panel-flat space-y-4 p-5">
          <h2 className="display text-2xl text-bone">Classement (CSV)</h2>
          <p className="text-sm text-ash">Export du classement général d’une saison, lisible dans un tableur.</p>
          <select className="field" value={seasonId} onChange={(e) => setSeasonId(e.target.value)} aria-label="Saison">
            {(seasons.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button
            variant="outline"
            icon={<Icon name="download" size={15} />}
            loading={busy === 'csv'}
            disabled={!seasonId}
            onClick={async () => {
              setBusy('csv')
              try {
                const rows = await getStandings(seasonId)
                const name = seasons.data?.find((s) => s.id === seasonId)?.name ?? 'saison'
                downloadFile(
                  `blacklane-classement-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`,
                  toCsv(rows as unknown as Record<string, unknown>[], [
                    { key: 'position', label: 'Position' },
                    { key: 'pseudonym', label: 'Pilote' },
                    { key: 'rank', label: 'Rang' },
                    { key: 'races', label: 'Courses' },
                    { key: 'wins', label: 'Victoires' },
                    { key: 'podiums', label: 'Podiums' },
                    { key: 'adjustments', label: 'Corrections' },
                    { key: 'points', label: 'Points' },
                  ]),
                  'text/csv;charset=utf-8',
                )
              } catch (e) {
                toast.error(e)
              } finally {
                setBusy(null)
              }
            }}
          >
            Exporter le classement
          </Button>
        </section>

        <section className="panel-flat space-y-4 border-amber-400/30 p-5 xl:col-span-2">
          <h2 className="display text-2xl text-bone">Données de démonstration</h2>
          {stats.data?.has_demo ? (
            <Notice tone="warning">Des données de démonstration sont présentes (pilotes, événements, saison et challenges marqués « démo »).</Notice>
          ) : (
            <Notice tone="success">Aucune donnée de démonstration : le site est prêt pour la production.</Notice>
          )}
          <p className="text-sm text-ash">
            La purge supprime uniquement les éléments marqués comme démo. Les paramètres, barèmes, contenus et vos propres données sont conservés.
          </p>
          {can('owner') ? (
            <Button variant="danger" icon={<Icon name="trash" size={15} />} disabled={!stats.data?.has_demo} onClick={() => setPurge(true)}>
              Purger la démo
            </Button>
          ) : (
            <p className="text-xs text-smoke">Réservé au rôle Owner.</p>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={purge}
        title="Purger les données de démonstration ?"
        confirmLabel="Purger"
        danger
        confirmWord="PURGER"
        onClose={() => setPurge(false)}
        onConfirm={async () => {
          try {
            const r = await purgeDemo()
            toast.success(`Démo supprimée : ${r.pilots} pilote(s), ${r.events} événement(s), ${r.seasons} saison(s).`)
            await stats.reload()
            await reloadStats()
          } catch (e) {
            toast.error(e)
          }
        }}
      >
        <p>Opération irréversible. Téléchargez une sauvegarde au préalable si nécessaire.</p>
      </ConfirmDialog>
    </>
  )
}
