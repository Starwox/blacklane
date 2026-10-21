import { lazy, Suspense, type ReactNode } from 'react'
import { Router, Routes, useLocation, type RouteDef } from './lib/router'
import { isConfigured } from './lib/supabase'
import { AuthProvider } from './lib/auth'
import { ToastProvider } from './components/ui/Toast'
import { PublicLayout, SiteProvider } from './components/layout'
import { LoadingBlock } from './components/ui/primitives'
import { ErrorBoundary } from './components/ErrorBoundary'
import SetupRequired from './pages/SetupRequired'
import Home from './pages/public/Home'
import Standings from './pages/public/Standings'
import PilotDetail from './pages/public/PilotDetail'
import Calendar from './pages/public/Calendar'
import EventDetail from './pages/public/EventDetail'
import Qualifications from './pages/public/Qualifications'
import Rules from './pages/public/Rules'
import Legal from './pages/public/Legal'
import NotFound from './pages/public/NotFound'

// Le back-office est chargé à la demande : il n'alourdit pas le site public
const AdminApp = lazy(() => import('./pages/admin/AdminApp'))

const pub = (node: ReactNode) => () => <PublicLayout>{node}</PublicLayout>

const publicRoutes: RouteDef[] = [
  { path: '/', render: pub(<Home />) },
  { path: '/classement', render: pub(<Standings />) },
  { path: '/pilotes/:id', render: pub(<PilotDetail />) },
  { path: '/calendrier', render: pub(<Calendar />) },
  { path: '/calendrier/:id', render: pub(<EventDetail />) },
  { path: '/qualifications', render: pub(<Qualifications />) },
  { path: '/reglement', render: pub(<Rules />) },
  { path: '/mentions', render: pub(<Legal />) },
]

function Shell() {
  const { pathname } = useLocation()
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return (
      <SiteProvider>
        <Suspense fallback={<div className="p-10"><LoadingBlock rows={4} /></div>}>
          <AdminApp />
        </Suspense>
      </SiteProvider>
    )
  }
  return (
    <SiteProvider>
      <Routes key={pathname} routes={publicRoutes} fallback={pub(<NotFound />)} />
    </SiteProvider>
  )
}

export default function App() {
  if (!isConfigured) return <SetupRequired />
  return (
    <ErrorBoundary>
      <Router>
        <ToastProvider>
          <AuthProvider>
            <Shell />
          </AuthProvider>
        </ToastProvider>
      </Router>
    </ErrorBoundary>
  )
}
