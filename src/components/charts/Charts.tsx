// Graphiques SVG légers (d3-scale / d3-shape), adaptés au thème sombre.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { scaleBand, scaleLinear, scalePoint } from 'd3-scale'
import { curveMonotoneX, line } from 'd3-shape'
import { cx } from '../ui/cx'
import { EmptyState } from '../ui/primitives'

export const SERIES_COLORS = ['#ff3434', '#ece8e1', '#f0b44c', '#4fd18b', '#5aa9ff', '#c77dff', '#ff8fab', '#8a857f', '#2dd4bf', '#fb923c']
export const colorAt = (i: number) => SERIES_COLORS[i % SERIES_COLORS.length]

/** Largeur observée d'un élément (ref de rappel : fonctionne même si l'élément apparaît après coup) */
function useWidth<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!el) return
    setW(el.clientWidth)
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return [setEl, w]
}

export function ChartCard({ title, subtitle, children, action, className }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={cx('panel-flat p-5', className)}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="display text-2xl text-bone">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-smoke">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <li key={it.name} className="flex items-center gap-1.5 text-xs text-ash">
          <span className="h-0.5 w-3.5" style={{ background: it.color }} />
          {it.name}
        </li>
      ))}
    </ul>
  )
}

export interface LineSeries {
  id: string
  name: string
  color?: string
  /** Une valeur par libellé de l'axe X ; null = pas de point */
  values: (number | null)[]
}

export function LineChart({
  labels,
  series,
  height = 260,
  invert = false,
  yFormat = (v: number) => String(v),
  emptyText = 'Aucune donnée enregistrée pour cette sélection.',
  integerY = true,
}: {
  labels: string[]
  series: LineSeries[]
  height?: number
  invert?: boolean
  yFormat?: (v: number) => string
  emptyText?: string
  integerY?: boolean
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const margin = { top: 12, right: 16, bottom: 34, left: 40 }
  const innerW = Math.max(0, width - margin.left - margin.right)
  const innerH = height - margin.top - margin.bottom

  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null))
  const has = labels.length > 0 && all.length > 0

  const { x, y, ticks } = useMemo(() => {
    const min = Math.min(0, ...all)
    const max = Math.max(1, ...all)
    const lo = invert ? Math.max(1, Math.min(...all, 1)) : min
    const hi = invert ? Math.max(...all, 2) : max
    const yS = scaleLinear().domain(invert ? [hi, lo] : [lo, hi]).range([innerH, 0]).nice()
    const xS = scalePoint<number>().domain(labels.map((_, i) => i)).range([0, innerW]).padding(labels.length === 1 ? 0.5 : 0.08)
    const t = yS.ticks(Math.min(6, Math.max(2, Math.round(hi - lo)))).filter((v) => !integerY || Number.isInteger(v))
    return { x: xS, y: yS, ticks: t }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels.length, innerW, innerH, invert, JSON.stringify(all)])

  if (!has) return <EmptyState icon="chart" title="Pas encore de données">{emptyText}</EmptyState>

  const gen = line<{ i: number; v: number }>()
    .x((d) => x(d.i) ?? 0)
    .y((d) => y(d.v))
    .curve(curveMonotoneX)

  const step = labels.length > 1 ? innerW / (labels.length - 1) : innerW
  const labelEvery = Math.max(1, Math.ceil(70 / Math.max(step, 1)))

  return (
    <div ref={ref} className="relative w-full select-none">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Graphique en courbes">
          <g transform={`translate(${margin.left},${margin.top})`}>
            {ticks.map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x1={0} x2={innerW} stroke="#26262c" strokeDasharray={t === 0 ? undefined : '2 4'} />
                <text x={-10} dy="0.32em" textAnchor="end" fill="#8a857f" fontSize="11" fontFamily="JetBrains Mono, monospace">
                  {yFormat(t)}
                </text>
              </g>
            ))}
            {labels.map((l, i) =>
              i % labelEvery === 0 || i === labels.length - 1 ? (
                <text key={i} x={x(i)} y={innerH + 22} textAnchor="middle" fill="#8a857f" fontSize="11">
                  {l.length > 14 ? l.slice(0, 13) + '…' : l}
                </text>
              ) : null,
            )}
            {hover != null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={innerH} stroke="#4a4a53" />}
            {series.map((s, si) => {
              const pts = s.values.map((v, i) => (v == null ? null : { i, v })).filter((p): p is { i: number; v: number } => p != null)
              const c = s.color ?? colorAt(si)
              return (
                <g key={s.id}>
                  <path d={gen(pts) ?? ''} fill="none" stroke={c} strokeWidth={si === 0 ? 2.5 : 2} opacity={hover == null ? 1 : 0.85} />
                  {pts.map((p) => (
                    <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={hover === p.i ? 4.5 : 2.5} fill="#08080a" stroke={c} strokeWidth="2" />
                  ))}
                </g>
              )
            })}
            <rect
              width={innerW}
              height={innerH}
              fill="transparent"
              onMouseMove={(e) => {
                const bx = (e.currentTarget as SVGRectElement).getBoundingClientRect()
                const px = e.clientX - bx.left
                let best = 0
                let dist = Infinity
                labels.forEach((_, i) => {
                  const d = Math.abs((x(i) ?? 0) - px)
                  if (d < dist) {
                    dist = d
                    best = i
                  }
                })
                setHover(best)
              }}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        </svg>
      )}
      {hover != null && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-40 border border-ink-500 bg-ink-900/95 px-3 py-2 text-xs shadow-xl"
          style={{ left: Math.min(Math.max(0, margin.left + (x(hover) ?? 0) + 12), Math.max(0, width - 180)) }}
        >
          <p className="mb-1 font-semibold text-bone">{labels[hover]}</p>
          {series
            .map((s, si) => ({ s, si, v: s.values[hover] }))
            .filter((r) => r.v != null)
            .sort((a, b) => (invert ? (a.v as number) - (b.v as number) : (b.v as number) - (a.v as number)))
            .slice(0, 10)
            .map(({ s, si, v }) => (
              <p key={s.id} className="flex items-center justify-between gap-4 text-ash">
                <span className="flex items-center gap-1.5">
                  <span className="size-2" style={{ background: s.color ?? colorAt(si) }} />
                  {s.name}
                </span>
                <span className="font-mono text-bone">{yFormat(v as number)}</span>
              </p>
            ))}
        </div>
      )}
      {series.length > 1 && <Legend items={series.map((s, i) => ({ name: s.name, color: s.color ?? colorAt(i) }))} />}
    </div>
  )
}

export interface BarDatum {
  label: string
  values: Record<string, number>
}

export function BarChart({
  data,
  keys,
  height = 260,
  stacked = false,
  emptyText = 'Aucune donnée enregistrée pour cette sélection.',
}: {
  data: BarDatum[]
  keys: { key: string; name: string; color?: string }[]
  height?: number
  stacked?: boolean
  emptyText?: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const margin = { top: 12, right: 12, bottom: 40, left: 40 }
  const innerW = Math.max(0, width - margin.left - margin.right)
  const innerH = height - margin.top - margin.bottom
  const total = (d: BarDatum) => keys.reduce((s, k) => s + (d.values[k.key] ?? 0), 0)
  const max = Math.max(1, ...data.map((d) => (stacked ? total(d) : Math.max(...keys.map((k) => d.values[k.key] ?? 0)))))
  if (!data.length || data.every((d) => total(d) === 0)) return <EmptyState icon="chart" title="Pas encore de données">{emptyText}</EmptyState>

  const x = scaleBand<number>().domain(data.map((_, i) => i)).range([0, innerW]).padding(0.28)
  const inner = scaleBand<string>().domain(keys.map((k) => k.key)).range([0, x.bandwidth()]).padding(0.12)
  const y = scaleLinear().domain([0, max]).range([innerH, 0]).nice()
  const ticks = y.ticks(5).filter((t) => Number.isInteger(t))
  const labelEvery = Math.max(1, Math.ceil(64 / Math.max(x.step(), 1)))

  return (
    <div ref={ref} className="relative w-full select-none">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Graphique en barres">
          <g transform={`translate(${margin.left},${margin.top})`}>
            {ticks.map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x1={0} x2={innerW} stroke="#26262c" strokeDasharray={t === 0 ? undefined : '2 4'} />
                <text x={-10} dy="0.32em" textAnchor="end" fill="#8a857f" fontSize="11" fontFamily="JetBrains Mono, monospace">
                  {t}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              let acc = 0
              return (
                <g key={i} transform={`translate(${x(i)},0)`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect x={-x.step() * 0.14} width={x.step()} height={innerH} fill={hover === i ? 'rgba(255,255,255,0.03)' : 'transparent'} />
                  {keys.map((k, ki) => {
                    const v = d.values[k.key] ?? 0
                    const c = k.color ?? colorAt(ki)
                    if (stacked) {
                      const y0 = y(acc)
                      acc += v
                      const y1 = y(acc)
                      return <rect key={k.key} x={0} y={y1} width={x.bandwidth()} height={Math.max(0, y0 - y1)} fill={c} />
                    }
                    return <rect key={k.key} x={inner(k.key)} y={y(v)} width={inner.bandwidth()} height={Math.max(0, innerH - y(v))} fill={c} />
                  })}
                  {i % labelEvery === 0 && (
                    <text x={x.bandwidth() / 2} y={innerH + 18} textAnchor="middle" fill="#8a857f" fontSize="11">
                      {d.label.length > 12 ? d.label.slice(0, 11) + '…' : d.label}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      )}
      {hover != null && data[hover] && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-36 border border-ink-500 bg-ink-900/95 px-3 py-2 text-xs shadow-xl"
          style={{ left: Math.min(margin.left + (x(hover) ?? 0) + x.bandwidth() + 8, Math.max(0, width - 170)) }}
        >
          <p className="mb-1 font-semibold text-bone">{data[hover].label}</p>
          {keys.map((k, ki) => (
            <p key={k.key} className="flex items-center justify-between gap-4 text-ash">
              <span className="flex items-center gap-1.5">
                <span className="size-2" style={{ background: k.color ?? colorAt(ki) }} />
                {k.name}
              </span>
              <span className="font-mono text-bone">{data[hover].values[k.key] ?? 0}</span>
            </p>
          ))}
        </div>
      )}
      {keys.length > 1 && <Legend items={keys.map((k, i) => ({ name: k.name, color: k.color ?? colorAt(i) }))} />}
    </div>
  )
}

/** Barres horizontales simples (classements, répartitions) */
export function HBarList({ items, max, format = (v: number) => String(v) }: { items: { label: string; value: number; color?: string; sub?: string }[]; max?: number; format?: (v: number) => string }) {
  if (!items.length) return <EmptyState icon="chart" title="Pas encore de données">Aucune donnée enregistrée pour cette sélection.</EmptyState>
  const m = max ?? Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={it.label + i}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ash">{it.label}{it.sub && <span className="ml-2 text-xs text-smoke">{it.sub}</span>}</span>
            <span className="font-mono text-bone tabular">{format(it.value)}</span>
          </div>
          <div className="h-1.5 bg-ink-700">
            <div className="h-full transition-[width] duration-500" style={{ width: `${(Math.max(0, it.value) / m) * 100}%`, background: it.color ?? (i === 0 ? '#e1141e' : '#4a4a53') }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
