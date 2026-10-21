// Types du domaine Blacklane — miroir du schéma SQL (supabase/migrations)

export type AdminRole = 'owner' | 'admin' | 'editor'
export type PilotRank = 'prospect' | 'runner' | 'challenger' | 'elite'
export type PilotStatus = 'active' | 'inactive' | 'archived' | 'banned'
export type SeasonStatus = 'draft' | 'active' | 'closed'
export type EventKind = 'qualification' | 'urban_run' | 'navigation' | 'finale' | 'challenge' | 'exhibition'
export type EventPhase = 'qualifications' | 'elite' | 'finale' | 'challenge' | 'hors_saison'
export type EventStatus =
  | 'registration_open'
  | 'scheduled'
  | 'full'
  | 'postponed'
  | 'cancelled'
  | 'in_progress'
  | 'completed'
export type ResultOutcome = 'finished' | 'dnf' | 'dsq' | 'dns'
export type ParticipantStatus = 'registered' | 'confirmed' | 'withdrawn'
export type Stage = 'runner' | 'challenger' | 'elite'
export type ChallengeStatus = 'pending' | 'accepted' | 'refused' | 'scheduled' | 'completed' | 'cancelled'
export type ChallengeOutcome = 'challenger_won' | 'elite_defended' | 'forfeit'
export type GroupLabel = 'A' | 'B' | 'C' | 'D'

export interface AdminProfile {
  user_id: string
  display_name: string
  role: AdminRole
  level: number
}

export interface AdminUser {
  user_id: string
  display_name: string
  role: AdminRole
  active: boolean
  created_at: string
}

export interface CompetitionSettings {
  id: number
  sessions_count: number
  max_pilots_per_session: number
  qualifiers_per_session: number
  elite_group_count: number
  elite_group_size: number
  finalists_per_group: number
  elite_count: number
  challenge_cooldown_days: number
  challenge_format: string
  tiebreak_policy: 'manual' | 'best_finish_then_manual'
  updated_at: string
}

export interface ScaleEntry {
  position: number
  points: number
}

export interface PointScale {
  id: string
  name: string
  description: string | null
  is_default: boolean
  entries: ScaleEntry[]
}

export interface Season {
  id: string
  name: string
  starts_on: string | null
  ends_on: string | null
  status: SeasonStatus
  scale_id: string | null
  notes?: string | null
  is_demo: boolean
  created_at: string
  closed_at: string | null
}

export interface Pilot {
  id: string
  pseudonym: string
  tag: string | null
  rank: PilotRank
  status: PilotStatus
  vehicle: string | null
  bio: string | null
  is_demo: boolean
  created_at: string
  archived_at: string | null
}

export interface BLEvent {
  id: string
  season_id: string | null
  name: string
  description: string | null
  kind: EventKind
  phase: EventPhase
  session_number: number | null
  group_label: GroupLabel | null
  starts_at: string | null
  location_rp: string | null
  participation_info: string | null
  capacity: number | null
  status: EventStatus
  status_note: string | null
  postponed_from: string | null
  is_published: boolean
  featured: boolean
  counts_for_standings: boolean
  scale_id: string | null
  is_demo: boolean
  created_at: string
  updated_at: string
}

export interface EventParticipant {
  event_id: string
  pilot_id: string
  status: ParticipantStatus
  created_at: string
}

/** Résultat officiel (table results, lecture admin) */
export interface Result {
  event_id: string
  pilot_id: string
  outcome: ResultOutcome
  position: number | null
  base_points: number
  adjustment: number
  adjustment_reason: string | null
  points: number
  checkpoint_ok: boolean | null
  time_label: string | null
  note: string | null
}

/** Ligne de la vue publique v_event_rankings */
export interface EventRanking {
  event_id: string
  season_id: string | null
  event_name: string
  kind: EventKind
  phase: EventPhase
  session_number: number | null
  group_label: GroupLabel | null
  starts_at: string | null
  pilot_id: string
  pseudonym: string
  tag: string | null
  pilot_rank: PilotRank
  outcome: ResultOutcome
  position: number | null
  base_points: number
  adjustment: number
  points: number
  checkpoint_ok: boolean | null
  time_label: string | null
  pilot_is_demo: boolean
}

/** Ligne de la vue v_season_standings */
export interface Standing {
  season_id: string
  season_name: string
  season_status: SeasonStatus
  pilot_id: string
  pseudonym: string
  tag: string | null
  rank: PilotRank
  pilot_status: PilotStatus
  is_demo: boolean
  races: number
  wins: number
  podiums: number
  points: number
  adjustments: number
  best_position: number | null
  podium_rate: number | null
  position: number
}

export interface StageEntry {
  season_id: string
  pilot_id: string
  pseudonym: string
  tag: string | null
  rank: PilotRank
  stage: Stage
  group_label: GroupLabel | null
  source_event_id: string | null
  source: 'competition' | 'challenge' | 'manual'
  decided_at: string
}

/** Classement d'une session, d'un groupe ou de la finale (fonctions *_ranking) */
export interface StageRankingRow {
  pilot_id: string
  pseudonym: string
  tag: string | null
  points: number
  events_count: number
  best_position: number | null
  wins: number
  points_by_event: Record<string, number>
  tie_rank: number
}

export interface PublicChallenge {
  id: string
  season_id: string | null
  status: ChallengeStatus
  scheduled_at: string | null
  format: string | null
  outcome: ChallengeOutcome | null
  updated_at: string
  challenger_id: string
  challenger_pseudonym: string
  elite_id: string
  elite_pseudonym: string
  winner_id: string | null
  winner_pseudonym: string | null
}

export interface EliteChallenge {
  id: string
  season_id: string | null
  challenger_id: string
  elite_id: string
  status: ChallengeStatus
  request_note: string | null
  scheduled_at: string | null
  location_rp: string | null
  format: string | null
  winner_id: string | null
  outcome: ChallengeOutcome | null
  refusal_reason: string | null
  result_note: string | null
  cooldown_until: string | null
  is_demo: boolean
  created_at: string
  updated_at: string
}

export interface PointAdjustment {
  id: string
  season_id: string
  pilot_id: string
  event_id: string | null
  delta: number
  reason: string
  created_by: string | null
  created_at: string
}

export interface RankHistoryEntry {
  id: number
  pilot_id: string
  season_id: string | null
  from_rank: PilotRank | null
  to_rank: PilotRank
  source: string
  reason: string | null
  changed_by: string | null
  changed_at: string
}

export interface AuditEntry {
  id: number
  at: string
  actor: string | null
  actor_name: string | null
  action: string
  entity: string
  entity_id: string | null
  details: unknown
}

export interface PublicStats {
  races_completed: number
  pilots_participated: number
  pilots_ranked: number
  upcoming_events: number
  active_season: { id: string; name: string } | null
  has_demo: boolean
}

// ---------------------------------------------------------------------
//  Contenus éditables (site_content)
// ---------------------------------------------------------------------

export interface CtaLink {
  label: string
  href: string | null
}

export interface HomeContent {
  announcement: { enabled: boolean; tone: 'info' | 'alert'; text: string; link_label: string; link_href: string }
  hero: {
    kicker: string
    title_left: string
    title_right: string
    tagline_1: string
    tagline_2: string
    motto: string
    image_url: string | null
    image_alt: string
    primary_cta: CtaLink
    secondary_cta: CtaLink
  }
  stats: {
    enabled: boolean
    title: string
    items: Record<'races_completed' | 'pilots_participated' | 'pilots_ranked' | 'upcoming_events', { enabled: boolean; label: string }>
  }
  standings: { enabled: boolean; title: string; subtitle: string; limit: number }
  upcoming: { enabled: boolean; title: string; limit: number; featured_only: boolean }
  phases: {
    enabled: boolean
    title: string
    intro: string
    items: { key: PilotRank; name: string; description: string }[]
    cta_label: string
  }
  organizers: {
    enabled: boolean
    title: string
    people: { alias: string; roles: string; verbs: string }[]
    quote: string
  }
  results: { enabled: boolean; title: string; limit: number }
  rules: { enabled: boolean; title: string; items: { title: string; text: string }[]; cta_label: string }
  closing: { enabled: boolean; line_1: string; line_2: string }
}

export interface RulesContent {
  intro: string
  sections: { id: string; title: string; body: string }[]
  sanctions: { id: string; infraction: string; sanction: string }[]
}

export interface QualificationsContent {
  intro: string
  phase1: { title: string; text: string; summary: string }
  phase2: { title: string; text: string }
  urban_run: { title: string; text: string }
  navigation: { title: string; text: string }
  finale: { title: string; text: string }
  tiebreak: { title: string; text: string }
  challenge: { title: string; text: string; steps: string[]; win: string; lose: string }
  calendar: { title: string; items: { label: string; text: string }[] }
}

export interface FooterContent {
  tagline: string
  subline: string
  disclaimer: string
  legal: string
  privacy: string
}

export interface ContentMap {
  home: HomeContent
  rules: RulesContent
  qualifications: QualificationsContent
  footer: FooterContent
}
export type ContentKey = keyof ContentMap

export interface SiteContentRow<K extends ContentKey = ContentKey> {
  key: K
  draft: ContentMap[K]
  published: ContentMap[K] | null
  draft_updated_at: string
  published_at: string | null
}
