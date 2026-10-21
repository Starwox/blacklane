import { useMemo, useState } from 'react'
import { Link } from '../../lib/router'
import { useData } from '../../hooks/useData'
import { addParticipant, listParticipants, listPilots, listStageEntries, removeParticipant, setParticipantStatus } from '../../lib/admin-api'
import { PARTICIPANT_STATUS_LABEL } from '../../lib/labels'
import type { BLEvent, ParticipantStatus } from '../../lib/types'
import { useSite } from '../../components/layout/SiteContext'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/Toast'
import { RankBadge } from '../../components/race/Badges'

export default function EventParticipants({ event, readOnly }: { event: BLEvent; readOnly?: boolean }) {
  const toast = useToast()
  const { settings } = useSite()
  const participants = useData(() => listParticipants(event.id), [event.id])
  const pilots = useData(() => listPilots(), [])
  const stages = useData(async () => (event.season_id ? listStageEntries(event.season_id) : []), [event.season_id])
  const [pick, setPick] = useState('')

  const byId = useMemo(() => new Map((pilots.data ?? []).map((p) => [p.id, p])), [pilots.data])
  const active = (participants.data ?? []).filter((p) => p.status !== 'withdrawn')
  const limit = event.kind === 'qualification' ? Math.min(event.capacity ?? 99, settings?.max_pilots_per_session ?? 10) : event.capacity

  const eligible = useMemo(() => {
    const taken = new Set((participants.data ?? []).map((p) => p.pilot_id))
    const st = stages.data ?? []
    return (pilots.data ?? [])
      .filter((p) => p.status === 'active' && !taken.has(p.id))
      .filter((p) => {
        if (event.kind === 'qualification') return !st.some((s) => s.pilot_id === p.id && s.stage === 'runner')
        if (event.kind === 'urban_run' || event.kind === 'navigation')
          return st.some((s) => s.pilot_id === p.id && s.stage === 'runner' && s.group_label === event.group_label)
        if (event.kind === 'finale') return st.some((s) => s.pilot_id === p.id && s.stage === 'challenger')
        return true
      })
  }, [pilots.data, participants.data, stages.data, event])

  const act = async (fn: () => Promise<void>, msg: string) => {
    try {
      await fn()
      toast.success(msg)
      await participants.reload()
    } catch (e) {
      toast.error(e)
    }
  }

  if (participants.error) return <ErrorState error={participants.error} onRetry={participants.reload} />
  if (participants.loading || pilots.loading) return <LoadingBlock rows={6} />

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="panel-flat p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-2xl text-bone">Participants</h2>
          <span className="font-mono text-sm text-ash">{active.length}{limit ? ` / ${limit}` : ''}</span>
        </div>
        {!(participants.data ?? []).length ? (
          <EmptyState icon="users" title="Aucun participant">Ajoutez les pilotes convoqués. Les pilotes classés lors de la saisie des résultats sont ajoutés automatiquement.</EmptyState>
        ) : (
          <ul className="divide-y divide-ink-700">
            {(participants.data ?? []).map((pa) => {
              const p = byId.get(pa.pilot_id)
              return (
                <li key={pa.pilot_id} className="flex flex-wrap items-center gap-3 py-3">
                  <Link to={`/admin/pilotes/${pa.pilot_id}`} className="min-w-32 flex-1 font-semibold text-bone hover:text-blood-300">{p?.pseudonym ?? 'Pilote'}</Link>
                  {p && <RankBadge rank={p.rank} />}
                  <select
                    className="field w-auto py-1.5 text-sm"
                    value={pa.status}
                    disabled={readOnly}
                    onChange={(e) => act(() => setParticipantStatus(event.id, pa.pilot_id, e.target.value as ParticipantStatus), 'Statut mis à jour.')}
                    aria-label={`Statut de ${p?.pseudonym}`}
                  >
                    {(['registered', 'confirmed', 'withdrawn'] as ParticipantStatus[]).map((s) => <option key={s} value={s}>{PARTICIPANT_STATUS_LABEL[s]}</option>)}
                  </select>
                  {!readOnly && (
                    <button className="p-1 text-smoke hover:text-blood-400" aria-label="Retirer" onClick={() => act(() => removeParticipant(event.id, pa.pilot_id), 'Participant retiré.')}>
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {!readOnly && (
        <aside className="panel-flat space-y-4 p-5">
          <h2 className="display text-2xl text-bone">Ajouter un pilote</h2>
          {event.kind === 'qualification' && <Notice tone="info">Les pilotes déjà qualifiés cette saison ne peuvent pas courir une autre session.</Notice>}
          {(event.kind === 'urban_run' || event.kind === 'navigation') && <Notice tone="info">Seuls les pilotes qualifiés du groupe {event.group_label} sont proposés (inscription automatique lors de la constitution des groupes).</Notice>}
          {event.kind === 'finale' && <Notice tone="info">Seuls les finalistes validés sont proposés.</Notice>}
          <select className="field" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Pilote à ajouter">
            <option value="">Choisir un pilote…</option>
            {eligible.map((p) => <option key={p.id} value={p.id}>{p.pseudonym}{p.tag ? ` (${p.tag})` : ''}</option>)}
          </select>
          <Button
            className="w-full"
            disabled={!pick || (limit != null && active.length >= limit)}
            icon={<Icon name="plus" size={15} />}
            onClick={() => act(async () => { await addParticipant(event.id, pick); setPick('') }, 'Pilote inscrit.')}
          >
            Inscrire
          </Button>
          {limit != null && active.length >= limit && <p className="text-xs text-amber-400">Capacité atteinte.</p>}
        </aside>
      )}
    </div>
  )
}
