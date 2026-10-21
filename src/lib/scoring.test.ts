// Tests unitaires des calculs (node --test, sans dépendance)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  aggregateStandings,
  analyzeSelection,
  checkSelection,
  cumulativeProgression,
  pointsForPosition,
  rankWithTies,
  resultPoints,
  standingsTimeline,
  validateResultRows,
} from './scoring.ts'

const SCALE = [10, 8, 6, 5, 4, 3, 2, 1, 0, 0].map((points, i) => ({ position: i + 1, points }))

test('barème officiel', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => pointsForPosition(SCALE, p)), [10, 8, 6, 5, 4, 3, 2, 1, 0, 0])
  assert.equal(pointsForPosition(SCALE, 11), 0)
  assert.equal(pointsForPosition(SCALE, null), 0)
})

test('points d’un résultat : abandon = 0, correction ajoutée', () => {
  assert.deepEqual(resultPoints({ outcome: 'finished', position: 1 }, SCALE), { base: 10, total: 10 })
  assert.deepEqual(resultPoints({ outcome: 'dnf', position: null }, SCALE), { base: 0, total: 0 })
  assert.deepEqual(resultPoints({ outcome: 'finished', position: 2, adjustment: -2 }, SCALE), { base: 8, total: 6 })
  assert.deepEqual(resultPoints({ outcome: 'finished', position: 1 }, SCALE, 'challenge'), { base: 0, total: 0 })
})

test('validation de saisie', () => {
  assert.deepEqual(validateResultRows([{ pilot_id: 'a', outcome: 'finished', position: 1 }, { pilot_id: 'b', outcome: 'dnf', position: null }]), [])
  assert.match(validateResultRows([{ pilot_id: 'a', outcome: 'finished', position: 1 }, { pilot_id: 'b', outcome: 'finished', position: 3 }]).join(), /consécutives/)
  assert.match(validateResultRows([{ pilot_id: 'a', outcome: 'finished', position: 1 }, { pilot_id: 'a', outcome: 'finished', position: 2 }]).join(), /plusieurs fois/)
  assert.match(validateResultRows([{ pilot_id: 'a', outcome: 'finished', position: 1, checkpoint_ok: false }], { kind: 'navigation' }).join(), /checkpoint/)
  assert.match(validateResultRows([{ pilot_id: 'a', outcome: 'finished', position: 1, adjustment: -2, adjustment_reason: '' }]).join(), /justifiée/)
  assert.match(validateResultRows(Array.from({ length: 11 }, (_, i) => ({ pilot_id: String(i), outcome: 'dns' as const, position: null })), { limit: 10 }).join(), /10 maximum/)
})

test('rang avec égalités', () => {
  const r = rankWithTies([
    { pilot_id: 'a', points: 18 },
    { pilot_id: 'b', points: 14 },
    { pilot_id: 'c', points: 14 },
    { pilot_id: 'd', points: 9 },
  ])
  assert.deepEqual(r.map((x) => [x.pilot_id, x.tie_rank]), [['a', 1], ['b', 2], ['c', 2], ['d', 4]])
})

test('départage par meilleure place', () => {
  const r = rankWithTies(
    [
      { pilot_id: 'a', points: 14, best_position: 2 },
      { pilot_id: 'b', points: 14, best_position: 1 },
    ],
    'best_finish_then_manual',
  )
  assert.deepEqual(r.map((x) => [x.pilot_id, x.tie_rank]), [['b', 1], ['a', 2]])
})

test('sélection : sans égalité, proposition automatique', () => {
  const ranking = [1, 2, 3, 4, 5].map((t, i) => ({ pilot_id: 'p' + i, tie_rank: t }))
  const a = analyzeSelection(ranking, 3)
  assert.deepEqual(a.suggested, ['p0', 'p1', 'p2'])
  assert.equal(checkSelection(ranking, ['p0', 'p1', 'p2'], 3, '').error, null)
  assert.match(checkSelection(ranking, ['p0', 'p1', 'p3'], 3, '').error ?? '', /non conforme/)
  assert.match(checkSelection(ranking, ['p0', 'p1'], 3, '').error ?? '', /exactement 3/)
})

test('sélection : égalité à la limite → départage obligatoire', () => {
  const ranking = [
    { pilot_id: 'a', tie_rank: 1 },
    { pilot_id: 'b', tie_rank: 2 },
    { pilot_id: 'c', tie_rank: 3 },
    { pilot_id: 'd', tie_rank: 3 },
    { pilot_id: 'e', tie_rank: 5 },
  ]
  const a = analyzeSelection(ranking, 3)
  assert.equal(a.suggested, null)
  assert.deepEqual(a.certain, ['a', 'b'])
  assert.deepEqual(a.tied, ['c', 'd'])
  assert.equal(a.openSlots, 1)
  assert.match(checkSelection(ranking, ['a', 'b', 'd'], 3, '').error ?? '', /départage/)
  assert.deepEqual(checkSelection(ranking, ['a', 'b', 'd'], 3, 'Meilleur temps au tour'), { error: null, tiebreak: true })
  assert.match(checkSelection(ranking, ['a', 'b', 'e'], 3, 'motif valable').error ?? '', /non conforme/)
})

test('sélection : moins de pilotes que de places', () => {
  const ranking = [{ pilot_id: 'a', tie_rank: 1 }, { pilot_id: 'b', tie_rank: 2 }]
  assert.equal(analyzeSelection(ranking, 3).n, 2)
  assert.equal(checkSelection(ranking, ['a', 'b'], 3, '').error, null)
})

test('agrégats et progression', () => {
  const rows = [
    { event_id: 'e1', pilot_id: 'a', pseudonym: 'A', position: 1, points: 10, starts_at: '2026-09-05T20:00:00Z', event_name: 'Q1' },
    { event_id: 'e1', pilot_id: 'b', pseudonym: 'B', position: 2, points: 8, starts_at: '2026-09-05T20:00:00Z', event_name: 'Q1' },
    { event_id: 'e2', pilot_id: 'b', pseudonym: 'B', position: 1, points: 10, starts_at: '2026-09-12T20:00:00Z', event_name: 'Q2' },
    { event_id: 'e2', pilot_id: 'a', pseudonym: 'A', position: null, points: 0, starts_at: '2026-09-12T20:00:00Z', event_name: 'Q2' },
  ]
  const agg = aggregateStandings(rows)
  assert.deepEqual(agg.map((r) => [r.pseudonym, r.points, r.position, r.wins, r.podiums, r.podium_rate]), [
    ['B', 18, 1, 1, 2, 100],
    ['A', 10, 2, 1, 1, 50],
  ])
  const prog = cumulativeProgression(rows.filter((r) => r.pilot_id === 'b'))
  assert.deepEqual(prog.map((p) => p.cumulative), [8, 18])
  const tl = standingsTimeline(rows)
  assert.equal(tl[0].positions.get('a'), 1)
  assert.equal(tl[1].positions.get('b'), 1)
})
