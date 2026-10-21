import { useEffect, useMemo, useState } from 'react'
import { useData } from '../../hooks/useData'
import { clearResults, listParticipants, listPilots, listResults, listStageEntries, saveResults, type ResultRowInput } from '../../lib/admin-api'
import { resultPoints, validateResultRows } from '../../lib/scoring'
import { OUTCOME_LABEL } from '../../lib/labels'
import type { BLEvent, PointScale, ResultOutcome, Season } from '../../lib/types'
import { useSite } from '../../components/layout/SiteContext'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { ConfirmDialog } from '../../components/ui/Modal'
import { EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/Toast'
import { PositionChip } from '../../components/race/Badges'
import { cx } from '../../components/ui/cx'

interface Row extends ResultRowInput {
  key: string
}

let seq = 0
const newRow = (pilot_id = ''): Row => ({
  key: `r${++seq}`,
  pilot_id,
  outcome: 'finished',
  position: null,
  adjustment: 0,
  adjustment_reason: null,
  checkpoint_ok: null,
  time_label: null,
  note: null,
})

/** Les positions découlent de l'ordre des lignes classées (1, 2, 3…) */
function withPositions(rows: Row[]): Row[] {
  let pos = 0
  const finished = rows.filter((r) => r.outcome === 'finished')
  const others = rows.filter((r) => r.outcome !== 'finished')
  return [...finished.map((r) => ({ ...r, position: ++pos })), ...others.map((r) => ({ ...r, position: null }))]
}

export default function EventResults({
  event,
  season,
  scales,
  onChanged,
  readOnly,
}: {
  event: BLEvent
  season: Season | null
  scales: PointScale[]
  onChanged: () => void
  readOnly?: boolean
}) {
  const toast = useToast()
  const { settings } = useSite()
  const results = useData(() => listResults(event.id), [event.id])
  const participants = useData(() => listParticipants(event.id), [event.id])
  const pilots = useData(() => listPilots(), [])
  const stages = useData(async () => (event.season_id ? listStageEntries(event.season_id) : []), [event.season_id])
  const [rows, setRows] = useState<Row[] | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const scale = useMemo(() => {
    const id = event.scale_id ?? season?.scale_id
    return (scales.find((s) => s.id === id) ?? scales.find((s) => s.is_default))?.entries ?? []
  }, [scales, event.scale_id, season?.scale_id])

  useEffect(() => {
    if (results.loading || participants.loading || dirty) return
    const existing = results.data ?? []
    if (existing.length) {
      const sorted = [...existing].sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
      setRows(
        withPositions(
          sorted.map((r) => ({
            key: `r${++seq}`,
            pilot_id: r.pilot_id,
            outcome: r.outcome,
            position: r.position,
            adjustment: r.adjustment,
            adjustment_reason: r.adjustment_reason,
            checkpoint_ok: r.checkpoint_ok,
            time_label: r.time_label,
            note: r.note,
          })),
        ),
      )
    } else {
      setRows(withPositions((participants.data ?? []).filter((p) => p.status !== 'withdrawn').map((p) => newRow(p.pilot_id))))
    }
  }, [results.data, results.loading, participants.data, participants.loading, dirty])

  const pilotName = useMemo(() => new Map((pilots.data ?? []).map((p) => [p.id, p.pseudonym])), [pilots.data])
  const eligibleIds = useMemo(() => {
    const st = stages.data ?? []
    const ps = (pilots.data ?? []).filter((p) => p.status !== 'banned' && p.status !== 'archived')
    return ps
      .filter((p) => {
        if (event.kind === 'qualification') return !st.some((s) => s.pilot_id === p.id && s.stage === 'runner' && s.source_event_id !== event.id)
        if (event.kind === 'urban_run' || event.kind === 'navigation') return st.some((s) => s.pilot_id === p.id && s.stage === 'runner' && s.group_label === event.group_label)
        if (event.kind === 'finale') return st.some((s) => s.pilot_id === p.id && s.stage === 'challenger')
        return true
      })
      .map((p) => p.id)
  }, [pilots.data, stages.data, event])

  const limit = event.kind === 'qualification' ? Math.min(event.capacity ?? 99, settings?.max_pilots_per_session ?? 10) : event.capacity
  const errors = rows ? validateResultRows(rows, { kind: event.kind, limit }) : []
  const locked =
    (event.kind === 'qualification' && (stages.data ?? []).some((s) => s.stage === 'runner' && s.source_event_id === event.id)) ||
    ((event.kind === 'urban_run' || event.kind === 'navigation') &&
      (stages.data ?? []).some((s) => s.stage === 'challenger' && s.group_label === event.group_label)) ||
    (event.kind === 'finale' && (stages.data ?? []).some((s) => s.stage === 'elite' && s.source === 'competition'))
  const disabled = readOnly || locked

  const update = (key: string, patch: Partial<Row>) => {
    setDirty(true)
    setRows((rs) => (rs ? withPositions(rs.map((r) => (r.key === key ? { ...r, ...patch } : r))) : rs))
  }
  const move = (key: string, dir: -1 | 1) => {
    setDirty(true)
    setRows((rs) => {
      if (!rs) return rs
      const list = [...rs]
      const i = list.findIndex((r) => r.key === key)
      const j = i + dir
      if (j < 0 || j >= list.length || list[j].outcome !== list[i].outcome) return rs
      ;[list[i], list[j]] = [list[j], list[i]]
      return withPositions(list)
    })
  }

  const submit = async (complete: boolean) => {
    if (!rows) return
    setServerError(null)
    if (errors.length) return
    setBusy(true)
    try {
      await saveResults(
        event.id,
        rows.map(({ key: _k, ...r }) => ({
          ...r,
          checkpoint_ok: event.kind === 'navigation' ? Boolean(r.checkpoint_ok) : r.checkpoint_ok,
          adjustment: Math.trunc(Number(r.adjustment) || 0),
        })),
        complete,
      )
      toast.success(complete ? 'Résultats officiels enregistrés : classement mis à jour.' : 'Résultats enregistrés.')
      setDirty(false)
      await results.reload()
      onChanged()
    } catch (e) {
      const msg = (e as { message?: string }).message ?? 'Erreur'
      setServerError(msg)
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  if (results.error) return <ErrorState error={results.error} onRetry={results.reload} />
  if (!rows || pilots.loading) return <LoadingBlock rows={8} />

  const total = rows.reduce((s, r) => s + resultPoints(r, scale, event.kind).total, 0)
  const used = new Set(rows.map((r) => r.pilot_id))

  return (
    <div className="space-y-5">
      {event.status === 'cancelled' && <Notice tone="warning">Cet événement est annulé : rétablissez-le avant de saisir des résultats.</Notice>}
      {locked && (
        <Notice tone="info" title="Résultats verrouillés">
          Une sélection (qualifiés, finalistes ou Elite) a été validée à partir de ces résultats. Pour les corriger, annulez d’abord la validation dans « Phases & sélection ».
        </Notice>
      )}
      {readOnly && !locked && <Notice tone="info">Lecture seule : la saisie des résultats est réservée aux administrateurs (et impossible sur une saison clôturée).</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ash">
        <p>
          Ordonnez les pilotes classés dans l’ordre d’arrivée : la position et les points sont calculés automatiquement
          {scale.length ? '' : ' (aucun barème trouvé !)'}.
          {event.kind === 'navigation' && ' En Navigation, cochez le checkpoint validé par l’organisateur.'}
        </p>
        <span className="font-mono text-xs text-smoke">{rows.length}{limit ? ` / ${limit}` : ''} pilotes · {total} pts distribués</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="flag" title="Aucun pilote" action={!disabled && <Button onClick={() => { setDirty(true); setRows([newRow()]) }}>Ajouter une ligne</Button>}>
          Inscrivez les participants dans l’onglet « Participants » ou ajoutez des lignes directement.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto border border-ink-600">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-ink-900 text-left">
              <tr>
                <th className="label w-24 px-3 py-3">Pos.</th>
                <th className="label px-3 py-3">Pilote</th>
                <th className="label px-3 py-3">Statut</th>
                {event.kind === 'navigation' && <th className="label px-3 py-3">Checkpoint</th>}
                <th className="label px-3 py-3">Pénalité / bonus</th>
                <th className="label px-3 py-3">Temps</th>
                <th className="label px-3 py-3 text-right">Points</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const pts = resultPoints(r, scale, event.kind)
                const options = (pilots.data ?? []).filter((p) => p.id === r.pilot_id || (!used.has(p.id) && eligibleIds.includes(p.id)))
                return (
                  <tr key={r.key} className={cx('border-t border-ink-700 align-top', r.outcome !== 'finished' && 'bg-ink-900/40')}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <PositionChip position={r.position} size="sm" />
                        {!disabled && (
                          <span className="flex flex-col">
                            <button className="px-1 text-smoke hover:text-bone disabled:opacity-20" disabled={i === 0 || rows[i - 1].outcome !== r.outcome} onClick={() => move(r.key, -1)} aria-label="Monter">
                              <Icon name="chevronDown" size={14} className="rotate-180" />
                            </button>
                            <button className="px-1 text-smoke hover:text-bone disabled:opacity-20" disabled={i === rows.length - 1 || rows[i + 1].outcome !== r.outcome} onClick={() => move(r.key, 1)} aria-label="Descendre">
                              <Icon name="chevronDown" size={14} />
                            </button>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <select className="field py-1.5" value={r.pilot_id} disabled={disabled} onChange={(e) => update(r.key, { pilot_id: e.target.value })} aria-label="Pilote">
                        <option value="">Choisir…</option>
                        {options.map((p) => <option key={p.id} value={p.id}>{p.pseudonym}</option>)}
                        {r.pilot_id && !options.some((p) => p.id === r.pilot_id) && <option value={r.pilot_id}>{pilotName.get(r.pilot_id) ?? 'Pilote'}</option>}
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        className="field py-1.5"
                        value={r.outcome}
                        disabled={disabled}
                        onChange={(e) => update(r.key, { outcome: e.target.value as ResultOutcome, ...(e.target.value === 'dsq' && event.kind === 'navigation' ? { checkpoint_ok: false } : {}) })}
                        aria-label="Statut"
                      >
                        {(['finished', 'dnf', 'dsq', 'dns'] as ResultOutcome[]).map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
                      </select>
                    </td>
                    {event.kind === 'navigation' && (
                      <td className="px-3 py-2.5">
                        <label className="inline-flex items-center gap-2 pt-2 text-xs text-ash">
                          <input type="checkbox" className="size-4 accent-[#e1141e]" checked={Boolean(r.checkpoint_ok)} disabled={disabled} onChange={(e) => update(r.key, { checkpoint_ok: e.target.checked })} />
                          Validé
                        </label>
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          className="field w-20 py-1.5"
                          value={r.adjustment || ''}
                          placeholder="0"
                          min={-100}
                          max={100}
                          disabled={disabled}
                          onChange={(e) => update(r.key, { adjustment: Number(e.target.value) || 0 })}
                          aria-label="Pénalité ou bonus"
                        />
                        {r.adjustment !== 0 && (
                          <input
                            className="field py-1.5"
                            placeholder="Motif (obligatoire)"
                            value={r.adjustment_reason ?? ''}
                            disabled={disabled}
                            maxLength={200}
                            onChange={(e) => update(r.key, { adjustment_reason: e.target.value })}
                            aria-label="Motif"
                            aria-invalid={(r.adjustment_reason ?? '').trim().length < 3 || undefined}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <input className="field w-28 py-1.5 font-mono" placeholder="—" value={r.time_label ?? ''} disabled={disabled} maxLength={20} onChange={(e) => update(r.key, { time_label: e.target.value || null })} aria-label="Temps" />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="font-display text-2xl font-extrabold italic text-bone tabular">{pts.total}</span>
                      {r.adjustment !== 0 && <span className="block text-[0.68rem] text-smoke">{pts.base} {r.adjustment > 0 ? '+' : '−'} {Math.abs(r.adjustment)}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {!disabled && (
                        <button className="p-1.5 text-smoke hover:text-blood-400" onClick={() => { setDirty(true); setRows((rs) => (rs ? withPositions(rs.filter((x) => x.key !== r.key)) : rs)) }} aria-label="Retirer la ligne">
                          <Icon name="close" size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {errors.length > 0 && rows.length > 0 && (
        <Notice tone="danger" title="À corriger avant l’enregistrement">
          <ul className="list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </Notice>
      )}
      {serverError && <Notice tone="danger" title="Refusé par la base de données">{serverError}</Notice>}

      {!disabled && (
        <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-600 bg-ink-950/95 px-4 py-4 backdrop-blur">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" icon={<Icon name="plus" size={14} />} onClick={() => { setDirty(true); setRows((rs) => withPositions([...(rs ?? []), newRow()])) }}>
              Ajouter un pilote
            </Button>
            {(results.data ?? []).length > 0 && (
              <Button variant="ghost" size="sm" icon={<Icon name="trash" size={14} />} onClick={() => setConfirmClear(true)}>
                Effacer les résultats
              </Button>
            )}
            {dirty && (
              <Button variant="ghost" size="sm" onClick={() => setDirty(false)}>Annuler les modifications</Button>
            )}
          </div>
          <div className="flex gap-2">
            {event.status !== 'completed' && (
              <Button variant="outline" loading={busy} disabled={!!errors.length || !rows.length} onClick={() => submit(false)}>
                Enregistrer sans terminer
              </Button>
            )}
            <Button loading={busy} disabled={!!errors.length || !rows.length} icon={<Icon name="flag" size={15} />} onClick={() => submit(true)}>
              {event.status === 'completed' ? 'Enregistrer les corrections' : 'Valider : course terminée'}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Effacer tous les résultats ?"
        confirmLabel="Effacer"
        danger
        confirmWord="EFFACER"
        onClose={() => setConfirmClear(false)}
        onConfirm={async () => {
          try {
            await clearResults(event.id)
            toast.success('Résultats effacés : la course repasse en « Programmé ».')
            setDirty(false)
            await results.reload()
            onChanged()
          } catch (e) {
            toast.error(e)
          }
        }}
      >
        <p>Les points de cette épreuve seront retirés du classement général. L’opération est journalisée.</p>
      </ConfirmDialog>
    </div>
  )
}
