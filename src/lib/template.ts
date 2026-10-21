import type { CompetitionSettings } from './types'

export type TemplateVars = Record<string, string | number>

/** Variables disponibles dans les textes éditables, calculées depuis les paramètres */
export function settingsVars(s: CompetitionSettings | null | undefined): TemplateVars {
  if (!s) return {}
  return {
    sessions_count: s.sessions_count,
    max_pilots_per_session: s.max_pilots_per_session,
    qualifiers_per_session: s.qualifiers_per_session,
    total_qualified: s.sessions_count * s.qualifiers_per_session,
    elite_group_count: s.elite_group_count,
    elite_group_size: s.elite_group_size,
    finalists_per_group: s.finalists_per_group,
    finalists_total: s.elite_group_count * s.finalists_per_group,
    elite_count: s.elite_count,
    challenge_cooldown_days: s.challenge_cooldown_days,
    challenge_format: s.challenge_format,
  }
}

export const TEMPLATE_VARIABLES: { key: string; description: string }[] = [
  { key: 'sessions_count', description: 'Nombre de sessions de qualification' },
  { key: 'max_pilots_per_session', description: 'Pilotes maximum par session' },
  { key: 'qualifiers_per_session', description: 'Qualifiés par session' },
  { key: 'total_qualified', description: 'Total des qualifiés (sessions × qualifiés)' },
  { key: 'elite_group_count', description: 'Nombre de groupes Élite' },
  { key: 'elite_group_size', description: 'Pilotes par groupe Élite' },
  { key: 'finalists_per_group', description: 'Finalistes par groupe' },
  { key: 'finalists_total', description: 'Nombre total de finalistes' },
  { key: 'elite_count', description: 'Nombre de pilotes Elite' },
  { key: 'challenge_cooldown_days', description: 'Délai après un Challenge perdu (jours)' },
  { key: 'challenge_format', description: 'Format du duel Challenge Elite' },
]

/** Remplace {variable} par sa valeur ; laisse intactes les variables inconnues */
export function fillTemplate(text: string | null | undefined, vars: TemplateVars): string {
  if (!text) return ''
  return text.replace(/\{([a-z_]+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match))
}
