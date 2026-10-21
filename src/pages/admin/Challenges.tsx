import { useEffect, useMemo, useState } from 'react'
import { useData } from '../../hooks/useData'
import { useAuth } from '../../lib/auth'
import { createChallenge, declineChallenge, deleteChallenge, listChallenges, listPilots, resolveChallenge, updateChallenge } from '../../lib/admin-api'
import { formatDateTimeShort, formatShortDate, fromLocalInput, toLocalInput } from '../../lib/format'
import { CHALLENGE_OUTCOME_LABEL, CHALLENGE_STATUS_LABEL, CHALLENGE_STATUS_TONE } from '../../lib/labels'
import type { ChallengeStatus, EliteChallenge } from '../../lib/types'
import { useSite } from '../../components/layout/SiteContext'
import { AdminPageHeader } from './AdminLayout'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Segmented, SelectInput, TextArea, TextInput, Toggle } from '../../components/ui/Form'
import { Badge, DemoBadge, EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/Toast'

type Dialog =
  | { kind: 'create' }
  | { kind: 'schedule'; c: EliteChallenge }
  | { kind: 'result'; c: EliteChallenge }
  | { kind: 'decline'; c: EliteChallenge }
  | { kind: 'delete'; c: EliteChallenge }
  | null

export default function Challenges() {
  const toast = useToast()
  const { can } = useAuth()
  const { settings } = useSite()
  const challenges = useData(() => listChallenges(), [])
  const pilots = useData(() => listPilots(), [])
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [form, setForm] = useState({ challenger: '', elite: '', note: '', date: '', location: '', format: '', winner: '', reason: '', forfeit: false })

  useEffect(() => {
    document.title = 'Challenges Elite — Back-office'
  }, [])

  const name = useMemo(() => new Map((pilots.data ?? []).map((p) => [p.id, p.pseudonym])), [pilots.data])
  const elites = (pilots.data ?? []).filter((p) => p.rank === 'elite' && p.status !== 'banned')
  const challengers = (pilots.data ?? []).filter((p) => p.rank !== 'elite' && p.status === 'active')
  const list = (challenges.data ?? []).filter((c) =>
    filter === 'all' ? true : filter === 'open' ? ['pending', 'accepted', 'scheduled'].includes(c.status) : ['completed', 'refused', 'cancelled'].includes(c.status),
  )

  const run = async (fn: () => Promise<void>, msg: string) => {
    try {
      await fn()
      toast.success(msg)
      setDialog(null)
      await Promise.all([challenges.reload(), pilots.reload()])
    } catch (e) {
      toast.error(e)
    }
  }
  const open = (d: Dialog) => {
    const c = d && 'c' in d ? d.c : null
    setForm({
      challenger: '',
      elite: '',
      note: '',
      date: toLocalInput(c?.scheduled_at),
      location: c?.location_rp ?? '',
      format: c?.format ?? settings?.challenge_format ?? '',
      winner: '',
      reason: '',
      forfeit: false,
    })
    setDialog(d)
  }
  const setStatus = (c: EliteChallenge, status: ChallengeStatus, msg: string) => run(() => updateChallenge(c.id, { status }), msg)

  return (
    <>
      <AdminPageHeader title="Challenges Elite" actions={<Button icon={<Icon name="plus" size={15} />} onClick={() => open({ kind: 'create' })}>Enregistrer une demande</Button>}>
        Les demandes arrivent par DarkChat auprès de Sullivan ou Nyra. Enregistrez-les ici, validez-les, programmez le duel puis saisissez le résultat :
        les rangs sont mis à jour automatiquement.
      </AdminPageHeader>

      <div className="mb-5">
        <Segmented label="Filtre" value={filter} onChange={setFilter} options={[{ value: 'open', label: 'En cours' }, { value: 'closed', label: 'Clos' }, { value: 'all', label: 'Tous' }]} />
      </div>

      {challenges.error ? (
        <ErrorState error={challenges.error} onRetry={challenges.reload} />
      ) : challenges.loading || pilots.loading ? (
        <LoadingBlock rows={5} />
      ) : list.length === 0 ? (
        <EmptyState icon="swords" title="Aucun défi">{filter === 'open' ? 'Aucune demande en cours.' : 'Aucun défi pour ce filtre.'}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c.id} className="panel-flat p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={CHALLENGE_STATUS_TONE[c.status]}>{CHALLENGE_STATUS_LABEL[c.status]}</Badge>
                    {c.is_demo && <DemoBadge />}
                    <span className="text-xs text-smoke">Demande du {formatShortDate(c.created_at)}</span>
                  </div>
                  <p className="display mt-2 text-3xl">
                    <span className={c.winner_id === c.challenger_id ? 'text-blood-400' : 'text-bone'}>{name.get(c.challenger_id)}</span>
                    <span className="mx-3 font-mono text-base not-italic text-smoke">défie</span>
                    <span className={c.winner_id === c.elite_id ? 'text-blood-400' : 'text-bone'}>{name.get(c.elite_id)}</span>
                  </p>
                  <div className="mt-2 space-y-0.5 text-sm text-ash">
                    {c.scheduled_at && <p><Icon name="clock" size={14} className="mr-1.5 inline text-smoke" />{formatDateTimeShort(c.scheduled_at)}{c.location_rp ? ` · ${c.location_rp}` : ''}</p>}
                    {c.format && <p className="text-xs text-smoke">{c.format}</p>}
                    {c.request_note && <p className="text-xs text-smoke">« {c.request_note} »</p>}
                    {c.outcome && <p className="text-bone">{CHALLENGE_OUTCOME_LABEL[c.outcome]}{c.result_note ? ` — ${c.result_note}` : ''}</p>}
                    {c.refusal_reason && c.status === 'refused' && <p className="text-xs text-smoke">Motif du refus : {c.refusal_reason}</p>}
                    {c.cooldown_until && new Date(c.cooldown_until) > new Date() && (
                      <p className="text-xs text-amber-400">Nouveau défi possible à partir du {formatShortDate(c.cooldown_until)}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.status === 'pending' && (
                    <>
                      <Button size="sm" onClick={() => setStatus(c, 'accepted', 'Demande validée : contactez le pilote Elite.')}>Valider la demande</Button>
                      <Button size="sm" variant="outline" onClick={() => open({ kind: 'decline', c })}>Refuser</Button>
                    </>
                  )}
                  {(c.status === 'accepted' || c.status === 'scheduled') && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => open({ kind: 'schedule', c })}>{c.status === 'scheduled' ? 'Modifier la date' : 'Programmer le duel'}</Button>
                      <Button size="sm" onClick={() => open({ kind: 'result', c })} icon={<Icon name="flag" size={14} />}>Résultat</Button>
                      <Button size="sm" variant="ghost" onClick={() => open({ kind: 'decline', c })}>Refus de l’Elite</Button>
                    </>
                  )}
                  {['pending', 'accepted', 'scheduled'].includes(c.status) && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(c, 'cancelled', 'Défi annulé.')}>Annuler</Button>
                  )}
                  {can('owner') && c.status !== 'completed' && (
                    <button className="p-2 text-smoke hover:text-blood-400" aria-label="Supprimer" onClick={() => open({ kind: 'delete', c })}><Icon name="trash" size={16} /></button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={dialog?.kind === 'create'}
        onClose={() => setDialog(null)}
        title="Nouvelle demande de défi"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Annuler</Button>
            <Button disabled={!form.challenger || !form.elite} onClick={() => run(() => createChallenge({ challenger_id: form.challenger, elite_id: form.elite, request_note: form.note.trim() || null }), 'Demande enregistrée.')}>
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {!elites.length && <Notice tone="warning">Aucun pilote n’a actuellement le rang Elite.</Notice>}
          <SelectInput label="Pilote demandeur" required value={form.challenger} onChange={(e) => setForm({ ...form, challenger: e.target.value })} placeholder="Choisir…" options={challengers.map((p) => ({ value: p.id, label: p.pseudonym }))} />
          <SelectInput label="Pilote Elite défié" required value={form.elite} onChange={(e) => setForm({ ...form, elite: e.target.value })} placeholder="Choisir…" options={elites.map((p) => ({ value: p.id, label: p.pseudonym }))} />
          <TextArea label="Demande exposée" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} maxLength={1000} hint="Interne. Les délais d’attente après une défaite sont vérifiés automatiquement." />
        </div>
      </Modal>

      <Modal
        open={dialog?.kind === 'schedule'}
        onClose={() => setDialog(null)}
        title="Programmer le duel"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Annuler</Button>
            <Button
              disabled={!form.date}
              onClick={() =>
                dialog?.kind === 'schedule' &&
                run(
                  () => updateChallenge(dialog.c.id, { status: 'scheduled', scheduled_at: fromLocalInput(form.date), location_rp: form.location.trim() || null, format: form.format.trim() || null }),
                  'Duel programmé.',
                )
              }
            >
              Programmer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextInput label="Date et heure" type="datetime-local" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <TextInput label="Lieu RP" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={120} />
          <TextInput label="Format" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} maxLength={120} />
          <p className="text-xs text-smoke">Un duel programmé apparaît sur la page Qualifications du site public (pseudonymes, date et format uniquement).</p>
        </div>
      </Modal>

      <Modal
        open={dialog?.kind === 'result'}
        onClose={() => setDialog(null)}
        title="Résultat du duel"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Annuler</Button>
            <Button disabled={!form.winner} onClick={() => dialog?.kind === 'result' && run(() => resolveChallenge(dialog.c.id, form.winner, form.reason.trim()), 'Résultat enregistré : rangs mis à jour.')}>
              Enregistrer le résultat
            </Button>
          </>
        }
      >
        {dialog?.kind === 'result' && (
          <div className="space-y-4">
            <SelectInput
              label="Vainqueur"
              required
              value={form.winner}
              onChange={(e) => setForm({ ...form, winner: e.target.value })}
              placeholder="Choisir…"
              options={[
                { value: dialog.c.challenger_id, label: `${name.get(dialog.c.challenger_id)} (challenger)` },
                { value: dialog.c.elite_id, label: `${name.get(dialog.c.elite_id)} (Elite)` },
              ]}
            />
            <Notice tone="info">
              Victoire du challenger : il devient Elite et {name.get(dialog.c.elite_id)} redevient Challenger. Défaite : le challenger devra attendre{' '}
              {settings?.challenge_cooldown_days ?? 14} jours avant un nouveau défi.
            </Notice>
            <TextInput label="Commentaire (facultatif)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={500} />
          </div>
        )}
      </Modal>

      <Modal
        open={dialog?.kind === 'decline'}
        onClose={() => setDialog(null)}
        title={dialog?.kind === 'decline' && dialog.c.status === 'pending' ? 'Refuser la demande' : 'Refus du pilote Elite'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Annuler</Button>
            <Button
              variant={form.forfeit ? 'danger' : 'primary'}
              disabled={form.reason.trim().length < 3}
              onClick={() => dialog?.kind === 'decline' && run(() => declineChallenge(dialog.c.id, form.reason.trim(), form.forfeit), form.forfeit ? 'Forfait enregistré : le challenger prend la place Elite.' : 'Défi refusé.')}
            >
              Confirmer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextArea label="Motif" required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} maxLength={300} />
          {dialog?.kind === 'decline' && dialog.c.status !== 'pending' && (
            <Toggle
              label="Refus sans raison valable et sérieuse"
              hint="Conformément au règlement, le pilote Elite perd sa place au profit du challenger (forfait)."
              checked={form.forfeit}
              onChange={(v) => setForm({ ...form, forfeit: v })}
            />
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        title="Supprimer ce défi ?"
        confirmLabel="Supprimer"
        danger
        onClose={() => setDialog(null)}
        onConfirm={() => (dialog?.kind === 'delete' ? run(() => deleteChallenge(dialog.c.id), 'Défi supprimé.') : undefined)}
      >
        <p>La demande sera définitivement supprimée. Préférez « Annuler » pour garder une trace.</p>
      </ConfirmDialog>
    </>
  )
}
