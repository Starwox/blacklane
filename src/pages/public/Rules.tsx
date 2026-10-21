import { useEffect, useState } from 'react'
import { useData } from '../../hooks/useData'
import { getContent } from '../../lib/api'
import { fillTemplate } from '../../lib/template'
import type { RulesContent } from '../../lib/types'
import { Container, PageHero, useSite } from '../../components/layout'
import { ErrorState, LoadingBlock } from '../../components/ui/primitives'
import { Icon } from '../../components/ui/Icon'
import { cx } from '../../components/ui/cx'
import { RichText } from '../../components/race/RichText'

export default function Rules({ preview }: { preview?: RulesContent }) {
  const { vars } = useSite()
  const content = useData(async () => preview ?? (await getContent('rules')), [preview])
  const [open, setOpen] = useState<Set<string>>(new Set())
  const c = preview ?? content.data

  useEffect(() => {
    if (!preview) document.title = 'Règlement — BLACKLANE'
  }, [preview])
  useEffect(() => {
    if (c?.sections.length) {
      const hash = window.location.hash.slice(1)
      setOpen(new Set(hash ? [hash] : [c.sections[0].id]))
    }
  }, [c])

  if (content.error && !preview) return <Container className="pb-20 pt-32"><ErrorState error={content.error} onRetry={content.reload} /></Container>
  if (!c) return <Container className="pb-20 pt-32"><LoadingBlock rows={6} /></Container>

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allOpen = open.size === c.sections.length

  return (
    <>
      <PageHero kicker="Code de conduite" title="Règlement">{fillTemplate(c.intro, vars)}</PageHero>
      <Container className="grid gap-10 py-12 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Sections du règlement" className="hidden lg:block">
          <ol className="sticky top-28 space-y-1 border-l border-ink-600">
            {c.sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={() => setOpen((p) => new Set(p).add(s.id))}
                  className="-ml-px flex gap-3 border-l border-transparent py-1.5 pl-4 text-sm text-smoke transition-colors hover:border-blood-500 hover:text-bone"
                >
                  <span className="font-mono text-xs text-ink-400">{String(i + 1).padStart(2, '0')}</span>
                  {s.title}
                </a>
              </li>
            ))}
            <li>
              <a href="#sanctions" className="-ml-px flex gap-3 border-l border-transparent py-1.5 pl-4 text-sm text-smoke hover:border-blood-500 hover:text-bone">
                <span className="font-mono text-xs text-ink-400">—</span>Sanctions
              </a>
            </li>
          </ol>
        </nav>

        <div className="min-w-0">
          <div className="mb-4 flex justify-end">
            <button
              className="font-display text-xs font-bold uppercase tracking-[0.16em] text-smoke hover:text-bone"
              onClick={() => setOpen(allOpen ? new Set() : new Set(c.sections.map((s) => s.id)))}
            >
              {allOpen ? 'Tout replier' : 'Tout déplier'}
            </button>
          </div>
          <div className="space-y-2">
            {c.sections.map((s, i) => {
              const isOpen = open.has(s.id)
              return (
                <section key={s.id} id={s.id} className={cx('scroll-mt-28 border transition-colors', isOpen ? 'border-ink-500 bg-ink-850' : 'border-ink-600 bg-ink-900/50')}>
                  <h2>
                    <button
                      className="flex w-full items-center gap-5 px-5 py-4 text-left"
                      aria-expanded={isOpen}
                      aria-controls={`${s.id}-body`}
                      onClick={() => toggle(s.id)}
                    >
                      <span className={cx('font-display text-3xl font-black italic leading-none tabular', isOpen ? 'text-blood-500' : 'text-ink-400')}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="display flex-1 text-2xl text-bone sm:text-3xl">{s.title}</span>
                      <Icon name="chevronDown" className={cx('shrink-0 text-smoke transition-transform', isOpen && 'rotate-180 text-blood-400')} />
                    </button>
                  </h2>
                  {isOpen && (
                    <div id={`${s.id}-body`} className="border-t border-ink-600 px-5 py-5 sm:pl-[4.6rem]">
                      <RichText text={fillTemplate(s.body, vars)} />
                    </div>
                  )}
                </section>
              )
            })}
          </div>

          <section id="sanctions" className="mt-14 scroll-mt-28">
            <h2 className="display mb-2 text-4xl text-bone">Sanctions</h2>
            <p className="mb-6 text-sm text-smoke">Les organisateurs appliquent les sanctions ci-dessous. En cas de situation non prévue, ils statuent au cas par cas.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-500">
                    <th scope="col" className="label py-3 pr-6">Infraction</th>
                    <th scope="col" className="label py-3">Sanction</th>
                  </tr>
                </thead>
                <tbody>
                  {c.sanctions.map((s) => (
                    <tr key={s.id} className="border-b border-ink-700 align-top">
                      <td className="py-3.5 pr-6 text-bone">{s.infraction}</td>
                      <td className="py-3.5 text-ash">
                        <span className="inline-flex gap-2"><span className="mt-2 h-0.5 w-3 shrink-0 bg-blood-500" />{s.sanction}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </Container>
    </>
  )
}
