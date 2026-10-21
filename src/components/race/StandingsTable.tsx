import { useMemo, useState, type ReactNode } from 'react'
import { Link } from '../../lib/router'
import type { PilotRank } from '../../lib/types'
import { cx } from '../ui/cx'
import { Icon } from '../ui/Icon'
import { DemoBadge } from '../ui/primitives'
import { PositionChip, RankBadge } from './Badges'

export interface StandingRow {
  pilot_id: string
  pseudonym: string
  tag?: string | null
  rank?: PilotRank
  races: number
  wins: number
  podiums: number
  points: number
  podium_rate: number | null
  position: number
  is_demo?: boolean
}

export type SortKey = 'position' | 'points' | 'wins' | 'podiums' | 'races'

const SORTS: { key: SortKey; label: string; short: string }[] = [
  { key: 'races', label: 'Courses disputées', short: 'Courses' },
  { key: 'wins', label: 'Victoires', short: 'Vict.' },
  { key: 'podiums', label: 'Podiums', short: 'Podiums' },
]

export function sortStandings(rows: StandingRow[], key: SortKey): StandingRow[] {
  const copy = [...rows]
  if (key === 'position' || key === 'points') return copy.sort((a, b) => a.position - b.position || a.pseudonym.localeCompare(b.pseudonym))
  return copy.sort((a, b) => b[key] - a[key] || a.position - b.position)
}

export function StandingsTable({
  rows,
  sortable = true,
  initialSort = 'position',
  showRank = true,
  showRate = true,
  linkPilots = true,
  sort: controlledSort,
  onSortChange,
  caption,
}: {
  rows: StandingRow[]
  sortable?: boolean
  initialSort?: SortKey
  showRank?: boolean
  showRate?: boolean
  linkPilots?: boolean
  sort?: SortKey
  onSortChange?: (k: SortKey) => void
  caption?: string
}) {
  const [localSort, setLocalSort] = useState<SortKey>(initialSort)
  const sort = controlledSort ?? localSort
  const setSort = (k: SortKey) => (onSortChange ? onSortChange(k) : setLocalSort(k))
  const sorted = useMemo(() => sortStandings(rows, sort), [rows, sort])

  const Th = ({ k, children, className }: { k?: SortKey; children: ReactNode; className?: string }) => {
    const active = k && (sort === k || (k === 'points' && sort === 'position'))
    return (
      <th scope="col" className={cx('px-3 py-3 font-display text-[0.7rem] font-bold uppercase tracking-[0.16em]', className)} aria-sort={active ? 'descending' : undefined}>
        {k && sortable ? (
          <button
            type="button"
            onClick={() => setSort(k)}
            className={cx('inline-flex items-center gap-1 transition-colors hover:text-bone', active ? 'text-blood-400' : 'text-smoke')}
          >
            {children}
            <Icon name="chevronDown" size={12} className={active ? 'opacity-100' : 'opacity-30'} />
          </button>
        ) : (
          <span className="text-smoke">{children}</span>
        )}
      </th>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-y-1.5 text-left">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            <Th k="position" className="w-16">Pos.</Th>
            <Th>Pilote</Th>
            {showRank && <Th className="hidden md:table-cell">Rang</Th>}
            {SORTS.map((s) => (
              <Th key={s.key} k={s.key} className="text-right">
                <span className="hidden sm:inline">{s.label.split(' ')[0]}</span>
                <span className="sm:hidden">{s.short}</span>
              </Th>
            ))}
            {showRate && <Th className="hidden text-right lg:table-cell">Taux podium</Th>}
            <Th k="points" className="text-right">Points</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const top = r.position <= 3
            return (
              <tr key={r.pilot_id} className={cx('board-row group', r.position === 1 && 'bg-blood-500/[0.07]')}>
                <td className={cx('border-y border-l border-ink-600 px-3 py-2.5', r.position === 1 && 'border-l-2 border-l-blood-500')}>
                  <PositionChip position={r.position} size="sm" />
                </td>
                <td className="border-y border-ink-600 px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    {linkPilots ? (
                      <Link to={`/pilotes/${r.pilot_id}`} className={cx('display link-underline text-xl', top ? 'text-bone' : 'text-ash group-hover:text-bone')}>
                        {r.pseudonym}
                      </Link>
                    ) : (
                      <span className="display text-xl text-bone">{r.pseudonym}</span>
                    )}
                    {r.tag && <span className="hidden font-mono text-[0.68rem] text-smoke sm:inline">{r.tag}</span>}
                    {r.is_demo && <DemoBadge />}
                  </div>
                </td>
                {showRank && (
                  <td className="hidden border-y border-ink-600 px-3 py-2.5 md:table-cell">{r.rank && <RankBadge rank={r.rank} />}</td>
                )}
                <td className="border-y border-ink-600 px-3 py-2.5 text-right font-mono text-sm text-ash tabular">{r.races}</td>
                <td className="border-y border-ink-600 px-3 py-2.5 text-right font-mono text-sm text-ash tabular">{r.wins}</td>
                <td className="border-y border-ink-600 px-3 py-2.5 text-right font-mono text-sm text-ash tabular">{r.podiums}</td>
                {showRate && (
                  <td className="hidden border-y border-ink-600 px-3 py-2.5 text-right font-mono text-sm text-smoke tabular lg:table-cell">
                    {r.podium_rate == null ? '—' : `${r.podium_rate.toLocaleString('fr-FR')} %`}
                  </td>
                )}
                <td className="border-y border-r border-ink-600 px-4 py-2.5 text-right">
                  <span className={cx('font-display text-2xl font-extrabold italic tabular', r.position === 1 ? 'text-blood-400' : 'text-bone')}>
                    {r.points}
                  </span>
                  <span className="ml-1 text-[0.65rem] uppercase tracking-wider text-smoke">pts</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
