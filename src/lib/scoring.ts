// Calculs de points et de classement — identiques aux règles appliquées
// côté base de données (supabase/migrations/…_logic.sql). Utilisés pour
// l'aperçu en direct dans le back-office ; la base reste la source officielle.

export interface ScaleEntryLike {
  position: number
  points: number
}

export type OutcomeLike = 'finished' | 'dnf' | 'dsq' | 'dns'

/** Points du barème pour une position (0 si la position n'y figure pas) */
export function pointsForPosition(scale: ScaleEntryLike[], position: number | null | undefined): number {
  if (position == null) return 0
  return scale.find((e) => e.position === position)?.points ?? 0
}

export interface ResultInput {
  outcome: OutcomeLike
  position: number | null
  adjustment?: number | null
}

/** Points d'un résultat : barème si classé, 0 sinon, plus la correction éventuelle */
export function resultPoints(row: ResultInput, scale: ScaleEntryLike[], kind?: string): { base: number; total: number } {
  const base = row.outcome === 'finished' && kind !== 'challenge' ? pointsForPosition(scale, row.position) : 0
  return { base, total: base + (row.adjustment ?? 0) }
}

export interface ResultRowCheck extends ResultInput {
  pilot_id: string
  checkpoint_ok?: boolean | null
  adjustment_reason?: string | null
}

/** Vérifications de saisie (mêmes règles que save_event_results) */
export function validateResultRows(rows: ResultRowCheck[], opts: { kind?: string; limit?: number | null } = {}): string[] {
  const errors: string[] = []
  const ids = rows.map((r) => r.pilot_id)
  if (ids.some((id) => !id)) errors.push('Chaque ligne doit désigner un pilote.')
  if (new Set(ids).size !== ids.length) errors.push('Un même pilote apparaît plusieurs fois.')
  if (opts.limit != null && rows.length > opts.limit) errors.push(`Trop de pilotes : ${opts.limit} maximum pour cette épreuve.`)
  const finished = rows.filter((r) => r.outcome === 'finished')
  if (finished.some((r) => r.position == null || !Number.isInteger(r.position)))
    errors.push('Chaque pilote classé doit avoir une position.')
  const positions = finished.map((r) => r.position as number).sort((a, b) => a - b)
  if (positions.length && positions.some((p, i) => p !== i + 1))
    errors.push('Les positions doivent être uniques et consécutives à partir de 1.')
  if (opts.kind === 'navigation' && finished.some((r) => !r.checkpoint_ok))
    errors.push('Navigation : un pilote classé doit avoir validé le checkpoint (sinon, disqualifié).')
  if (rows.some((r) => (r.adjustment ?? 0) !== 0 && (r.adjustment_reason ?? '').trim().length < 3))
    errors.push('Toute pénalité ou bonification doit être justifiée.')
  return errors
}

// ---------------------------------------------------------------------
//  Classements avec égalités
// ---------------------------------------------------------------------

export interface RankableRow {
  pilot_id: string
  points: number
  best_position?: number | null
}

export type TiebreakPolicy = 'manual' | 'best_finish_then_manual'

/** Rang « olympique » : deux pilotes à égalité partagent le même rang */
export function rankWithTies<T extends RankableRow>(rows: T[], policy: TiebreakPolicy = 'manual'): (T & { tie_rank: number })[] {
  const key = (r: T) => (policy === 'best_finish_then_manual' ? [r.points, -(r.best_position ?? 999)] : [r.points])
  const sorted = [...rows].sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i]
    return 0
  })
  let rank = 0
  let prev: number[] | null = null
  return sorted.map((r, i) => {
    const k = key(r)
    if (!prev || k.some((v, j) => v !== prev![j])) rank = i + 1
    prev = k
    return { ...r, tie_rank: rank }
  })
}

export interface SelectionAnalysis {
  /** Nombre de pilotes à retenir */
  n: number
  /** Pilotes retenus sans ambiguïté */
  certain: string[]
  /** Pilotes à égalité à la limite (départage requis) */
  tied: string[]
  /** Nombre de places restant à attribuer parmi les pilotes à égalité */
  openSlots: number
  /** Sélection proposée si aucune égalité */
  suggested: string[] | null
}

export function analyzeSelection(ranking: { pilot_id: string; tie_rank: number }[], wanted: number): SelectionAnalysis {
  const n = Math.min(wanted, ranking.length)
  if (n === 0) return { n, certain: [], tied: [], openSlots: 0, suggested: [] }
  const sorted = [...ranking].sort((a, b) => a.tie_rank - b.tie_rank)
  const cutoff = sorted[n - 1].tie_rank
  const certain = sorted.filter((r) => r.tie_rank < cutoff).map((r) => r.pilot_id)
  const atCutoff = sorted.filter((r) => r.tie_rank === cutoff).map((r) => r.pilot_id)
  if (certain.length + atCutoff.length === n) {
    return { n, certain: [...certain, ...atCutoff], tied: [], openSlots: 0, suggested: [...certain, ...atCutoff] }
  }
  return { n, certain, tied: atCutoff, openSlots: n - certain.length, suggested: null }
}

/** Même règle que bl_check_selection : renvoie un message d'erreur ou null */
export function checkSelection(
  ranking: { pilot_id: string; tie_rank: number }[],
  selected: string[],
  wanted: number,
  note: string,
): { error: string | null; tiebreak: boolean } {
  const n = Math.min(wanted, ranking.length)
  if (n === 0) return { error: 'Aucun pilote classé : impossible de valider la sélection.', tiebreak: false }
  if (new Set(selected).size !== selected.length || selected.length !== n)
    return { error: `Sélectionnez exactement ${n} pilote(s).`, tiebreak: false }
  const byId = new Map(ranking.map((r) => [r.pilot_id, r.tie_rank]))
  if (selected.some((id) => !byId.has(id))) return { error: 'Un pilote sélectionné ne figure pas dans ce classement.', tiebreak: false }
  const selMax = Math.max(...selected.map((id) => byId.get(id)!))
  const unsel = ranking.filter((r) => !selected.includes(r.pilot_id)).map((r) => r.tie_rank)
  const unselMin = unsel.length ? Math.min(...unsel) : null
  if (unselMin != null && selMax > unselMin)
    return { error: 'Sélection non conforme au règlement : un pilote mieux classé n’est pas retenu.', tiebreak: false }
  if (unselMin != null && selMax === unselMin) {
    if (note.trim().length < 5)
      return { error: 'Égalité à la limite de sélection : un départage explicite est requis (indiquez le motif).', tiebreak: true }
    return { error: null, tiebreak: true }
  }
  return { error: null, tiebreak: false }
}

// ---------------------------------------------------------------------
//  Agrégats pour les classements par phase et la progression
// ---------------------------------------------------------------------

export interface RankingLike {
  event_id: string
  pilot_id: string
  pseudonym: string
  position: number | null
  points: number
  starts_at: string | null
}

export interface AggregateRow {
  pilot_id: string
  pseudonym: string
  races: number
  wins: number
  podiums: number
  points: number
  best_position: number | null
  podium_rate: number | null
  position: number
}

export function aggregateStandings(rows: RankingLike[]): AggregateRow[] {
  const map = new Map<string, Omit<AggregateRow, 'position' | 'podium_rate'>>()
  for (const r of rows) {
    const cur = map.get(r.pilot_id) ?? { pilot_id: r.pilot_id, pseudonym: r.pseudonym, races: 0, wins: 0, podiums: 0, points: 0, best_position: null }
    cur.races += 1
    cur.points += r.points
    if (r.position === 1) cur.wins += 1
    if (r.position != null && r.position <= 3) cur.podiums += 1
    if (r.position != null && (cur.best_position == null || r.position < cur.best_position)) cur.best_position = r.position
    map.set(r.pilot_id, cur)
  }
  const ranked = rankWithTies([...map.values()], 'manual')
  return ranked.map(({ tie_rank, ...r }) => ({
    ...r,
    podium_rate: r.races ? Math.round((1000 * r.podiums) / r.races) / 10 : null,
    position: tie_rank,
  }))
}

export interface ProgressPoint {
  event_id: string
  label: string
  date: string | null
  points: number
  cumulative: number
  position: number | null
}

/** Progression cumulée d'un pilote, dans l'ordre chronologique des épreuves */
export function cumulativeProgression(rows: (RankingLike & { event_name: string })[]): ProgressPoint[] {
  const sorted = [...rows].sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? ''))
  let total = 0
  return sorted.map((r) => {
    total += r.points
    return { event_id: r.event_id, label: r.event_name, date: r.starts_at, points: r.points, cumulative: total, position: r.position }
  })
}

/** Évolution du rang au classement général après chaque épreuve de la saison */
export function standingsTimeline(rows: RankingLike[]): { event_id: string; date: string | null; positions: Map<string, number>; totals: Map<string, number> }[] {
  const events = [...new Map(rows.map((r) => [r.event_id, r.starts_at])).entries()].sort((a, b) =>
    (a[1] ?? '').localeCompare(b[1] ?? ''),
  )
  const totals = new Map<string, number>()
  const out: { event_id: string; date: string | null; positions: Map<string, number>; totals: Map<string, number> }[] = []
  for (const [eventId, date] of events) {
    for (const r of rows) if (r.event_id === eventId) totals.set(r.pilot_id, (totals.get(r.pilot_id) ?? 0) + r.points)
    const ranked = rankWithTies([...totals.entries()].map(([pilot_id, points]) => ({ pilot_id, points })))
    out.push({ event_id: eventId, date, positions: new Map(ranked.map((r) => [r.pilot_id, r.tie_rank])), totals: new Map(totals) })
  }
  return out
}
