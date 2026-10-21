import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from '../../lib/router'
import { useData } from '../../hooks/useData'
import { useAuth } from '../../lib/auth'
import { createEvent, deleteEvent, getEventAdmin, getEventNotes, listEvents, listSeasons, saveEventNotes, updateEvent, type EventInput } from '../../lib/admin-api'
import { getScales } from '../../lib/api'
import { formatDateTime, fromLocalInput, toLocalInput, SITE_TIMEZONE } from '../../lib/format'
import { EVENT_STATUS_LABEL, EVENT_STATUSES, KIND_LABEL, KINDS, PHASE_FOR_KIND, PHASE_LABEL } from '../../lib/labels'
import type { BLEvent, EventKind, EventStatus, GroupLabel } from '../../lib/types'
import { AdminPageHeader } from './AdminLayout'
import EventParticipants from './EventParticipants'
import EventResults from './EventResults'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { SelectInput, TextArea, TextInput, Toggle, Segmented } from '../../components/ui/Form'
import { DemoBadge, EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/Toast'
import { EventStatusBadge } from '../../components/race/Badges'

type Draft = {
  season_id: string
  kind: EventKind
  name: string
  description: string
  session_number: string
  group_label: string
  starts_at: string
  location_rp: string
  participation_info: string
  capacity: string
  status: EventStatus
  status_note: string
  is_published: boolean
  featured: boolean
  counts_for_standings: boolean
  scale_id: string
}

const toDraft = (e: BLEvent | null, defaults: Partial<Draft> = {}): Draft => ({
  season_id: e?.season_id ?? defaults.season_id ?? '',
  kind: e?.kind ?? 'qualification',
  name: e?.name ?? '',
  description: e?.description ?? '',
  session_number: e?.session_number?.toString() ?? '',
  group_label: e?.group_label ?? '',
  starts_at: toLocalInput(e?.starts_at),
  location_rp: e?.location_rp ?? '',
  participation_info: e?.participation_info ?? '',
  capacity: e?.capacity?.toString() ?? '',
  status: e?.status ?? 'scheduled',
  status_note: e?.status_note ?? '',
  is_published: e?.is_published ?? false,
  featured: e?.featured ?? false,
  counts_for_standings: e?.counts_for_standings ?? true,
  scale_id: e?.scale_id ?? '',
})

function toInput(d: Draft): Partial<EventInput> {
  const kind = d.kind
  return {
    season_id: kind === 'exhibition' && !d.season_id ? null : d.season_id || null,
    kind,
    phase: PHASE_FOR_KIND[kind],
    name: d.name.trim(),
    description: d.description.trim() || null,
    session_number: kind === 'qualification' && d.session_number ? Number(d.session_number) : null,
    group_label: (kind === 'urban_run' || kind === 'navigation') && d.group_label ? (d.group_label as GroupLabel) : null,
    starts_at: d.starts_at ? fromLocalInput(d.starts_at) : null,
    location_rp: d.location_rp.trim() || null,
    participation_info: d.participation_info.trim() || null,
    capacity: d.capacity ? Number(d.capacity) : null,
    status: d.status,
    status_note: d.status_note.trim() || null,
    is_published: d.is_published,
    featured: d.featured,
    counts_for_standings: kind === 'challenge' ? false : d.counts_for_standings,
    scale_id: d.scale_id || null,
  }
}

function validate(d: Draft): Record<string, string> {
  const e: Record<string, string> = {}
  if (d.name.trim().length < 2) e.name = 'Nom requis (2 à 80 caractères).'
  if (d.kind !== 'exhibition' && !d.season_id) e.season_id = 'Rattachez l’épreuve à une saison.'
  if (d.kind === 'qualification' && !d.session_number) e.session_number = 'Numéro de session requis.'
  if ((d.kind === 'urban_run' || d.kind === 'navigation') && !d.group_label) e.group_label = 'Groupe requis.'
  if (d.capacity && (Number(d.capacity) < 1 || Number(d.capacity) > 50)) e.capacity = 'Entre 1 et 50.'
  if (d.starts_at && !fromLocalInput(d.starts_at)) e.starts_at = 'Date invalide.'
  return e
}

export default function EventEditor() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'nouveau'
  const navigate = useNavigate()
  const toast = useToast()
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('onglet') as 'details' | 'participants' | 'resultats') || 'details'

  const event = useData(async () => (isNew ? null : getEventAdmin(id)), [id])
  const seasons = useData(() => listSeasons(), [])
  const scales = useData(() => getScales(), [])
  const siblings = useData(() => listEvents(), [])
  const notes = useData(async () => (isNew ? '' : getEventNotes(id)), [id])

  const [draft, setDraft] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [notesDraft, setNotesDraft] = useState<string | null>(null)
  const [postpone, setPostpone] = useState<{ open: boolean; date: string; note: string }>({ open: false, date: '', note: '' })
  const [cancel, setCancel] = useState<{ open: boolean; note: string }>({ open: false, note: '' })
  const [del, setDel] = useState(false)

  const activeSeason = seasons.data?.find((s) => s.status === 'active')
  useEffect(() => {
    if (event.loading || seasons.loading) return
    setDraft(toDraft(event.data ?? null, { season_id: activeSeason?.id }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.data, event.loading, seasons.loading])

  useEffect(() => {
    document.title = `${isNew ? 'Nouvelle course' : event.data?.name ?? 'Course'} — Back-office`
  }, [isNew, event.data])

  const usedSessions = useMemo(
    () => new Set((siblings.data ?? []).filter((e) => e.kind === 'qualification' && e.season_id === draft?.season_id && e.id !== id).map((e) => e.session_number)),
    [siblings.data, draft?.season_id, id],
  )

  if (event.error) return <ErrorState error={event.error} onRetry={event.reload} />
  if (!isNew && !event.loading && !event.data) return <EmptyState icon="flag" title="Course introuvable" action={<Link to="/admin/courses" className="text-blood-400 underline">Retour</Link>} />
  if (!draft) return <LoadingBlock rows={8} />

  const e = event.data ?? null
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))
  const seasonClosed = !!e?.season_id && seasons.data?.find((s) => s.id === e.season_id)?.status === 'closed'

  const onKind = (kind: EventKind) => {
    setDraft((d) => {
      if (!d) return d
      const next = { ...d, kind, counts_for_standings: kind !== 'exhibition' && kind !== 'challenge' }
      if (!d.name.trim() || /^(Qualification #\d+|Urban Run — Groupe [A-D]|Navigation — Groupe [A-D]|Finale)/.test(d.name)) {
        next.name = kind === 'qualification' ? `Qualification #${d.session_number || ''}` : kind === 'finale' ? 'Finale' : kind === 'urban_run' ? `Urban Run — Groupe ${d.group_label || 'A'}` : kind === 'navigation' ? `Navigation — Groupe ${d.group_label || 'A'}` : d.name
      }
      return next
    })
  }

  const save = async () => {
    const errs = validate(draft)
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Vérifiez les champs signalés.')
      return
    }
    setBusy(true)
    try {
      const input = toInput(draft)
      if (isNew) {
        const created = await createEvent(input)
        toast.success('Course créée.')
        navigate(`/admin/courses/${created.id}`, { replace: true })
      } else {
        await updateEvent(id, input)
        toast.success('Modifications enregistrées.')
        await event.reload()
      }
    } catch (err) {
      toast.error(err)
    } finally {
      setBusy(false)
    }
  }

  const quickStatus = async (patch: Partial<EventInput>, msg: string) => {
    try {
      await updateEvent(id, patch)
      toast.success(msg)
      await event.reload()
    } catch (err) {
      toast.error(err)
    }
  }

  const seasonOptions = (seasons.data ?? []).map((s) => ({ value: s.id, label: `${s.name}${s.status === 'closed' ? ' (clôturée)' : s.status === 'draft' ? ' (brouillon)' : ''}`, disabled: s.status === 'closed' }))

  const details = (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        {seasonClosed && <Notice tone="warning">Cette épreuve appartient à une saison clôturée : elle est en lecture seule.</Notice>}
        <section className="panel-flat space-y-4 p-5">
          <h2 className="display text-2xl text-bone">Épreuve</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectInput label="Type d’épreuve" required value={draft.kind} onChange={(ev) => onKind(ev.target.value as EventKind)} options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} disabled={!!e && !isNew && event.data?.status === 'completed'} hint={`Phase : ${PHASE_LABEL[PHASE_FOR_KIND[draft.kind]]}`} />
            <SelectInput label="Saison" required={draft.kind !== 'exhibition'} value={draft.season_id} onChange={(ev) => set('season_id', ev.target.value)} placeholder={draft.kind === 'exhibition' ? 'Hors saison' : 'Choisir…'} options={seasonOptions} error={errors.season_id} />
            {draft.kind === 'qualification' && (
              <SelectInput
                label="Session"
                required
                value={draft.session_number}
                onChange={(ev) => {
                  const n = ev.target.value
                  setDraft((d) => (d ? { ...d, session_number: n, name: /^Qualification #\d*$/.test(d.name) || !d.name ? `Qualification #${n}` : d.name } : d))
                }}
                placeholder="Choisir…"
                error={errors.session_number}
                options={Array.from({ length: 8 }, (_, i) => ({ value: String(i + 1), label: `Session ${i + 1}${usedSessions.has(i + 1) ? ' (déjà utilisée)' : ''}` }))}
              />
            )}
            {(draft.kind === 'urban_run' || draft.kind === 'navigation') && (
              <SelectInput
                label="Groupe"
                required
                value={draft.group_label}
                onChange={(ev) => {
                  const g = ev.target.value
                  setDraft((d) => (d ? { ...d, group_label: g, name: /— Groupe [A-D]?$/.test(d.name) ? d.name.replace(/[A-D]?$/, g) : d.name } : d))
                }}
                placeholder="Choisir…"
                error={errors.group_label}
                options={['A', 'B', 'C', 'D'].map((g) => ({ value: g, label: `Groupe ${g}` }))}
              />
            )}
          </div>
          <TextInput label="Nom" required value={draft.name} onChange={(ev) => set('name', ev.target.value)} error={errors.name} maxLength={80} />
          <TextArea label="Description publique" value={draft.description} onChange={(ev) => set('description', ev.target.value)} rows={4} maxLength={4000} hint="Paragraphes séparés par une ligne vide ; listes avec « - »." />
        </section>

        <section className="panel-flat space-y-4 p-5">
          <h2 className="display text-2xl text-bone">Date, lieu & participation</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Date et heure" type="datetime-local" value={draft.starts_at} onChange={(ev) => set('starts_at', ev.target.value)} error={errors.starts_at} hint={`Fuseau : ${SITE_TIMEZONE}. Laisser vide si la date n’est pas fixée.`} />
            <TextInput label="Places" type="number" min={1} max={50} value={draft.capacity} onChange={(ev) => set('capacity', ev.target.value)} error={errors.capacity} hint={draft.kind === 'qualification' ? 'Plafonné par le maximum par session.' : 'Facultatif.'} />
          </div>
          <TextInput label="Lieu RP" value={draft.location_rp} onChange={(ev) => set('location_rp', ev.target.value)} maxLength={120} placeholder="Ex. Docks de Elysian Island" hint="Laisser vide pour ne rien afficher publiquement." />
          <TextArea label="Modalités de participation" value={draft.participation_info} onChange={(ev) => set('participation_info', ev.target.value)} rows={3} maxLength={2000} />
        </section>
      </div>

      <div className="space-y-6">
        <section className="panel-flat space-y-4 p-5">
          <h2 className="display text-2xl text-bone">Publication</h2>
          <Toggle label="Publié sur le site" hint="Un événement non publié n’est visible que dans le back-office." checked={draft.is_published} onChange={(v) => set('is_published', v)} />
          <Toggle label="Mis en avant" hint="Prioritaire dans la section « Prochaines courses »." checked={draft.featured} onChange={(v) => set('featured', v)} />
          <Toggle label="Compte pour le classement général" checked={draft.counts_for_standings} onChange={(v) => set('counts_for_standings', v)} disabled={draft.kind === 'challenge'} />
          <SelectInput
            label="Statut"
            value={draft.status}
            onChange={(ev) => set('status', ev.target.value as EventStatus)}
            options={EVENT_STATUSES.map((s) => ({ value: s, label: EVENT_STATUS_LABEL[s], disabled: s === 'completed' && !can('admin') }))}
            hint="« Terminé » se règle normalement depuis l’onglet Résultats."
          />
          <TextInput label="Note de statut (publique)" value={draft.status_note} onChange={(ev) => set('status_note', ev.target.value)} maxLength={200} placeholder="Ex. Reporté pour cause de présence policière" />
          <SelectInput
            label="Barème"
            value={draft.scale_id}
            onChange={(ev) => set('scale_id', ev.target.value)}
            placeholder="Barème de la saison (par défaut)"
            options={(scales.data ?? []).map((s) => ({ value: s.id, label: s.name + (s.is_default ? ' (défaut)' : '') }))}
            hint="Les points sont recalculés si le barème change."
          />
        </section>
        {!isNew && (
          <section className="panel-flat p-5">
            <h2 className="display mb-1 text-2xl text-bone">Notes internes</h2>
            <p className="mb-3 text-xs text-smoke">Jamais publiées.</p>
            <textarea className="field min-h-24" value={notesDraft ?? notes.data ?? ''} onChange={(ev) => setNotesDraft(ev.target.value)} maxLength={4000} />
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={notesDraft == null}
                onClick={async () => {
                  try {
                    await saveEventNotes(id, notesDraft ?? '')
                    toast.success('Notes enregistrées.')
                    setNotesDraft(null)
                    await notes.reload()
                  } catch (err) {
                    toast.error(err)
                  }
                }}
              >
                Enregistrer les notes
              </Button>
            </div>
          </section>
        )}
      </div>
      <div className="sticky bottom-0 z-20 -mx-4 flex justify-end gap-3 border-t border-ink-600 bg-ink-950/95 px-4 py-4 backdrop-blur xl:col-span-2">
        <Button variant="ghost" onClick={() => navigate('/admin/courses')}>Retour</Button>
        <Button onClick={save} loading={busy} disabled={seasonClosed} icon={<Icon name="check" size={15} />}>{isNew ? 'Créer la course' : 'Enregistrer'}</Button>
      </div>
    </div>
  )

  return (
    <>
      <Link to="/admin/courses" className="mb-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-smoke hover:text-bone">
        <Icon name="arrowLeft" size={14} /> Courses
      </Link>
      <AdminPageHeader
        title={isNew ? 'Nouvelle course' : e?.name ?? ''}
        kicker={e ? `${KIND_LABEL[e.kind]} · ${formatDateTime(e.starts_at)}` : 'Création'}
        actions={
          e && (
            <>
              {e.is_published && (
                <Link to={`/calendrier/${e.id}`} className="inline-flex items-center gap-1.5 border border-ink-600 px-3 py-2 text-xs uppercase tracking-wider text-smoke hover:text-bone">
                  <Icon name="eye" size={14} /> Page publique
                </Link>
              )}
              {!['completed', 'cancelled'].includes(e.status) && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setPostpone({ open: true, date: toLocalInput(e.starts_at), note: e.status_note ?? '' })}>Reporter</Button>
                  <Button size="sm" variant="outline" onClick={() => setCancel({ open: true, note: '' })}>Annuler l’événement</Button>
                </>
              )}
              {(e.status === 'cancelled' || e.status === 'postponed') && (
                <Button size="sm" variant="outline" onClick={() => quickStatus({ status: 'scheduled', status_note: null }, 'Événement rétabli.')}>Rétablir</Button>
              )}
              {can('admin') && (
                <Button size="sm" variant="danger" icon={<Icon name="trash" size={14} />} onClick={() => setDel(true)}>Supprimer</Button>
              )}
            </>
          )
        }
      >
        {e && (
          <span className="inline-flex flex-wrap items-center gap-2">
            <EventStatusBadge status={e.status} />
            {!e.is_published && <span className="text-xs text-amber-400">Non publié</span>}
            {e.is_demo && <DemoBadge />}
          </span>
        )}
      </AdminPageHeader>

      {!isNew && (
        <div className="mb-6">
          <Segmented
            label="Onglets"
            value={tab}
            onChange={(v) => setParams({ onglet: v === 'details' ? null : v })}
            options={[
              { value: 'details', label: 'Détails' },
              { value: 'participants', label: 'Participants' },
              { value: 'resultats', label: 'Résultats' },
            ]}
          />
        </div>
      )}

      {isNew || tab === 'details' ? (
        details
      ) : tab === 'participants' && e ? (
        <EventParticipants event={e} readOnly={seasonClosed} />
      ) : e ? (
        <EventResults event={e} season={seasons.data?.find((s) => s.id === e.season_id) ?? null} scales={scales.data ?? []} onChanged={() => void event.reload()} readOnly={seasonClosed || !can('admin')} />
      ) : null}

      <Modal
        open={postpone.open}
        onClose={() => setPostpone({ ...postpone, open: false })}
        title="Reporter l’événement"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPostpone({ ...postpone, open: false })}>Annuler</Button>
            <Button
              onClick={async () => {
                await quickStatus(
                  { status: 'postponed', starts_at: postpone.date ? fromLocalInput(postpone.date) : null, status_note: postpone.note.trim() || null },
                  'Événement reporté.',
                )
                setPostpone({ open: false, date: '', note: '' })
              }}
            >
              Reporter
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ash">La date initiale est conservée et affichée sur le site. Laissez la nouvelle date vide si elle n’est pas encore fixée.</p>
          <TextInput label="Nouvelle date" type="datetime-local" value={postpone.date} onChange={(ev) => setPostpone({ ...postpone, date: ev.target.value })} />
          <TextInput label="Motif (public)" value={postpone.note} onChange={(ev) => setPostpone({ ...postpone, note: ev.target.value })} maxLength={200} />
        </div>
      </Modal>

      <ConfirmDialog
        open={cancel.open}
        title="Annuler l’événement ?"
        confirmLabel="Annuler l’événement"
        danger
        onClose={() => setCancel({ open: false, note: '' })}
        onConfirm={() => quickStatus({ status: 'cancelled', status_note: cancel.note.trim() || null }, 'Événement annulé.')}
      >
        <p>L’événement restera visible avec la mention « Annulé ». Vous pourrez le rétablir.</p>
        <TextInput label="Motif (public, facultatif)" value={cancel.note} onChange={(ev) => setCancel({ ...cancel, note: ev.target.value })} maxLength={200} />
      </ConfirmDialog>

      <ConfirmDialog
        open={del}
        title="Supprimer définitivement ?"
        confirmLabel="Supprimer"
        danger
        confirmWord="SUPPRIMER"
        onClose={() => setDel(false)}
        onConfirm={async () => {
          try {
            await deleteEvent(id)
            toast.success('Événement supprimé.')
            navigate('/admin/courses')
          } catch (err) {
            toast.error(err)
          }
        }}
      >
        <p>L’événement « {e?.name} » et ses inscriptions seront supprimés. Un événement possédant des résultats officiels ne peut pas être supprimé : annulez-le ou effacez d’abord ses résultats.</p>
      </ConfirmDialog>
    </>
  )
}
