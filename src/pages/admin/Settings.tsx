import { useEffect, useState } from 'react'
import { useData } from '../../hooks/useData'
import { createScale, deleteScale, recalculatePoints, saveScale, setDefaultScale, updateSettings } from '../../lib/admin-api'
import { getScales, getSettings } from '../../lib/api'
import { ordinal } from '../../lib/format'
import type { CompetitionSettings, PointScale, ScaleEntry } from '../../lib/types'
import { useSite } from '../../components/layout/SiteContext'
import { AdminPageHeader } from './AdminLayout'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { SelectInput, TextInput } from '../../components/ui/Form'
import { Badge, ErrorState, LoadingBlock, Notice } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/Toast'

type NumKey = 'sessions_count' | 'max_pilots_per_session' | 'qualifiers_per_session' | 'elite_group_count' | 'elite_group_size' | 'finalists_per_group' | 'elite_count' | 'challenge_cooldown_days'

const NUM_FIELDS: { key: NumKey; label: string; min: number; max: number }[] = [
  { key: 'sessions_count', label: 'Sessions de qualification', min: 1, max: 12 },
  { key: 'max_pilots_per_session', label: 'Pilotes max. par session', min: 2, max: 40 },
  { key: 'qualifiers_per_session', label: 'Qualifiés par session', min: 1, max: 20 },
  { key: 'elite_group_count', label: 'Groupes en phase Élite', min: 1, max: 4 },
  { key: 'elite_group_size', label: 'Pilotes par groupe', min: 2, max: 20 },
  { key: 'finalists_per_group', label: 'Finalistes par groupe', min: 1, max: 20 },
  { key: 'elite_count', label: 'Pilotes Elite par saison', min: 1, max: 20 },
  { key: 'challenge_cooldown_days', label: 'Délai après un Challenge perdu (jours)', min: 0, max: 365 },
]

function ScaleEditor({ scale, onSaved }: { scale: PointScale; onSaved: () => void }) {
  const toast = useToast()
  const [name, setName] = useState(scale.name)
  const [description, setDescription] = useState(scale.description ?? '')
  const [entries, setEntries] = useState<ScaleEntry[]>(scale.entries)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<null | 'save' | 'delete'>(null)
  useEffect(() => {
    setName(scale.name)
    setDescription(scale.description ?? '')
    setEntries(scale.entries)
  }, [scale])

  const dirty = JSON.stringify(entries) !== JSON.stringify(scale.entries) || name !== scale.name || description !== (scale.description ?? '')
  const invalid = entries.some((e) => e.points < 0 || e.points > 1000 || !Number.isInteger(e.points)) || name.trim().length < 2

  return (
    <div className="panel-flat p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="display text-2xl text-bone">{scale.name}</h3>
          {scale.is_default && <Badge tone="red">Par défaut</Badge>}
        </div>
        <div className="flex gap-2">
          {!scale.is_default && (
            <Button size="sm" variant="outline" onClick={async () => { try { await setDefaultScale(scale.id); toast.success('Barème par défaut modifié : points recalculés.'); onSaved() } catch (e) { toast.error(e) } }}>
              Définir par défaut
            </Button>
          )}
          {!scale.is_default && (
            <button className="p-2 text-smoke hover:text-blood-400" aria-label="Supprimer le barème" onClick={() => setConfirm('delete')}><Icon name="trash" size={16} /></button>
          )}
        </div>
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <TextInput label="Nom" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <TextInput label="Description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {entries.map((e, i) => (
          <label key={e.position} className="border border-ink-600 p-2">
            <span className="label block text-[0.65rem]">{ordinal(e.position)}</span>
            <input
              type="number"
              min={0}
              max={1000}
              className="field mt-1 py-1 font-mono"
              value={e.points}
              onChange={(ev) => setEntries(entries.map((x, j) => (j === i ? { ...x, points: Math.max(0, Math.trunc(Number(ev.target.value) || 0)) } : x)))}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" icon={<Icon name="plus" size={13} />} disabled={entries.length >= 50} onClick={() => setEntries([...entries, { position: entries.length + 1, points: 0 }])}>Position</Button>
          <Button size="sm" variant="ghost" disabled={entries.length <= 1} onClick={() => setEntries(entries.slice(0, -1))}>Retirer la dernière</Button>
        </div>
        <Button size="sm" disabled={!dirty || invalid} loading={busy} onClick={() => setConfirm('save')}>Enregistrer le barème</Button>
      </div>
      <p className="mt-2 text-xs text-smoke">Les positions au-delà du barème rapportent 0 point.</p>

      <ConfirmDialog
        open={confirm === 'save'}
        title="Modifier le barème ?"
        confirmLabel="Enregistrer et recalculer"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          setBusy(true)
          try {
            await saveScale(scale.id, { name: name.trim(), description: description.trim() }, entries)
            toast.success('Barème enregistré : les points des saisons en cours ont été recalculés.')
            onSaved()
          } catch (e) {
            toast.error(e)
          } finally {
            setBusy(false)
          }
        }}
      >
        <p>Les points de toutes les épreuves des saisons non clôturées utilisant ce barème seront recalculés immédiatement. Les saisons clôturées restent figées. L’opération est journalisée.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Supprimer ce barème ?"
        confirmLabel="Supprimer"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          try {
            await deleteScale(scale.id)
            toast.success('Barème supprimé.')
            onSaved()
          } catch (e) {
            toast.error(e)
          }
        }}
      >
        <p>Impossible s’il est utilisé par une saison ou une épreuve.</p>
      </ConfirmDialog>
    </div>
  )
}

export default function Settings() {
  const toast = useToast()
  const site = useSite()
  const settings = useData(() => getSettings(), [])
  const scales = useData(() => getScales(), [])
  const [draft, setDraft] = useState<CompetitionSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [newScale, setNewScale] = useState<{ open: boolean; name: string }>({ open: false, name: '' })

  useEffect(() => {
    document.title = 'Paramètres — Back-office'
  }, [])
  useEffect(() => {
    if (settings.data) setDraft(settings.data)
  }, [settings.data])

  if (settings.error) return <ErrorState error={settings.error} onRetry={settings.reload} />
  if (!draft) return <LoadingBlock rows={8} />

  const totalQualified = draft.sessions_count * draft.qualifiers_per_session
  const groupCapacity = draft.elite_group_count * draft.elite_group_size
  const issues: string[] = []
  if (draft.qualifiers_per_session > draft.max_pilots_per_session) issues.push('Plus de qualifiés que de pilotes par session.')
  if (draft.finalists_per_group > draft.elite_group_size) issues.push('Plus de finalistes que de pilotes par groupe.')
  if (draft.elite_count > draft.elite_group_count * draft.finalists_per_group) issues.push('Plus de pilotes Elite que de finalistes.')
  const warn = totalQualified !== groupCapacity ? `${totalQualified} qualifiés pour ${groupCapacity} places en phase Élite : vérifiez la cohérence.` : null
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.data)

  return (
    <>
      <AdminPageHeader title="Barèmes & paramètres">
        Ces paramètres pilotent les calculs et les textes publics (via les variables). Modifiables sans toucher au code ; chaque changement est journalisé.
      </AdminPageHeader>

      <div className="grid gap-8 xl:grid-cols-2">
        <section className="panel-flat space-y-5 p-5">
          <h2 className="display text-3xl text-bone">Format de compétition</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {NUM_FIELDS.map((f) => (
              <TextInput
                key={f.key}
                label={f.label}
                type="number"
                min={f.min}
                max={f.max}
                value={draft[f.key]}
                onChange={(e) => setDraft({ ...draft, [f.key]: Math.max(f.min, Math.min(f.max, Math.trunc(Number(e.target.value) || f.min))) })}
              />
            ))}
          </div>
          <TextInput label="Format du duel Challenge Elite" value={draft.challenge_format} onChange={(e) => setDraft({ ...draft, challenge_format: e.target.value })} maxLength={120} />
          <SelectInput
            label="Départage des égalités"
            value={draft.tiebreak_policy}
            onChange={(e) => setDraft({ ...draft, tiebreak_policy: e.target.value as CompetitionSettings['tiebreak_policy'] })}
            options={[
              { value: 'manual', label: 'Manuel : toute égalité à la limite est tranchée et justifiée par un administrateur' },
              { value: 'best_finish_then_manual', label: 'Meilleure place obtenue, puis manuel si l’égalité persiste' },
            ]}
            hint="Aucune place n’est jamais attribuée arbitrairement."
          />
          {issues.length > 0 && <Notice tone="danger">{issues.join(' ')}</Notice>}
          {warn && !issues.length && <Notice tone="warning">{warn}</Notice>}
          <div className="flex justify-end gap-2">
            {dirty && <Button variant="ghost" onClick={() => setDraft(settings.data ?? null)}>Annuler</Button>}
            <Button
              disabled={!dirty || issues.length > 0}
              loading={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  const { id: _id, updated_at: _u, ...patch } = draft
                  await updateSettings(patch)
                  toast.success('Paramètres enregistrés.')
                  await settings.reload()
                } catch (e) {
                  toast.error(e)
                } finally {
                  setBusy(false)
                }
              }}
            >
              Enregistrer
            </Button>
          </div>
          {site.settings && dirty && <p className="text-xs text-smoke">Les textes publics utilisant les variables seront mis à jour automatiquement.</p>}
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="display text-3xl text-bone">Barèmes de points</h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                icon={<Icon name="refresh" size={14} />}
                onClick={async () => {
                  try {
                    const n = await recalculatePoints(null)
                    toast.success(`${n} résultat(s) recalculé(s).`)
                  } catch (e) {
                    toast.error(e)
                  }
                }}
              >
                Recalculer tous les points
              </Button>
              <Button size="sm" variant="outline" icon={<Icon name="plus" size={14} />} onClick={() => setNewScale({ open: true, name: '' })}>Nouveau barème</Button>
            </div>
          </div>
          {scales.error ? (
            <ErrorState error={scales.error} onRetry={scales.reload} />
          ) : scales.loading ? (
            <LoadingBlock rows={4} />
          ) : (
            (scales.data ?? []).map((s) => <ScaleEditor key={s.id} scale={s} onSaved={() => void scales.reload()} />)
          )}
        </section>
      </div>

      <Modal
        open={newScale.open}
        onClose={() => setNewScale({ open: false, name: '' })}
        title="Nouveau barème"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewScale({ open: false, name: '' })}>Annuler</Button>
            <Button
              disabled={newScale.name.trim().length < 2}
              onClick={async () => {
                try {
                  const base = (scales.data ?? []).find((s) => s.is_default)?.entries ?? []
                  await createScale(newScale.name.trim(), '', base)
                  toast.success('Barème créé (copie du barème par défaut).')
                  setNewScale({ open: false, name: '' })
                  await scales.reload()
                } catch (e) {
                  toast.error(e)
                }
              }}
            >
              Créer
            </Button>
          </>
        }
      >
        <TextInput label="Nom" value={newScale.name} onChange={(e) => setNewScale({ ...newScale, name: e.target.value })} maxLength={60} hint="Le barème par défaut sert de point de départ. Associez-le ensuite à une saison ou une épreuve." />
      </Modal>
    </>
  )
}
