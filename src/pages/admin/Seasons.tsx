import { useEffect, useState } from 'react'
import { Link } from '../../lib/router'
import { useData } from '../../hooks/useData'
import { useAuth } from '../../lib/auth'
import { createSeason, deleteSeason, listEvents, listSeasons, setSeasonStatus, updateSeason } from '../../lib/admin-api'
import { getScales } from '../../lib/api'
import { formatShortDate } from '../../lib/format'
import { SEASON_STATUS_LABEL } from '../../lib/labels'
import type { Season, SeasonStatus } from '../../lib/types'
import { AdminPageHeader } from './AdminLayout'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { SelectInput, TextArea, TextInput } from '../../components/ui/Form'
import { Badge, DemoBadge, EmptyState, ErrorState, LoadingBlock } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/Toast'

type FormState = { id?: string; name: string; starts_on: string; ends_on: string; scale_id: string; notes: string }
const empty: FormState = { name: '', starts_on: '', ends_on: '', scale_id: '', notes: '' }

export default function Seasons() {
  const toast = useToast()
  const { can } = useAuth()
  const seasons = useData(() => listSeasons(), [])
  const events = useData(() => listEvents(), [])
  const scales = useData(() => getScales(), [])
  const [form, setForm] = useState<FormState | null>(null)
  const [action, setAction] = useState<{ season: Season; to: SeasonStatus } | null>(null)
  const [del, setDel] = useState<Season | null>(null)

  useEffect(() => {
    document.title = 'Saisons — Back-office'
  }, [])

  const count = (id: string) => (events.data ?? []).filter((e) => e.season_id === id)
  const reload = () => Promise.all([seasons.reload(), events.reload()])

  const submit = async () => {
    if (!form) return
    if (form.name.trim().length < 2) return toast.error('Nom requis.')
    if (form.starts_on && form.ends_on && form.ends_on < form.starts_on) return toast.error('La date de fin précède la date de début.')
    const input = { name: form.name.trim(), starts_on: form.starts_on || null, ends_on: form.ends_on || null, scale_id: form.scale_id || null, notes: form.notes.trim() || null }
    try {
      if (form.id) await updateSeason(form.id, input)
      else await createSeason(input)
      toast.success(form.id ? 'Saison modifiée.' : 'Saison créée (brouillon). Activez-la pour l’ouvrir au public.')
      setForm(null)
      await reload()
    } catch (e) {
      toast.error(e)
    }
  }

  const actionText: Record<SeasonStatus, { title: string; body: string; label: string }> = {
    active: { title: 'Activer la saison ?', body: 'Elle devient la saison en cours affichée sur le site. Une seule saison peut être active.', label: 'Activer' },
    closed: { title: 'Clôturer la saison ?', body: 'Les résultats, points et sélections seront figés et archivés. Le classement reste consultable dans les archives. Seul un owner pourra la rouvrir.', label: 'Clôturer' },
    draft: { title: 'Repasser en brouillon ?', body: 'La saison sera masquée du site public.', label: 'Confirmer' },
  }

  return (
    <>
      <AdminPageHeader title="Saisons" actions={<Button icon={<Icon name="plus" size={15} />} onClick={() => setForm({ ...empty })}>Nouvelle saison</Button>}>
        Chaque saison conserve ses épreuves, ses classements et ses pilotes Elite. Clôturer une saison l’archive sans rien effacer ; la suivante repart de zéro.
      </AdminPageHeader>

      {seasons.error ? (
        <ErrorState error={seasons.error} onRetry={seasons.reload} />
      ) : seasons.loading ? (
        <LoadingBlock rows={4} />
      ) : !seasons.data?.length ? (
        <EmptyState icon="calendar" title="Aucune saison" action={<Button onClick={() => setForm({ ...empty })}>Créer la première saison</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {seasons.data.map((s) => {
            const evs = count(s.id)
            const done = evs.filter((e) => e.status === 'completed').length
            return (
              <div key={s.id} className={s.status === 'active' ? 'panel border-blood-600/70 p-5' : 'panel p-5'}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone={s.status === 'active' ? 'red' : s.status === 'closed' ? 'neutral' : 'warning'} dot={s.status === 'active'}>{SEASON_STATUS_LABEL[s.status]}</Badge>
                      {s.is_demo && <DemoBadge />}
                    </div>
                    <h2 className="display mt-2 text-3xl text-bone">{s.name}</h2>
                    <p className="text-xs text-smoke">
                      {s.starts_on ? formatShortDate(s.starts_on) : '?'} → {s.ends_on ? formatShortDate(s.ends_on) : '?'} · {done}/{evs.length} épreuve(s) terminée(s)
                      {s.closed_at && ` · clôturée le ${formatShortDate(s.closed_at)}`}
                    </p>
                    <p className="mt-1 text-xs text-smoke">Barème : {(scales.data ?? []).find((x) => x.id === s.scale_id)?.name ?? 'par défaut'}</p>
                  </div>
                  {s.status !== 'closed' && (
                    <button className="p-2 text-smoke hover:text-bone" aria-label="Modifier" onClick={() => setForm({ id: s.id, name: s.name, starts_on: s.starts_on ?? '', ends_on: s.ends_on ?? '', scale_id: s.scale_id ?? '', notes: s.notes ?? '' })}>
                      <Icon name="edit" size={16} />
                    </button>
                  )}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {s.status === 'draft' && <Button size="sm" onClick={() => setAction({ season: s, to: 'active' })}>Activer</Button>}
                  {s.status === 'active' && <Button size="sm" variant="outline" onClick={() => setAction({ season: s, to: 'closed' })}>Clôturer la saison</Button>}
                  {s.status === 'closed' && can('owner') && <Button size="sm" variant="ghost" onClick={() => setAction({ season: s, to: 'active' })}>Rouvrir</Button>}
                  <Link to={`/classement?saison=${s.id}`} className="inline-flex items-center gap-1.5 border border-ink-600 px-3 py-1.5 text-xs uppercase tracking-wider text-smoke hover:text-bone">
                    <Icon name="trophy" size={13} /> Classement
                  </Link>
                  <Link to={`/admin/phases?saison=${s.id}`} className="inline-flex items-center gap-1.5 border border-ink-600 px-3 py-1.5 text-xs uppercase tracking-wider text-smoke hover:text-bone">
                    <Icon name="layers" size={13} /> Phases
                  </Link>
                  {can('owner') && evs.length === 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setDel(s)} icon={<Icon name="trash" size={13} />}>Supprimer</Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Modifier la saison' : 'Nouvelle saison'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)}>Annuler</Button>
            <Button onClick={submit}>{form?.id ? 'Enregistrer' : 'Créer'}</Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <TextInput label="Nom" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} placeholder="Saison 2" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Début" type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} />
              <TextInput label="Fin" type="date" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} />
            </div>
            <SelectInput label="Barème de la saison" value={form.scale_id} onChange={(e) => setForm({ ...form, scale_id: e.target.value })} placeholder="Barème par défaut" options={(scales.data ?? []).map((s) => ({ value: s.id, label: s.name }))} />
            <TextArea label="Notes internes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} maxLength={2000} />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!action}
        title={action ? actionText[action.to].title : ''}
        confirmLabel={action ? actionText[action.to].label : ''}
        danger={action?.to === 'closed'}
        confirmWord={action?.to === 'closed' ? 'CLOTURER' : undefined}
        onClose={() => setAction(null)}
        onConfirm={async () => {
          if (!action) return
          try {
            await setSeasonStatus(action.season.id, action.to)
            toast.success('Statut de la saison mis à jour.')
            await reload()
          } catch (e) {
            toast.error(e)
          }
        }}
      >
        <p>{action && actionText[action.to].body}</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!del}
        title="Supprimer cette saison ?"
        confirmLabel="Supprimer"
        danger
        onClose={() => setDel(null)}
        onConfirm={async () => {
          if (!del) return
          try {
            await deleteSeason(del.id)
            toast.success('Saison supprimée.')
            await reload()
          } catch (e) {
            toast.error(e)
          }
        }}
      >
        <p>La saison « {del?.name} » ne contient aucune épreuve et sera supprimée définitivement.</p>
      </ConfirmDialog>
    </>
  )
}
