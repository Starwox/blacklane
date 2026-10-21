// Traduction des erreurs Supabase / PostgreSQL en messages lisibles

interface ErrorLike {
  message?: string
  code?: string
  details?: string | null
  hint?: string | null
  status?: number
}

const CONSTRAINT_MESSAGES: [RegExp, string][] = [
  [/pilots_pseudonym_ci/, 'Ce pseudonyme est déjà utilisé par un autre pilote.'],
  [/pilots_tag_unique/, 'Cette plaque est déjà attribuée à un autre pilote.'],
  [/pilots_tag_check/, 'Plaque invalide : lettres majuscules, chiffres et tirets uniquement (12 caractères max.).'],
  [/pilots_pseudonym_check/, 'Pseudonyme invalide : 2 à 32 caractères, sans < ni >.'],
  [/seasons_single_active/, 'Une autre saison est déjà active.'],
  [/seasons_name_key/, 'Une saison porte déjà ce nom.'],
  [/point_scales_name_key/, 'Un barème porte déjà ce nom.'],
  [/point_scales_single_default/, 'Un seul barème peut être défini par défaut.'],
  [/events_kind_phase/, 'Le type d’épreuve ne correspond pas à la phase choisie.'],
  [/events_session_required/, 'Une session de qualification doit avoir un numéro de session.'],
  [/events_group_required/, 'Une épreuve Urban Run ou Navigation doit être associée à un groupe.'],
  [/events_season_required/, 'Cette épreuve doit être rattachée à une saison.'],
  [/point_adjustments_reason_check/, 'La justification doit contenir au moins 5 caractères.'],
  [/point_adjustments_delta_check/, 'La correction doit être comprise entre -500 et +500 points (et non nulle).'],
  [/results_adjustment_reason/, 'Toute pénalité ou bonification doit être justifiée.'],
  [/results_unique_position/, 'Deux pilotes ne peuvent pas occuper la même position.'],
  [/admin_users_display_name_check/, 'Le nom affiché doit contenir 2 à 40 caractères.'],
  [/competition_settings_check/, 'Paramètres incohérents (ex. plus de qualifiés que de pilotes par session).'],
]

export function errorMessage(err: unknown): string {
  if (!err) return 'Erreur inconnue.'
  if (typeof err === 'string') return err
  const e = err as ErrorLike
  const raw = [e.message, e.details].filter(Boolean).join(' ')

  for (const [re, msg] of CONSTRAINT_MESSAGES) if (re.test(raw)) return msg

  switch (e.code) {
    case '42501':
      return e.message?.startsWith('Accès refusé') || e.message?.startsWith('Seul')
        ? e.message
        : 'Action non autorisée pour votre compte.'
    case 'P0001':
    case 'P0002':
    case '22023':
      return e.message ?? 'Opération refusée.'
    case '23503':
      return 'Cet élément est utilisé ailleurs (résultats, épreuves…) : archivez-le plutôt que de le supprimer.'
    case '23505':
      return 'Cet élément existe déjà.'
    case '23514':
      return 'Une valeur saisie ne respecte pas les règles de validation.'
    case 'PGRST116':
      return 'Élément introuvable.'
    case 'PGRST301':
    case 'PGRST303':
      return 'Session expirée : reconnectez-vous.'
  }
  if (/row-level security/i.test(raw)) return 'Action non autorisée pour votre compte.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) return 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.'
  if (/Invalid login credentials/i.test(raw)) return 'Identifiants incorrects.'
  if (/Email not confirmed/i.test(raw)) return 'Adresse e-mail non confirmée.'
  if (/rate limit|too many/i.test(raw)) return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.'
  return e.message || 'Une erreur est survenue.'
}

/** Lève l'erreur Supabase éventuelle, sinon renvoie les données */
export function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}
