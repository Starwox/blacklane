// Routeur minimal basé sur l'API History : routes déclaratives avec
// paramètres (/pilotes/:id), liens, navigation et paramètres de requête.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
  type MouseEvent,
} from 'react'

interface Location {
  pathname: string
  search: string
  hash: string
}

interface RouterState {
  location: Location
  navigate: (to: string, opts?: { replace?: boolean; scroll?: boolean }) => void
  params: Record<string, string>
}

const RouterContext = createContext<RouterState | null>(null)
const ParamsContext = createContext<Record<string, string>>({})

const readLocation = (): Location => ({
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash,
})

export function Router({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<Location>(readLocation)

  useEffect(() => {
    const onPop = () => setLocation(readLocation())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to: string, opts: { replace?: boolean; scroll?: boolean } = {}) => {
    const url = new URL(to, window.location.href)
    const next = url.pathname + url.search + url.hash
    if (next === window.location.pathname + window.location.search + window.location.hash) return
    if (opts.replace) window.history.replaceState(null, '', next)
    else window.history.pushState(null, '', next)
    setLocation(readLocation())
    if (opts.scroll !== false && !url.hash) window.scrollTo({ top: 0 })
  }, [])

  const value = useMemo(() => ({ location, navigate, params: {} }), [location, navigate])
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

function useRouter(): RouterState {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter doit être utilisé dans <Router>')
  return ctx
}

export const useLocation = () => useRouter().location
export const useNavigate = () => useRouter().navigate
export const useParams = <T extends Record<string, string> = Record<string, string>>() => useContext(ParamsContext) as T

/** Paramètres de requête (?saison=…), modifiables sans recharger la page */
export function useSearchParams(): [URLSearchParams, (next: Record<string, string | null | undefined>, replace?: boolean) => void] {
  const { location, navigate } = useRouter()
  const params = useMemo(() => new URLSearchParams(location.search), [location.search])
  const update = useCallback(
    (next: Record<string, string | null | undefined>, replace = true) => {
      const p = new URLSearchParams(window.location.search)
      for (const [k, v] of Object.entries(next)) {
        if (v == null || v === '') p.delete(k)
        else p.set(k, v)
      }
      const qs = p.toString()
      navigate(window.location.pathname + (qs ? `?${qs}` : ''), { replace, scroll: false })
    },
    [navigate],
  )
  return [params, update]
}

/** Teste un motif (/pilotes/:id, /admin/*) et renvoie les paramètres */
export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const clean = (s: string) => s.replace(/\/+$/, '') || '/'
  const p = clean(pattern).split('/')
  const s = clean(pathname).split('/')
  const params: Record<string, string> = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '*') return params
    if (i >= s.length) return null
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i])
    else if (p[i] !== s[i]) return null
  }
  return p.length === s.length ? params : null
}

export interface RouteDef {
  path: string
  render: () => ReactNode
}

/** Affiche la première route correspondant à l'URL courante */
export function Routes({ routes, fallback }: { routes: RouteDef[]; fallback: () => ReactNode }) {
  const { pathname } = useLocation()
  for (const r of routes) {
    const params = matchPath(r.path, pathname)
    if (params) return <ParamsContext.Provider value={params}>{r.render()}</ParamsContext.Provider>
  }
  return <>{fallback()}</>
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string; replace?: boolean }

const isModifiedEvent = (e: MouseEvent) => e.metaKey || e.altKey || e.ctrlKey || e.shiftKey || e.button !== 0

export function Link({ to, replace, onClick, target, ...rest }: LinkProps) {
  const navigate = useNavigate()
  const external = /^(https?:|mailto:|tel:)/.test(to)
  return (
    <a
      href={to}
      target={target}
      rel={external ? 'noopener noreferrer' : rest.rel}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || external || target === '_blank' || isModifiedEvent(e)) return
        e.preventDefault()
        navigate(to, { replace })
      }}
      {...rest}
    />
  )
}

export function NavLink({
  to,
  end,
  className,
  ...rest
}: Omit<LinkProps, 'className'> & { end?: boolean; className?: string | ((active: boolean) => string) }) {
  const { pathname } = useLocation()
  const target = to.split('?')[0]
  const active = end || target === '/' ? pathname === target : pathname === target || pathname.startsWith(target + '/')
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={typeof className === 'function' ? className(active) : className}
      {...rest}
    />
  )
}

export function Navigate({ to, replace = true }: { to: string; replace?: boolean }) {
  const navigate = useNavigate()
  useEffect(() => navigate(to, { replace }), [to, replace, navigate])
  return null
}
