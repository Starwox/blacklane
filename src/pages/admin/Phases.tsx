import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from '../../lib/router'
import { useData } from '../../hooks/useData'
import {
  assignGroups,
  confirmElite,
  confirmFinalists,
  confirmQualifiers,
  listEvents,
  listSeasons,
  listStageEntries,
  resetGroups,
  revertElite,
  revertFinalists,
  revertQualifiers,
} from '../../lib/admin-api'
import { getFinaleRanking, getGroupRanking, getSessionRanking } from '../../lib/api'
import { EVENT_STATUS_LABEL, KIND_LABEL } from '../../lib/labels'
import { formatShortDate } from '../../lib/format'
import type { BLEvent, GroupLabel, Season } from '../../lib/types'
import { useSite } from '../../components/layout/SiteContext'
import { AdminPageHeader } from './AdminLayout'
import { SelectionPanel } from './SelectionPanel'
import { Button, LinkButton } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Form'
import { Icon } from '../../components/ui/Icon'
import { ConfirmDialog } from '../../components/ui/Modal'
import { EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/Toast'
import { cx } from '../../components/ui/cx'

type Stages = Awaited<ReturnType<typeof listStageEntries>>

function Step({ n, title, status, children }: { n: number; title: string; status: 'todo' | 'current' | 'done'; children: ReactNode }) {
  return (
    <section className="relative border-l border-ink-600 pb-12 pl-8 last:pb-0">
      <span
        className={cx(
          'absolute -left-[17px] top-0 grid size-8 place-items-center border font-display text-sm font-bold',
          status === 'done' ? 'border-emerald-400/60 bg-ink-950 text-emerald-400' : status === 'current' ? 'border-blood-500 bg-blood-500 text-white' : 'border-ink-500 bg-ink-950 text-smoke',
        )}
      >
        {status === 'done' ? <Icon name="check" size={16} /> : n}
      </span>
      <h2 className="display mb-5 pt-0.5 text-3xl text-bone">{title}</h2>
      {children}
    </section>
  )
}

function SessionCard({ event, stages, wanted, onDone }: { event: BLEvent; stages: Stages; wanted: number; onDone: () => void }) {
  const toast = useToast()
  const ranking = useData(async () => (event.status === 'completed' ? getSessionRanking(event.id) : []), [event.id, event.status])
  const confirmed = stages.filter((s) => s.stage === 'runner' && s.source_event_id === event.id).map((s) => s.pilot_id)
  const groupsFormed = stages.some((s) => s.stage === 'runner' && s.group_label)
  return (
    <div className="panel-flat p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to={`/admin/courses/${event.id}`} className="display text-2xl text-bone hover:text-blood-300">{event.name}</Link>
          <p className="text-xs text-smoke">{formatShortDate(event.starts_at)} · {EVENT_STATUS_LABEL[event.status]}</p>
        </div>
        {event.status !== 'completed' && (
          <LinkButton to={`/admin/courses/${event.id}?onglet=resultats`} size="sm" variant="outline">Saisir les résultats</LinkButton>
        )}
      </div>
      {event.status !== 'completed' ? (
        <p className="text-sm text-smoke">La sélection sera possible une fois la session terminée.</p>
      ) : ranking.error ? (
        <ErrorState error={ranking.error} onRetry={ranking.reload} />
      ) : ranking.loading ? (
        <LoadingBlock rows={3} />
      ) : (
        <SelectionPanel
          ranking={ranking.data ?? []}
          wanted={wanted}
          confirmed={confirmed}
          confirmLabel="Valider les qualifiés"
          onConfirm={async (sel, note) => {
            try {
              await confirmQualifiers(event.id, sel, note)
              toast.success('Qualifiés validés : rang Runner attribué.')
              onDone()
            } catch (e) {
              toast.error(e)
            }
          }}
          onRevert={
            groupsFormed
              ? undefined
              : async () => {
                  try {
                    await revertQualifiers(event.id)
                    toast.success('Validation annulée.')
                    onDone()
                  } catch (e) {
                    toast.error(e)
                  }
                }
          }
        />
      )}
    </div>
  )
}

function GroupsEditor({ season, stages, events, onDone }: { season: Season; stages: Stages; events: BLEvent[]; onDone: () => void }) {
  const toast = useToast()
  const { settings } = useSite()
  const runners = stages.filter((s) => s.stage === 'runner')
  const labels = (['A', 'B', 'C', 'D'] as GroupLabel[]).slice(0, settings?.elite_group_count ?? 2)
  const size = settings?.elite_group_size ?? 6
  const formed = runners.some((r) => r.group_label)
  const [assign, setAssign] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const eliteHasResults = events.some((e) => (e.kind === 'urban_run' || e.kind === 'navigation') && e.status === 'completed')

  useEffect(() => {
    setAssign(Object.fromEntries(runners.map((r) => [r.pilot_id, r.group_label ?? ''])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages])

  const sessionOf = (id: string | null) => events.find((e) => e.id === id)?.session_number ?? 99
  const distribute = () => {
    // Répartition en serpentin, dans l'ordre des sessions de qualification
    const sorted = [...runners].sort((a, b) => sessionOf(a.source_event_id) - sessionOf(b.source_event_id) || a.decided_at.localeCompare(b.decided_at))
    const next: Record<string, string> = {}
    sorted.forEach((r, i) => {
      const round = Math.floor(i / labels.length)
      const idx = i % labels.length
      next[r.pilot_id] = labels[round % 2 === 0 ? idx : labels.length - 1 - idx]
    })
    setAssign(next)
  }

  const counts = labels.map((l) => Object.values(assign).filter((v) => v === l).length)
  const complete = runners.length > 0 && runners.every((r) => assign[r.pilot_id]) && counts.every((c) => c <= size)

  if (!runners.length) return <p className="text-sm text-smoke">Aucun pilote qualifié pour l’instant.</p>

  return (
    <div className="panel-flat p-5">
      {formed && <Notice tone="success" className="mb-4">Groupes constitués. Les pilotes ont été inscrits automatiquement aux épreuves Urban Run et Navigation de leur groupe.</Notice>}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {runners.map((r) => (
          <label key={r.pilot_id} className="flex items-center justify-between gap-3 border border-ink-600 px-3 py-2">
            <span className="text-sm text-bone">{r.pseudonym}<span className="ml-2 text-xs text-smoke">S{sessionOf(r.source_event_id)}</span></span>
            <select
              className="field w-24 py-1"
              value={assign[r.pilot_id] ?? ''}
              disabled={eliteHasResults}
              onChange={(e) => setAssign({ ...assign, [r.pilot_id]: e.target.value })}
              aria-label={`Groupe de ${r.pseudonym}`}
            >
              <option value="">—</option>
              {labels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-smoke">
          {labels.map((l, i) => (
            <span key={l} className={cx('mr-4', counts[i] > size && 'text-blood-300')}>Groupe {l} : {counts[i]}/{size}</span>
          ))}
        </p>
        {eliteHasResults ? (
          <p className="text-xs text-smoke">Des résultats Élite existent : les groupes sont figés.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={distribute} icon={<Icon name="refresh" size={14} />}>Répartition automatique</Button>
            {formed && <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>Réinitialiser</Button>}
            <Button
              size="sm"
              disabled={!complete}
              loading={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await assignGroups(season.id, runners.map((r) => ({ pilot_id: r.pilot_id, group_label: assign[r.pilot_id] })))
                  toast.success('Groupes enregistrés.')
                  onDone()
                } catch (e) {
                  toast.error(e)
                } finally {
                  setBusy(false)
                }
              }}
            >
              Enregistrer les groupes
            </Button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmReset}
        title="Réinitialiser les groupes ?"
        confirmLabel="Réinitialiser"
        danger
        onClose={() => setConfirmReset(false)}
        onConfirm={async () => {
          try {
            await resetGroups(season.id)
            toast.success('Groupes réinitialisés.')
            onDone()
          } catch (e) {
            toast.error(e)
          }
        }}
      >
        <p>Les affectations et les inscriptions aux épreuves Élite seront supprimées.</p>
      </ConfirmDialog>
    </div>
  )
}

function GroupCard({ season, group, stages, events, wanted, onDone }: { season: Season; group: GroupLabel; stages: Stages; events: BLEvent[]; wanted: number; onDone: () => void }) {
  const toast = useToast()
  const gEvents = events.filter((e) => e.group_label === group && (e.kind === 'urban_run' || e.kind === 'navigation'))
  const ranking = useData(() => getGroupRanking(season.id, group), [season.id, group, stages])
  const members = stages.filter((s) => s.stage === 'runner' && s.group_label === group).map((s) => s.pilot_id)
  const confirmed = stages.filter((s) => s.stage === 'challenger' && members.includes(s.pilot_id)).map((s) => s.pilot_id)
  const missing = (['urban_run', 'navigation'] as const).filter((k) => !gEvents.some((e) => e.kind === k && e.status === 'completed'))
  const finaleHasResults = events.some((e) => e.kind === 'finale' && e.status === 'completed')

  return (
    <div className="panel-flat p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="display text-3xl text-bone">Groupe {group}</p>
        <div className="flex flex-wrap gap-2">
          {gEvents.map((e) => (
            <Link key={e.id} to={`/admin/courses/${e.id}?onglet=resultats`} className={cx('border px-2 py-1 text-xs', e.status === 'completed' ? 'border-ink-500 text-ash' : 'border-amber-400/50 text-amber-400')}>
              {KIND_LABEL[e.kind]} · {EVENT_STATUS_LABEL[e.status]}
            </Link>
          ))}
          {!gEvents.length && <LinkButton to="/admin/courses/nouveau" size="sm" variant="outline">Créer les épreuves</LinkButton>}
        </div>
      </div>
      {ranking.error ? (
        <ErrorState error={ranking.error} onRetry={ranking.reload} />
      ) : ranking.loading ? (
        <LoadingBlock rows={4} />
      ) : (
        <SelectionPanel
          ranking={ranking.data ?? []}
          wanted={wanted}
          confirmed={confirmed}
          columns={gEvents.map((e) => ({ id: e.id, label: e.kind === 'urban_run' ? 'Urban Run' : 'Navigation' }))}
          blockedReason={missing.length ? `En attente : ${missing.map((k) => KIND_LABEL[k]).join(' et ')} du groupe ${group} doivent être terminées.` : null}
          confirmLabel={`Valider les finalistes du groupe ${group}`}
          onConfirm={async (sel, note) => {
            try {
              await confirmFinalists(season.id, group, sel, note)
              toast.success('Finalistes validés : rang Challenger attribué et inscription à la finale.')
              onDone()
            } catch (e) {
              toast.error(e)
            }
          }}
          onRevert={
            finaleHasResults
              ? undefined
              : async () => {
                  try {
                    await revertFinalists(season.id, group)
                    toast.success('Validation annulée.')
                    onDone()
                  } catch (e) {
                    toast.error(e)
                  }
                }
          }
        />
      )}
    </div>
  )
}

function FinaleCard({ season, stages, events, wanted, onDone }: { season: Season; stages: Stages; events: BLEvent[]; wanted: number; onDone: () => void }) {
  const toast = useToast()
  const [demote, setDemote] = useState(true)
  const finale = events.filter((e) => e.kind === 'finale')
  const ranking = useData(() => getFinaleRanking(season.id), [season.id, stages])
  const confirmed = stages.filter((s) => s.stage === 'elite' && s.source === 'competition').map((s) => s.pilot_id)
  const done = finale.some((e) => e.status === 'completed')
  return (
    <div className="panel-flat p-5">
      <div className="mb-4 flex flex-wrap gap-2">
        {finale.map((e) => (
          <Link key={e.id} to={`/admin/courses/${e.id}?onglet=resultats`} className={cx('border px-2 py-1 text-xs', e.status === 'completed' ? 'border-ink-500 text-ash' : 'border-amber-400/50 text-amber-400')}>
            {e.name} · {EVENT_STATUS_LABEL[e.status]}
          </Link>
        ))}
        {!finale.length && <LinkButton to="/admin/courses/nouveau" size="sm" variant="outline">Créer la finale</LinkButton>}
      </div>
      {ranking.error ? (
        <ErrorState error={ranking.error} onRetry={ranking.reload} />
      ) : ranking.loading ? (
        <LoadingBlock rows={4} />
      ) : (
        <SelectionPanel
          ranking={ranking.data ?? []}
          wanted={wanted}
          confirmed={confirmed}
          blockedReason={!done ? 'La finale doit être terminée pour couronner les pilotes Elite.' : null}
          confirmLabel="Couronner les pilotes Elite"
          extra={<Checkbox label="Rétrograder en Challenger les pilotes Elite des saisons précédentes" checked={demote} onChange={setDemote} />}
          onConfirm={async (sel, note) => {
            try {
              await confirmElite(season.id, sel, note, demote)
              toast.success('Pilotes Elite de la saison désignés.')
              onDone()
            } catch (e) {
              toast.error(e)
            }
          }}
          onRevert={async () => {
            try {
              await revertElite(season.id)
              toast.success('Validation annulée.')
              onDone()
            } catch (e) {
              toast.error(e)
            }
          }}
        />
      )}
    </div>
  )
}

export default function Phases() {
  const { settings } = useSite()
  const [params, setParams] = useSearchParams()
  const seasons = useData(() => listSeasons(), [])
  const seasonId = params.get('saison') ?? seasons.data?.find((s) => s.status === 'active')?.id ?? seasons.data?.[0]?.id ?? null
  const season = seasons.data?.find((s) => s.id === seasonId) ?? null
  const events = useData(async () => (seasonId ? (await listEvents()).filter((e) => e.season_id === seasonId) : []), [seasonId])
  const stages = useData(async () => (seasonId ? listStageEntries(seasonId) : []), [seasonId])

  useEffect(() => {
    document.title = 'Phases — Back-office'
  }, [])

  const reload = () => {
    void stages.reload()
    void events.reload()
  }
  const st = stages.data ?? []
  const ev = events.data ?? []
  const sessions = useMemo(() => ev.filter((e) => e.kind === 'qualification').sort((a, b) => (a.session_number ?? 0) - (b.session_number ?? 0)), [ev])
  const groups = (['A', 'B', 'C', 'D'] as GroupLabel[]).slice(0, settings?.elite_group_count ?? 2)
  const total = (settings?.sessions_count ?? 4) * (settings?.qualifiers_per_session ?? 3)
  const runners = st.filter((s) => s.stage === 'runner')
  const formed = runners.some((r) => r.group_label)
  const finalists = st.filter((s) => s.stage === 'challenger')
  const elites = st.filter((s) => s.stage === 'elite' && s.source === 'competition')

  const status = (cond: boolean, prev: boolean) => (cond ? 'done' : prev ? 'current' : 'todo') as 'done' | 'current' | 'todo'

  return (
    <>
      <AdminPageHeader
        title="Phases & sélection"
        actions={
          <select className="field" value={seasonId ?? ''} onChange={(e) => setParams({ saison: e.target.value })} aria-label="Saison">
            {(seasons.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        }
      >
        Validez chaque étape de la saison. Le classement de chaque session ou groupe est calculé à partir des résultats officiels ; les rangs Runner,
        Challenger et Elite sont attribués automatiquement et historisés.
      </AdminPageHeader>

      {seasons.error || events.error || stages.error ? (
        <ErrorState error={seasons.error || events.error || stages.error} onRetry={reload} />
      ) : seasons.loading || events.loading || stages.loading ? (
        <LoadingBlock rows={8} />
      ) : !season ? (
        <EmptyState icon="calendar" title="Aucune saison" action={<LinkButton to="/admin/saisons">Créer une saison</LinkButton>} />
      ) : (
        <div className="ml-4">
          {season.status === 'closed' && <Notice tone="warning" className="mb-8">Saison clôturée : les sélections sont figées.</Notice>}

          <Step n={1} title={`Qualifications — ${runners.length} / ${total} qualifiés`} status={status(runners.length >= total, true)}>
            {sessions.length === 0 ? (
              <EmptyState icon="flag" title="Aucune session" action={<LinkButton to="/admin/courses/nouveau">Créer une session</LinkButton>}>
                Créez les {settings?.sessions_count ?? 4} sessions de qualification de la saison.
              </EmptyState>
            ) : (
              <div className="grid gap-4 2xl:grid-cols-2">
                {sessions.map((e) => <SessionCard key={e.id} event={e} stages={st} wanted={settings?.qualifiers_per_session ?? 3} onDone={reload} />)}
              </div>
            )}
          </Step>

          <Step n={2} title="Constitution des groupes Élite" status={status(formed, runners.length > 0)}>
            <GroupsEditor season={season} stages={st} events={ev} onDone={reload} />
          </Step>

          <Step n={3} title={`Phase Élite — ${finalists.length} finaliste(s)`} status={status(finalists.length >= groups.length * (settings?.finalists_per_group ?? 3), formed)}>
            {!formed ? (
              <p className="text-sm text-smoke">Constituez d’abord les groupes.</p>
            ) : (
              <div className="grid gap-4 2xl:grid-cols-2">
                {groups.map((g) => <GroupCard key={g} season={season} group={g} stages={st} events={ev} wanted={settings?.finalists_per_group ?? 3} onDone={reload} />)}
              </div>
            )}
          </Step>

          <Step n={4} title="Finale — pilotes Elite de la saison" status={status(elites.length > 0, finalists.length > 0)}>
            {!finalists.length ? (
              <p className="text-sm text-smoke">Validez d’abord les finalistes.</p>
            ) : (
              <FinaleCard season={season} stages={st} events={ev} wanted={settings?.elite_count ?? 3} onDone={reload} />
            )}
          </Step>
        </div>
      )}
    </>
  )
}
