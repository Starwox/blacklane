import type { PilotRank } from '../../lib/types'
import { Icon } from '../ui/Icon'
import { cx } from '../ui/cx'
import { RANK_ICON } from './Badges'

export function PhaseTimeline({ items }: { items: { key: PilotRank; name: string; description: string }[] }) {
  return (
    <ol className="relative grid gap-4 md:grid-cols-4 md:gap-0">
      <span aria-hidden className="absolute left-[27px] top-4 bottom-4 w-px bg-gradient-to-b from-ink-500 via-ink-500 to-blood-500 md:left-0 md:right-0 md:top-[27px] md:bottom-auto md:h-px md:w-auto md:bg-gradient-to-r" />
      {items.map((it, i) => {
        const last = i === items.length - 1
        return (
          <li key={it.key + i} className="relative flex gap-5 md:flex-col md:gap-0 md:pr-6">
            <span
              className={cx(
                'chamfer-sm relative z-10 grid size-14 shrink-0 place-items-center border bg-ink-900',
                last ? 'border-blood-500 text-blood-400 shadow-glow' : 'border-ink-500 text-ash',
              )}
            >
              <Icon name={RANK_ICON[it.key] ?? 'flag'} size={24} />
            </span>
            <div className="pb-2 md:pt-6">
              <p className="font-mono text-[0.7rem] text-smoke">0{i + 1}</p>
              <h3 className={cx('display mt-1 text-3xl', last ? 'text-blood-400' : 'text-bone')}>{it.name}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-ash">{it.description}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
