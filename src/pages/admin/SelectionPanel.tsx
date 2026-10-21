import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { analyzeSelection, checkSelection } from '../../lib/scoring'
import type { StageRankingRow } from '../../lib/types'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Notice } from '../../components/ui/primitives'
import { PositionChip } from '../../components/race/Badges'
import { cx } from '../../components/ui/cx'

/**
 * Validation d'une sélection (qualifiés, finalistes, Elite). Applique la même
 * règle que la base : les mieux classés sont retenus d'office ; en cas
 * d'égalité à la limite, l'administrateur choisit et justifie le départage.
 */
export function SelectionPanel({
  ranking,
  wanted,
  confirmed,
  columns = [],
  onConfirm,
  onRevert,
  blockedReason,
  confirmLabel,
  extra,
}: {
  ranking: StageRankingRow[]
  wanted: number
  confirmed: string[]
  columns?: { id: string; label: string }[]
  onConfirm: (selected: string[], note: string) => Promise<void>
  onRevert?: () => Promise<void>
  blockedReason?: string | null
  confirmLabel: string
  extra?: ReactNode
}) {
  const analysis = useMemo(() => analyzeSelection(ranking, wanted), [ranking, wanted])
  const [selected, setSelected] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const isConfirmed = confirmed.length > 0
  const confirmedKey = confirmed.join(',')

  useEffect(() => {
    setSelected(confirmedKey ? confirmedKey.split(',') : analysis.suggested ?? analysis.certain)
    setNote('')
  }, [analysis, confirmedKey])

  const check = checkSelection(ranking, selected, wanted, note)
  const cutRank = analysis.n > 0 ? [...ranking].sort((a, b) => a.tie_rank - b.tie_rank)[analysis.n - 1]?.tie_rank : null

  const toggle = (id: string) => {
    if (isConfirmed || !analysis.tied.includes(id)) return
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id)
      if (analysis.certain.includes(id)) return [...s, id]
      const chosenTied = s.filter((x) => analysis.tied.includes(x)).length
      if (analysis.tied.includes(id) && chosenTied >= analysis.openSlots) return s
      return [...s, id]
    })
  }

  return (
    <div className="space-y-4">
      {ranking.length === 0 ? (
        <p className="text-sm text-smoke">Aucun résultat enregistré.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-ink-600 text-left">
                <th className="label w-10 py-2" />
                <th className="label py-2">Rang</th>
                <th className="label py-2">Pilote</th>
                {columns.map((c) => <th key={c.id} className="label py-2 text-right">{c.label}</th>)}
                <th className="label py-2 text-right">Meilleure place</th>
                <th className="label py-2 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {[...ranking].sort((a, b) => a.tie_rank - b.tie_rank || a.pseudonym.localeCompare(b.pseudonym)).map((r) => {
                const sel = selected.includes(r.pilot_id)
                const tied = analysis.tied.includes(r.pilot_id)
                return (
                  <tr
                    key={r.pilot_id}
                    className={cx('border-b border-ink-700', sel && 'bg-blood-500/[0.07]', r.tie_rank === cutRank && !tied && 'border-b-blood-500/70')}
                  >
                    <td className="py-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-[#e1141e]"
                        checked={sel}
                        disabled={isConfirmed || !tied}
                        onChange={() => toggle(r.pilot_id)}
                        aria-label={`Sélectionner ${r.pseudonym}`}
                      />
                    </td>
                    <td className="py-2"><PositionChip position={r.tie_rank} size="sm" /></td>
                    <td className="py-2">
                      <span className={cx('font-semibold', sel ? 'text-bone' : 'text-ash')}>{r.pseudonym}</span>
                      {tied && <span className="ml-2 text-[0.68rem] uppercase tracking-wider text-amber-400">égalité</span>}
                    </td>
                    {columns.map((c) => <td key={c.id} className="py-2 text-right font-mono text-ash tabular">{r.points_by_event[c.id] ?? '—'}</td>)}
                    <td className="py-2 text-right font-mono text-smoke tabular">{r.best_position ?? '—'}</td>
                    <td className="py-2 text-right font-display text-xl font-extrabold italic text-bone tabular">{r.points}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {isConfirmed ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-emerald-400/30 bg-emerald-400/[0.05] px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-ash"><Icon name="check" className="text-emerald-400" /> Sélection validée : {confirmed.length} pilote(s).</span>
          {onRevert && (
            <Button size="sm" variant="ghost" onClick={async () => { setBusy(true); try { await onRevert() } finally { setBusy(false) } }} loading={busy}>
              Annuler la validation
            </Button>
          )}
        </div>
      ) : blockedReason ? (
        <Notice tone="info">{blockedReason}</Notice>
      ) : ranking.length > 0 ? (
        <>
          {analysis.tied.length > 0 && (
            <Notice tone="warning" title="Égalité à la limite de sélection">
              {analysis.tied.length} pilotes sont à égalité pour {analysis.openSlots} place(s). Cochez le(s) pilote(s) retenu(s) et justifiez le départage :
              aucune place n’est attribuée automatiquement.
              <textarea className="field mt-3 min-h-16" placeholder="Motif du départage (ex. meilleur temps sur la Navigation)…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
            </Notice>
          )}
          {extra}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={cx('text-xs', check.error ? 'text-amber-400' : 'text-smoke')}>{check.error ?? `${selected.length} / ${analysis.n} pilote(s) retenu(s), conforme au règlement.`}</p>
            <Button
              disabled={!!check.error}
              loading={busy}
              icon={<Icon name="check" size={15} />}
              onClick={async () => {
                setBusy(true)
                try {
                  await onConfirm(selected, note.trim())
                } finally {
                  setBusy(false)
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
