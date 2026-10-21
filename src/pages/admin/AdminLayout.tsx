import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from '../../lib/router'
import { useAuth } from '../../lib/auth'
import { ROLE_LABEL } from '../../lib/labels'
import type { AdminRole } from '../../lib/types'
import { Emblem, Wordmark } from '../../components/brand/Logo'
import { Icon, type IconName } from '../../components/ui/Icon'
import { EmptyState } from '../../components/ui/primitives'
import { cx } from '../../components/ui/cx'

interface NavItem {
  to: string
  label: string
  icon: IconName
  role: AdminRole
  end?: boolean
}

const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: 'Pilotage',
    items: [
      { to: '/admin', label: 'Tableau de bord', icon: 'dashboard', role: 'editor', end: true },
      { to: '/admin/courses', label: 'Courses & résultats', icon: 'flag', role: 'editor' },
      { to: '/admin/pilotes', label: 'Pilotes', icon: 'helmet', role: 'editor' },
      { to: '/admin/phases', label: 'Phases & sélection', icon: 'layers', role: 'admin' },
      { to: '/admin/challenges', label: 'Challenges Elite', icon: 'swords', role: 'admin' },
      { to: '/admin/statistiques', label: 'Statistiques', icon: 'chart', role: 'editor' },
    ],
  },
  {
    title: 'Site public',
    items: [{ to: '/admin/contenu', label: 'Contenus & règlement', icon: 'file', role: 'editor' }],
  },
  {
    title: 'Configuration',
    items: [
      { to: '/admin/saisons', label: 'Saisons', icon: 'calendar', role: 'admin' },
      { to: '/admin/parametres', label: 'Barèmes & paramètres', icon: 'settings', role: 'admin' },
      { to: '/admin/comptes', label: 'Organisateurs', icon: 'users', role: 'owner' },
      { to: '/admin/journal', label: 'Journal', icon: 'history', role: 'admin' },
      { to: '/admin/donnees', label: 'Export & données', icon: 'download', role: 'admin' },
    ],
  },
]

export function AdminLayout({ children }: { children: ReactNode }) {
  const { profile, signOut, can } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])

  const nav = (
    <nav aria-label="Back-office" className="space-y-7">
      {NAV.map((group) => {
        const items = group.items.filter((i) => can(i.role))
        if (!items.length) return null
        return (
          <div key={group.title}>
            <p className="label mb-2 px-3 text-[0.62rem]">{group.title}</p>
            <ul className="space-y-0.5">
              {items.map((i) => (
                <li key={i.to}>
                  <NavLink
                    to={i.to}
                    end={i.end}
                    className={(active) =>
                      cx(
                        'flex items-center gap-3 border-l-2 px-3 py-2 text-sm transition-colors',
                        active ? 'border-blood-500 bg-blood-500/10 text-bone' : 'border-transparent text-smoke hover:bg-white/[0.03] hover:text-bone',
                      )
                    }
                  >
                    <Icon name={i.icon} size={16} />
                    {i.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-dvh bg-ink-950 lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="hidden border-r border-ink-700 bg-ink-900 lg:flex lg:flex-col">
        <div className="sticky top-0 flex h-dvh flex-col">
          <Link to="/admin" className="flex items-center gap-2.5 border-b border-ink-700 px-5 py-5">
            <Emblem size={30} />
            <span>
              <Wordmark size="sm" />
              <span className="block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-smoke">Back-office</span>
            </span>
          </Link>
          <div className="flex-1 overflow-y-auto px-2 py-6">{nav}</div>
          <div className="border-t border-ink-700 p-4">
            <p className="truncate text-sm text-bone">{profile?.display_name}</p>
            <p className="text-xs text-smoke">{profile && ROLE_LABEL[profile.role]}</p>
            <div className="mt-3 flex gap-2">
              <Link to="/" className="flex-1 border border-ink-600 px-2 py-1.5 text-center text-xs text-smoke hover:text-bone">Voir le site</Link>
              <button
                onClick={async () => {
                  await signOut()
                  navigate('/admin/login')
                }}
                className="flex items-center gap-1.5 border border-ink-600 px-2 py-1.5 text-xs text-smoke hover:border-blood-500 hover:text-bone"
              >
                <Icon name="logout" size={13} /> Déconnexion
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-ink-700 bg-ink-950/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link to="/admin" className="flex items-center gap-2"><Emblem size={28} /><Wordmark size="sm" /></Link>
          <button className="grid size-10 place-items-center border border-ink-600" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Menu">
            <Icon name={open ? 'close' : 'menu'} />
          </button>
        </header>
        {open && (
          <div className="border-b border-ink-700 bg-ink-900 px-2 py-5 lg:hidden">
            {nav}
            <div className="mt-6 flex items-center justify-between border-t border-ink-700 px-3 pt-4 text-sm">
              <span className="text-ash">{profile?.display_name} · {profile && ROLE_LABEL[profile.role]}</span>
              <button onClick={async () => { await signOut(); navigate('/admin/login') }} className="text-blood-400">Déconnexion</button>
            </div>
          </div>
        )}
        <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  )
}

export function AdminPageHeader({ title, kicker, children, actions }: { title: string; kicker?: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-ink-700 pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        {kicker && <p className="kicker mb-2">{kicker}</p>}
        <h1 className="display text-5xl text-bone">{title}</h1>
        {children && <div className="mt-2 max-w-3xl text-sm text-ash">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Forbidden({ role }: { role: AdminRole }) {
  return (
    <EmptyState icon="lock" title="Accès restreint">
      Cette section est réservée au rôle « {ROLE_LABEL[role]} » ou supérieur.
    </EmptyState>
  )
}
