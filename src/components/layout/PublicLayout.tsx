import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from '../../lib/router'
import { Emblem, Wordmark } from '../brand/Logo'
import { Icon } from '../ui/Icon'
import { cx } from '../ui/cx'
import { useSite } from './SiteContext'

const NAV = [
  { to: '/', label: 'Accueil' },
  { to: '/classement', label: 'Classement' },
  { to: '/calendrier', label: 'Calendrier' },
  { to: '/qualifications', label: 'Qualifications' },
  { to: '/reglement', label: 'Règlement' },
]

function Header() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cx(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled || open ? 'border-b border-ink-600/80 bg-ink-950/85 backdrop-blur-md' : 'border-b border-transparent bg-gradient-to-b from-ink-950/90 to-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-[72px] lg:px-8">
        <Link to="/" className="flex items-center gap-2.5" aria-label="Blacklane — accueil">
          <Emblem size={34} />
          <Wordmark size="md" />
        </Link>
        <nav aria-label="Navigation principale" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={(active) =>
                cx(
                  'relative px-3.5 py-2 font-display text-[0.82rem] font-bold uppercase tracking-[0.18em] transition-colors',
                  active ? 'text-bone' : 'text-smoke hover:text-bone',
                  active && 'after:absolute after:inset-x-3.5 after:-bottom-0.5 after:h-0.5 after:bg-blood-500',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
          <Link
            to="/admin/login"
            className="ml-4 grid size-9 place-items-center border border-ink-600 text-ink-400 transition-colors hover:border-ink-400 hover:text-ash"
            aria-label="Accès organisateurs"
            title="Accès organisateurs"
          >
            <Icon name="lock" size={15} />
          </Link>
        </nav>
        <button
          className="grid size-10 place-items-center border border-ink-600 text-bone lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          <Icon name={open ? 'close' : 'menu'} />
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Navigation mobile" className="border-t border-ink-600 bg-ink-950 px-4 pb-6 pt-2 lg:hidden">
          {NAV.map((n, i) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={(active) =>
                cx('flex items-center justify-between border-b border-ink-700 py-4 display text-3xl', active ? 'text-blood-400' : 'text-bone')
              }
            >
              {n.label}
              <span className="font-mono text-xs text-smoke not-italic">0{i + 1}</span>
            </NavLink>
          ))}
          <Link to="/admin/login" className="mt-5 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-smoke">
            <Icon name="lock" size={13} /> Accès organisateurs
          </Link>
        </nav>
      )}
    </header>
  )
}

function Footer() {
  const { footer, stats } = useSite()
  return (
    <footer className="relative border-t border-ink-600 bg-ink-950">
      <div className="rule-red absolute inset-x-0 top-0" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_1fr_1.4fr] lg:px-8">
        <div>
          <div className="flex items-center gap-3">
            <Emblem size={44} />
            <Wordmark size="md" />
          </div>
          <p className="display mt-6 text-2xl text-bone">{footer?.tagline ?? 'Blacklane. Pas une course. Une sélection.'}</p>
          <p className="mt-1 font-display text-sm font-bold uppercase tracking-[0.3em] text-blood-400">{footer?.subline ?? 'Bienvenue dans l’ombre.'}</p>
        </div>
        <nav aria-label="Navigation secondaire">
          <p className="label mb-4">Navigation</p>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
            {NAV.map((n) => (
              <li key={n.to}>
                <Link to={n.to} className="link-underline text-ash hover:text-bone">{n.label}</Link>
              </li>
            ))}
            <li>
              <Link to="/mentions" className="link-underline text-ash hover:text-bone">Mentions & confidentialité</Link>
            </li>
            <li>
              <Link to="/admin/login" className="link-underline text-smoke hover:text-ash">Organisateurs</Link>
            </li>
          </ul>
        </nav>
        <div className="space-y-4 text-xs leading-relaxed text-smoke">
          <p className="label">Univers fictif</p>
          <p>{footer?.disclaimer ?? 'Blacklane est un projet de roleplay se déroulant dans un univers fictif.'}</p>
        </div>
      </div>
      <div className="border-t border-ink-700">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-[0.7rem] uppercase tracking-[0.18em] text-ink-400 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <span>© Blacklane — projet RP · Los Santos</span>
          {stats?.has_demo && <span className="text-amber-400/80">Données de démonstration affichées</span>}
        </div>
      </div>
    </footer>
  )
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const { stats } = useSite()
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-blood-500 focus:px-4 focus:py-2 focus:text-white">
        Aller au contenu
      </a>
      <Header />
      {stats?.has_demo && (
        <div className="fixed bottom-3 left-3 z-40 hidden border border-amber-400/40 bg-ink-950/90 px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-amber-400 backdrop-blur md:block">
          Démo — données fictives à purger
        </div>
      )}
      <main id="contenu" className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}

/** En-tête standard des pages internes */
export function PageHero({ kicker, title, children, aside }: { kicker: string; title: ReactNode; children?: ReactNode; aside?: ReactNode }) {
  return (
    <section className="asphalt relative overflow-hidden border-b border-ink-600 pb-12 pt-32 lg:pb-16 lg:pt-40">
      <div className="rain pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -right-32 -top-40 size-[520px] rounded-full bg-blood-500/10 blur-3xl" />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="reveal max-w-3xl">
          <p className="kicker mb-4 flex items-center gap-3"><span className="h-px w-10 bg-blood-500" />{kicker}</p>
          <h1 className="display text-6xl text-bone sm:text-7xl lg:text-8xl">{title}</h1>
          {children && <div className="mt-5 max-w-2xl text-base leading-relaxed text-ash sm:text-lg">{children}</div>}
        </div>
        {aside && <div className="reveal">{aside}</div>}
      </div>
    </section>
  )
}

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mx-auto max-w-7xl px-4 sm:px-6 lg:px-8', className)}>{children}</div>
}
