import { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from '../../lib/router'
import { useData } from '../../hooks/useData'
import { createPilot, listPilots, listSeasons } from '../../lib/admin-api'
import { getStandings } from '../../lib/api'
import { PILOT_STATUS_LABEL, RANK_LABEL, RANKS } from '../../lib/labels'
import type { PilotRank, PilotStatus } from '../../lib/types'
import { AdminPageHeader } from './AdminLayout'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Modal } from '../../components/ui/Modal'
import { TextArea, TextInput } from '../../components/ui/Form'
import { DemoBadge, EmptyState, ErrorState, LoadingBlock } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/Toast'
import { RankBadge } from '../../components/race/Badges'
import { cx } from '../../components/ui/cx'

export function PilotForm({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial?: { pseudonym: string; tag: string | null; vehicle: string | null; bio: string | null }
  onSubmit: (v: { pseudonym: string; tag: string | null; vehicle: string | null; bio: string | null }) => Promise<void>
  submitLabel: string
}) {
  const [pseudonym, setPseudonym] = useState(initial?.pseudonym ?? '')
  const [tag, setTag] = useState(initial?.tag ?? '')
  const [vehicle, setVehicle] = useState(initial?.vehicle ?? '')
  const [bio, setBio] = useState(initial?.bio ?? '')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    const p = pseudonym.trim()
    if (p.length < 2 || p.length > 32) e.pseudonym = 'Entre 2 et 32 caractères.'
    else if (/[<>]/.test(p)) e.pseudonym = 'Caractères < et > interdits.'
    if (tag && !/^[A-Z0-9-]{1,12}$/.test(tag)) e.tag = 'Majuscules, chiffres et tirets (12 max.).'
    if (vehicle.length > 60) e.vehicle = '60 caractères maximum.'
    if (bio.length > 500) e.bio = '500 caractères maximum.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (ev) => {
        ev.preventDefault()
        if (!validate()) return
        setBusy(true)
        try {
          await onSubmit({ pseudonym: pseudonym.trim(), tag: tag || null, vehicle: vehicle.trim() || null, bio: bio.trim() || null })
        } finally {
          setBusy(false)
        }
      }}
    >
      <TextInput label="Pseudonyme RP" required value={pseudonym} onChange={(e) => setPseudonym(e.target.value)} error={errors.pseudonym} hint="Jamais de nom civil : ce champ est public." maxLength={32} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Plaque / numéro" value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())} error={errors.tag} placeholder="BL-026" maxLength={12} />
        <TextInput label="Véhicule" value={vehicle} onChange={(e) => setVehicle(e.target.value)} error={errors.vehicle} maxLength={60} />
      </div>
      <TextArea label="Présentation publique" value={bio} onChange={(e) => setBio(e.target.value)} error={errors.bio} rows={3} maxLength={500} hint={`${bio.length}/500 — visible sur la fiche pilote.`} />
      <div className="flex justify-end">
        <Button type="submit" loading={busy}>{submitLabel}</Button>
      </div>
    </form>
  )
}

export default function Pilots() {
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const pilots = useData(() => listPilots(), [])
  const stats = useData(async () => {
    const seasons = await listSeasons()
    const active = seasons.find((s) => s.status === 'active')
    return active ? { season: active, rows: await getStandings(active.id) } : null
  }, [])
  const [q, setQ] = useState('')
  const [rank, setRank] = useState<PilotRank | ''>('')
  const [status, setStatus] = useState<PilotStatus | 'current'>('current')
  const creating = params.get('nouveau') === '1'

  useEffect(() => {
    document.title = 'Pilotes — Back-office'
  }, [])

  const byPilot = useMemo(() => new Map((stats.data?.rows ?? []).map((r) => [r.pilot_id, r])), [stats.data])
  const list = useMemo(
    () =>
      (pilots.data ?? [])
        .filter((p) => (status === 'current' ? p.status === 'active' || p.status === 'inactive' : p.status === status))
        .filter((p) => (rank ? p.rank === rank : true))
        .filter((p) => (q ? `${p.pseudonym} ${p.tag ?? ''}`.toLowerCase().includes(q.toLowerCase()) : true)),
    [pilots.data, status, rank, q],
  )

  return (
    <>
      <AdminPageHeader
        title="Pilotes"
        actions={<Button icon={<Icon name="plus" size={15} />} onClick={() => setParams({ nouveau: '1' }, false)}>Ajouter un pilote</Button>}
      >
        Les pilotes ne sont jamais supprimés lorsqu’ils ont un historique : archivez-les pour conserver les classements des saisons passées.
      </AdminPageHeader>

      <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <span className="relative block">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-smoke" />
          <input className="field pl-9" placeholder="Rechercher un pseudonyme ou une plaque…" value={q} onChange={(e) => setQ(e.target.value)} />
        </span>
        <select className="field" value={rank} onChange={(e) => setRank(e.target.value as PilotRank | '')} aria-label="Filtrer par rang">
          <option value="">Tous les rangs</option>
          {RANKS.map((r) => <option key={r} value={r}>{RANK_LABEL[r]}</option>)}
        </select>
        <select className="field" value={status} onChange={(e) => setStatus(e.target.value as PilotStatus | 'current')} aria-label="Filtrer par statut">
          <option value="current">Actifs et inactifs</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
          <option value="archived">Archivés</option>
          <option value="banned">Exclus</option>
        </select>
      </div>

      {pilots.error ? (
        <ErrorState error={pilots.error} onRetry={pilots.reload} />
      ) : pilots.loading ? (
        <LoadingBlock rows={8} />
      ) : list.length === 0 ? (
        <EmptyState icon="helmet" title="Aucun pilote" action={<Button onClick={() => setParams({ nouveau: '1' }, false)}>Ajouter un pilote</Button>}>
          {pilots.data?.length ? 'Aucun pilote ne correspond à ces filtres.' : 'Commencez par enregistrer les pilotes invités.'}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto border border-ink-600">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-ink-900">
              <tr>
                {['Pilote', 'Rang', 'Statut', stats.data ? `Pos. ${stats.data.season.name}` : 'Position', 'Points', 'Courses', ''].map((h) => (
                  <th key={h} scope="col" className="label px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const s = byPilot.get(p.id)
                return (
                  <tr key={p.id} className="border-t border-ink-700 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <Link to={`/admin/pilotes/${p.id}`} className="font-semibold text-bone hover:text-blood-300">{p.pseudonym}</Link>
                      {p.tag && <span className="ml-2 font-mono text-xs text-smoke">{p.tag}</span>}
                      {p.is_demo && <DemoBadge />}
                    </td>
                    <td className="px-4 py-3"><RankBadge rank={p.rank} /></td>
                    <td className={cx('px-4 py-3', p.status === 'active' ? 'text-ash' : 'text-smoke')}>{PILOT_STATUS_LABEL[p.status]}</td>
                    <td className="px-4 py-3 font-mono tabular text-ash">{s ? s.position : '—'}</td>
                    <td className="px-4 py-3 font-mono tabular text-bone">{s ? s.points : '—'}</td>
                    <td className="px-4 py-3 font-mono tabular text-ash">{s ? s.races : 0}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/admin/pilotes/${p.id}`} className="inline-flex items-center gap-1 text-xs text-smoke hover:text-bone">
                        Gérer <Icon name="chevronRight" size={14} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={creating} onClose={() => setParams({ nouveau: null })} title="Nouveau pilote">
        <PilotForm
          submitLabel="Créer le pilote"
          onSubmit={async (v) => {
            try {
              const p = await createPilot({ ...v, status: 'active' })
              toast.success(`Pilote « ${p.pseudonym} » créé.`)
              navigate(`/admin/pilotes/${p.id}`)
            } catch (e) {
              toast.error(e)
            }
          }}
        />
      </Modal>
    </>
  )
}
