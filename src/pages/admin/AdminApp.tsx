import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Navigate, Routes, useLocation, type RouteDef } from '../../lib/router'
import { useAuth } from '../../lib/auth'
import type { AdminRole } from '../../lib/types'
import { LoadingBlock } from '../../components/ui/primitives'
import { AdminLayout, Forbidden } from './AdminLayout'
import Login from './Login'
import ResetPassword from './ResetPassword'
import Dashboard from './Dashboard'

const Pilots = lazy(() => import('./Pilots'))
const PilotEditor = lazy(() => import('./PilotEditor'))
const Events = lazy(() => import('./Events'))
const EventEditor = lazy(() => import('./EventEditor'))
const Phases = lazy(() => import('./Phases'))
const Challenges = lazy(() => import('./Challenges'))
const ContentEditor = lazy(() => import('./ContentEditor'))
const Settings = lazy(() => import('./Settings'))
const Seasons = lazy(() => import('./Seasons'))
const Stats = lazy(() => import('./Stats'))
const Admins = lazy(() => import('./Admins'))
const Audit = lazy(() => import('./Audit'))
const DataTools = lazy(() => import('./DataTools'))

function Guard({ role, children }: { role: AdminRole; children: ReactNode }) {
  const { can } = useAuth()
  if (!can(role)) return <Forbidden role={role} />
  return <>{children}</>
}

const page = (node: ReactNode, role: AdminRole = 'editor') => () => (
  <Guard role={role}>
    <Suspense fallback={<LoadingBlock rows={6} />}>{node}</Suspense>
  </Guard>
)

const routes: RouteDef[] = [
  { path: '/admin', render: page(<Dashboard />) },
  { path: '/admin/pilotes', render: page(<Pilots />) },
  { path: '/admin/pilotes/:id', render: page(<PilotEditor />) },
  { path: '/admin/courses', render: page(<Events />) },
  { path: '/admin/courses/:id', render: page(<EventEditor />) },
  { path: '/admin/phases', render: page(<Phases />, 'admin') },
  { path: '/admin/challenges', render: page(<Challenges />, 'admin') },
  { path: '/admin/contenu', render: page(<ContentEditor />) },
  { path: '/admin/parametres', render: page(<Settings />, 'admin') },
  { path: '/admin/saisons', render: page(<Seasons />, 'admin') },
  { path: '/admin/statistiques', render: page(<Stats />) },
  { path: '/admin/comptes', render: page(<Admins />, 'owner') },
  { path: '/admin/journal', render: page(<Audit />, 'admin') },
  { path: '/admin/donnees', render: page(<DataTools />, 'admin') },
]

export default function AdminApp() {
  const { session, profile, loading, profileError } = useAuth()
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = 'Back-office — BLACKLANE'
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  if (pathname === '/admin/login') return session && profile ? <Navigate to="/admin" /> : <Login />
  if (pathname === '/admin/reinitialiser') return <ResetPassword />

  if (loading) {
    return (
      <div className="mx-auto max-w-md p-10">
        <LoadingBlock rows={3} />
      </div>
    )
  }
  if (!session) return <Navigate to={`/admin/login?suite=${encodeURIComponent(pathname)}`} />
  if (!profile) return <Login notAuthorized={!profileError} networkError={profileError} />

  return (
    <AdminLayout>
      <Routes key={pathname} routes={routes} fallback={() => <Navigate to="/admin" />} />
    </AdminLayout>
  )
}
