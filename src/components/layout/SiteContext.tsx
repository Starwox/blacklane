import { createContext, useContext, type ReactNode } from 'react'
import { useData } from '../../hooks/useData'
import { getContent, getSettings, getStats } from '../../lib/api'
import type { CompetitionSettings, FooterContent, PublicStats } from '../../lib/types'
import { settingsVars, type TemplateVars } from '../../lib/template'

interface SiteData {
  settings: CompetitionSettings | null
  footer: FooterContent | null
  stats: PublicStats | null
  vars: TemplateVars
  reloadStats: () => Promise<void>
}

const SiteContext = createContext<SiteData>({ settings: null, footer: null, stats: null, vars: {}, reloadStats: async () => {} })

/** Données communes à toutes les pages publiques (paramètres, pied de page, indicateurs) */
export function SiteProvider({ children }: { children: ReactNode }) {
  const settings = useData(() => getSettings(), [])
  const footer = useData(() => getContent('footer'), [])
  const stats = useData(() => getStats(), [])
  return (
    <SiteContext.Provider
      value={{
        settings: settings.data ?? null,
        footer: footer.data ?? null,
        stats: stats.data ?? null,
        vars: settingsVars(settings.data),
        reloadStats: stats.reload,
      }}
    >
      {children}
    </SiteContext.Provider>
  )
}

export const useSite = () => useContext(SiteContext)
