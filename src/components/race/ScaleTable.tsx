import type { ScaleEntry } from '../../lib/types'
import { ordinal } from '../../lib/format'
import { cx } from '../ui/cx'

export function ScaleTable({ entries, className }: { entries: ScaleEntry[]; className?: string }) {
  const max = Math.max(1, ...entries.map((e) => e.points))
  return (
    <table className={cx('w-full text-sm', className)}>
      <caption className="sr-only">Barème de points</caption>
      <thead>
        <tr className="border-b border-ink-600">
          <th scope="col" className="label py-2 text-left">Position</th>
          <th scope="col" className="label py-2 text-right">Points</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.position} className="border-b border-ink-700/70">
            <td className="py-1.5 pr-4">
              <span className={cx('font-display text-lg font-bold italic', e.position <= 3 ? 'text-bone' : 'text-ash')}>{ordinal(e.position)}</span>
            </td>
            <td className="py-1.5">
              <div className="flex items-center justify-end gap-3">
                <span className="hidden h-1 flex-1 bg-ink-700 sm:block">
                  <span className={cx('block h-full', e.position === 1 ? 'bg-blood-500' : 'bg-ink-400')} style={{ width: `${(e.points / max) * 100}%` }} />
                </span>
                <span className={cx('w-14 text-right font-mono tabular', e.points ? 'text-bone' : 'text-smoke')}>
                  {e.points} pt{e.points > 1 ? 's' : ''}
                </span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
