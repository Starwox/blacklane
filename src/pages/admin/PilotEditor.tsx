import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from '../../lib/router'
import { useData } from '../../hooks/useData'
import { useAuth } from '../../lib/auth'
import {
  addAdjustment,
  deleteAdjustment,
  deletePilot,
  getPilotNotes,
  getPilotResults,
  getRankHistory,
  listAdjustments,
  listEvents,
  listSeasons,
  savePilotNotes,
  setPilotRank,
  updatePilot,
} from '../../lib/admin-api'
import { getPilot, getPilotStandings } from '../../lib/api'
import { formatDateTimeShort, formatShortDate, formatSigned } from '../../lib/format'
import { KIND_LABEL, OUTCOME_LABEL, PILOT_STATUS_LABEL, RANK_LABEL, RANKS } from '../../lib/labels'
import type { PilotRank, PilotStatus } from '../../lib/types'
import { AdminPageHeader } from './AdminLayout'
import { PilotForm } from './Pilots'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { SelectInput, TextArea, TextInput } from '../../components/ui/Form'
import { DemoBadge, EmptyState, ErrorState, LoadingBlock, Notice, StatTile } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/Toast'
import { PositionChip, RankBadge } from '../../components/race/Badges'

export default function PilotEditor() {
  const { id } = useParams<{ id: string }>()
  const { can } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const pilot = useData(() => getPilot(id), [id])
  const results = useData(() => getPilotResults(id), [id])
  const standings = useData(() => getPilotStandings(id), [id])
  const adjustments = useData(() => listAdjustments({ pilotId: id }), [id])
  const history = useData(() => getRankHistory(id), [id])
  const notes = useData(() => getPilotNotes(id), [id])
  const seasons = useData(() => listSeasons(), [])
  const events = useData(() => listEvents(), [])

  const [notesDraft, setNotesDraft] = useState<string | null>(null)
  const [rankOpen, setRankOpen] = useState(false)
  const [newRank, setNewRank] = useState<PilotRank>('prospect')
  const [rankReason, setRankReason] = useState('')
  const [adjOpen, setAdjOpen] = useState(false)
  const [adj, setAdj] = useState({ season_id: '', event_id: '', delta: '', reason: '' })
  const [confirm, setConfirm] = useState<null | { title: string; body: string; label: string; danger?: boolean; word?: string; run: () => Promise<void> }>(null)

  useEffect(() => {
    if (pilot.data) document.title = `${pilot.data.pseudonym} — Back-office`
  }, [pilot.data])

  const seasonName = useMemo(() => new Map((seasons.data ?? []).map((s) => [s.id, s.name])), [seasons.data])
  const sortedResults = useMemo(
    () => [...(results.data ?? [])].sort((a, b) => (b.events?.starts_at ?? '').localeCompare(a.events?.starts_at ?? '')),
    [results.data],
  )

  if (pilot.error) return <ErrorState error={pilot.error} onRetry={pilot.reload} />
  if (pilot.loading) return <LoadingBlock rows={6} />
  if (!pilot.data) return <EmptyState icon="helmet" title="Pilote introuvable" action={<Link to="/admin/pilotes" className="text-blood-400 underline">Retour aux pilotes</Link>} />
  const p = pilot.data

  const setStatus = async (status: PilotStatus, msg: string) => {
    try {
      await updatePilot(p.id, { status })
      toast.success(msg)
      await pilot.reload()
    } catch (e) {
      toast.error(e)
    }
  }

  const activeSeason = seasons.data?.find((s) => s.status === 'active')
  const seasonEvents = (events.data ?? []).filter((e) => e.season_id === (adj.season_id || activeSeason?.id))

  return (
    <>
      <Link to="/admin/pilotes" className="mb-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-smoke hover:text-bone">
        <Icon name="arrowLeft" size={14} /> Pilotes
      </Link>
      <AdminPageHeader
        title={p.pseudonym}
        kicker={p.tag ?? 'Pilote'}
        actions={
          <>
            <Link to={`/pilotes/${p.id}`} className="inline-flex items-center gap-1.5 border border-ink-600 px-3 py-2 text-xs uppercase tracking-wider text-smoke hover:text-bone">
              <Icon name="eye" size={14} /> Fiche publique
            </Link>
            {p.status === 'archived' ? (
              <Button variant="outline" size="sm" icon={<Icon name="refresh" size={14} />} onClick={() => setStatus('active', 'Pilote restauré.')}>Restaurer</Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                icon={<Icon name="archive" size={14} />}
                onClick={() =>
                  setConfirm({
                    title: 'Archiver ce pilote ?',
                    body: 'Il disparaîtra des listes courantes mais son historique et ses classements passés seront conservés. Vous pourrez le restaurer à tout moment.',
                    label: 'Archiver',
                    run: () => setStatus('archived', 'Pilote archivé.'),
                  })
                }
              >
                Archiver
              </Button>
            )}
            {can('owner') && (
              <Button
                variant="danger"
                size="sm"
                icon={<Icon name="trash" size={14} />}
                disabled={(results.data?.length ?? 0) > 0}
                title={(results.data?.length ?? 0) > 0 ? 'Impossible : le pilote a des résultats. Archivez-le.' : undefined}
                onClick={() =>
                  setConfirm({
                    title: 'Supprimer définitivement ?',
                    body: `Le pilote « ${p.pseudonym} » sera supprimé. Cette action est irréversible.`,
                    label: 'Supprimer',
                    danger: true,
                    word: 'SUPPRIMER',
                    run: async () => {
                      try {
                        await deletePilot(p.id)
                        toast.success('Pilote supprimé.')
                        navigate('/admin/pilotes')
                      } catch (e) {
                        toast.error(e)
                      }
                    },
                  })
                }
              >
                Supprimer
              </Button>
            )}
          </>
        }
      >
        <span className="inline-flex flex-wrap items-center gap-2">
          <RankBadge rank={p.rank} /> <span className="text-smoke">{PILOT_STATUS_LABEL[p.status]}</span> {p.is_demo && <DemoBadge />}
        </span>
      </AdminPageHeader>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(standings.data ?? []).filter((s) => s.season_status === 'active').map((s) => (
              <StatTile key="pos" label={`Position — ${s.season_name}`} value={s.position} accent />
            ))}
            {(standings.data ?? []).filter((s) => s.season_status === 'active').map((s) => (
              <StatTile key="pts" label="Points" value={s.points} hint={s.adjustments ? `dont ${formatSigned(s.adjustments)} corrigés` : undefined} />
            ))}
            <StatTile label="Participations" value={results.data?.length ?? 0} hint="toutes saisons" />
            <StatTile label="Victoires" value={(results.data ?? []).filter((r) => r.position === 1).length} />
          </div>

          <section className="panel-flat p-5">
            <h2 className="display mb-4 text-2xl text-bone">Profil</h2>
            <PilotForm
              key={p.id + p.pseudonym}
              initial={p}
              submitLabel="Enregistrer"
              onSubmit={async (v) => {
                try {
                  await updatePilot(p.id, v)
                  toast.success('Profil enregistré.')
                  await pilot.reload()
                } catch (e) {
                  toast.error(e)
                }
              }}
            />
          </section>

          <section className="panel-flat p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="display text-2xl text-bone">Résultats</h2>
              <span className="text-xs text-smoke">Corrigez un résultat depuis la fiche de la course concernée.</span>
            </div>
            {results.error ? (
              <ErrorState error={results.error} onRetry={results.reload} />
            ) : !sortedResults.length ? (
              <p className="text-sm text-smoke">Aucun résultat enregistré.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-ink-600 text-left">
                      {['Date', 'Épreuve', 'Saison', 'Résultat', 'Points', ''].map((h) => <th key={h} className="label py-2 pr-3">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedResults.map((r) => (
                      <tr key={r.event_id} className="border-b border-ink-700">
                        <td className="py-2 pr-3 font-mono text-xs text-smoke">{formatShortDate(r.events?.starts_at)}</td>
                        <td className="py-2 pr-3 text-bone">{r.events?.name}<span className="ml-2 text-xs text-smoke">{r.events && KIND_LABEL[r.events.kind]}</span></td>
                        <td className="py-2 pr-3 text-xs text-smoke">{r.events?.season_id ? seasonName.get(r.events.season_id) : '—'}</td>
                        <td className="py-2 pr-3">{r.outcome === 'finished' ? <PositionChip position={r.position} size="sm" /> : <span className="text-xs text-smoke">{OUTCOME_LABEL[r.outcome]}</span>}</td>
                        <td className="py-2 pr-3 font-mono tabular text-bone">
                          {r.points}
                          {r.adjustment !== 0 && <span className="ml-1 text-xs text-amber-400" title={r.adjustment_reason ?? ''}>({formatSigned(r.adjustment)})</span>}
                        </td>
                        <td className="py-2 text-right">
                          <Link to={`/admin/courses/${r.event_id}?onglet=resultats`} className="text-xs text-smoke hover:text-bone">Corriger</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel-flat p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="display text-2xl text-bone">Rang & historique</h2>
              {can('admin') && (
                <Button size="sm" variant="outline" onClick={() => { setNewRank(p.rank); setRankReason(''); setRankOpen(true) }}>Modifier le rang</Button>
              )}
            </div>
            {history.error ? (
              <ErrorState error={history.error} onRetry={history.reload} />
            ) : (
              <ol className="space-y-3 border-l border-ink-600 pl-4">
                {(history.data ?? []).map((h) => (
                  <li key={h.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border border-blood-500 bg-ink-900" />
                    <p className="text-bone">
                      {h.from_rank ? `${RANK_LABEL[h.from_rank]} → ` : ''}<strong>{RANK_LABEL[h.to_rank]}</strong>
                    </p>
                    <p className="text-xs text-smoke">{formatDateTimeShort(h.changed_at)} · {h.reason ?? h.source}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="panel-flat p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="display text-2xl text-bone">Corrections de points</h2>
              {can('admin') && (
                <Button size="sm" variant="outline" icon={<Icon name="plus" size={13} />} onClick={() => { setAdj({ season_id: activeSeason?.id ?? '', event_id: '', delta: '', reason: '' }); setAdjOpen(true) }}>
                  Ajouter
                </Button>
              )}
            </div>
            {!(adjustments.data ?? []).length ? (
              <p className="text-sm text-smoke">Aucune correction manuelle.</p>
            ) : (
              <ul className="space-y-2">
                {(adjustments.data ?? []).map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 border border-ink-600 p-3 text-sm">
                    <div>
                      <p className={a.delta > 0 ? 'font-mono text-emerald-400' : 'font-mono text-blood-300'}>{formatSigned(a.delta)} pts</p>
                      <p className="text-ash">{a.reason}</p>
                      <p className="text-xs text-smoke">{seasonName.get(a.season_id)} · {formatShortDate(a.created_at)}</p>
                    </div>
                    {can('admin') && (
                      <button
                        className="text-smoke hover:text-blood-400"
                        aria-label="Supprimer la correction"
                        onClick={() =>
                          setConfirm({
                            title: 'Annuler cette correction ?',
                            body: `La correction de ${formatSigned(a.delta)} points sera supprimée et le classement recalculé.`,
                            label: 'Supprimer',
                            danger: true,
                            run: async () => {
                              try {
                                await deleteAdjustment(a.id)
                                toast.success('Correction supprimée.')
                                await Promise.all([adjustments.reload(), standings.reload()])
                              } catch (e) {
                                toast.error(e)
                              }
                            },
                          })
                        }
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel-flat p-5">
            <h2 className="display mb-1 text-2xl text-bone">Notes internes</h2>
            <p className="mb-3 text-xs text-smoke">Visibles uniquement par les organisateurs. N’y consignez aucune donnée personnelle réelle.</p>
            <textarea className="field min-h-28" value={notesDraft ?? notes.data ?? ''} onChange={(e) => setNotesDraft(e.target.value)} maxLength={4000} />
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                disabled={notesDraft == null}
                onClick={async () => {
                  try {
                    await savePilotNotes(p.id, notesDraft ?? '')
                    toast.success('Notes enregistrées.')
                    await notes.reload()
                    setNotesDraft(null)
                  } catch (e) {
                    toast.error(e)
                  }
                }}
              >
                Enregistrer les notes
              </Button>
            </div>
          </section>

          <section className="panel-flat space-y-2 p-5">
            <h2 className="display mb-2 text-2xl text-bone">Statut</h2>
            <div className="flex flex-wrap gap-2">
              {(['active', 'inactive', 'banned'] as PilotStatus[]).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={p.status === s ? 'primary' : 'outline'}
                  disabled={p.status === s}
                  onClick={() =>
                    s === 'banned'
                      ? setConfirm({
                          title: 'Exclure ce pilote ?',
                          body: 'Le pilote sera masqué du site public et ne pourra plus participer. Son historique reste conservé.',
                          label: 'Exclure',
                          danger: true,
                          run: () => setStatus('banned', 'Pilote exclu.'),
                        })
                      : setStatus(s, `Statut : ${PILOT_STATUS_LABEL[s]}.`)
                  }
                >
                  {PILOT_STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={rankOpen}
        onClose={() => setRankOpen(false)}
        title="Modifier le rang"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRankOpen(false)}>Annuler</Button>
            <Button
              disabled={rankReason.trim().length < 3 || newRank === p.rank}
              onClick={async () => {
                try {
                  await setPilotRank(p.id, newRank, rankReason.trim())
                  toast.success('Rang modifié et historisé.')
                  setRankOpen(false)
                  await Promise.all([pilot.reload(), history.reload()])
                } catch (e) {
                  toast.error(e)
                }
              }}
            >
              Appliquer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Notice tone="info">Les rangs sont normalement attribués automatiquement lors de la validation des phases. Une modification manuelle est historisée avec sa justification.</Notice>
          <SelectInput label="Nouveau rang" value={newRank} onChange={(e) => setNewRank(e.target.value as PilotRank)} options={RANKS.map((r) => ({ value: r, label: RANK_LABEL[r] }))} />
          <TextArea label="Justification" required value={rankReason} onChange={(e) => setRankReason(e.target.value)} rows={2} maxLength={300} />
        </div>
      </Modal>

      <Modal
        open={adjOpen}
        onClose={() => setAdjOpen(false)}
        title="Correction de points"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdjOpen(false)}>Annuler</Button>
            <Button
              disabled={!adj.season_id || !Number(adj.delta) || adj.reason.trim().length < 5}
              onClick={async () => {
                try {
                  await addAdjustment({
                    season_id: adj.season_id,
                    pilot_id: p.id,
                    event_id: adj.event_id || null,
                    delta: Math.trunc(Number(adj.delta)),
                    reason: adj.reason.trim(),
                  })
                  toast.success('Correction appliquée au classement.')
                  setAdjOpen(false)
                  await Promise.all([adjustments.reload(), standings.reload()])
                } catch (e) {
                  toast.error(e)
                }
              }}
            >
              Appliquer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Notice tone="info">
            Une correction s’ajoute au total de la saison sans modifier les résultats officiels. Pour pénaliser un pilote sur une course précise,
            préférez une pénalité dans les résultats de la course.
          </Notice>
          <SelectInput
            label="Saison"
            required
            value={adj.season_id}
            onChange={(e) => setAdj({ ...adj, season_id: e.target.value, event_id: '' })}
            placeholder="Choisir…"
            options={(seasons.data ?? []).filter((s) => s.status !== 'closed').map((s) => ({ value: s.id, label: s.name }))}
          />
          <SelectInput
            label="Épreuve concernée (facultatif)"
            value={adj.event_id}
            onChange={(e) => setAdj({ ...adj, event_id: e.target.value })}
            placeholder="Aucune"
            options={seasonEvents.map((e) => ({ value: e.id, label: e.name }))}
          />
          <TextInput label="Points (+ ou −)" type="number" required value={adj.delta} onChange={(e) => setAdj({ ...adj, delta: e.target.value })} min={-500} max={500} step={1} />
          <TextArea label="Justification" required value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} rows={2} maxLength={300} hint="5 caractères minimum. Journalisé." />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        confirmLabel={confirm?.label}
        danger={confirm?.danger}
        confirmWord={confirm?.word}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await confirm?.run()
        }}
      >
        <p>{confirm?.body}</p>
      </ConfirmDialog>
    </>
  )
}
