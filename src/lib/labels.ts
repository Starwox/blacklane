import type {
  AdminRole,
  ChallengeOutcome,
  ChallengeStatus,
  EventKind,
  EventPhase,
  EventStatus,
  ParticipantStatus,
  PilotRank,
  PilotStatus,
  ResultOutcome,
  SeasonStatus,
  Stage,
} from './types'

export const RANK_LABEL: Record<PilotRank, string> = {
  prospect: 'Prospect',
  runner: 'Runner',
  challenger: 'Challenger',
  elite: 'Elite',
}
export const RANKS: PilotRank[] = ['prospect', 'runner', 'challenger', 'elite']

export const PILOT_STATUS_LABEL: Record<PilotStatus, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  archived: 'Archivé',
  banned: 'Exclu',
}

export const KIND_LABEL: Record<EventKind, string> = {
  qualification: 'Qualification',
  urban_run: 'Urban Run',
  navigation: 'Navigation',
  finale: 'Finale',
  challenge: 'Challenge Elite',
  exhibition: 'Exhibition',
}
export const KINDS: EventKind[] = ['qualification', 'urban_run', 'navigation', 'finale', 'exhibition']

/** Phase imposée par le type d'épreuve (contrainte events_kind_phase) */
export const PHASE_FOR_KIND: Record<EventKind, EventPhase> = {
  qualification: 'qualifications',
  urban_run: 'elite',
  navigation: 'elite',
  finale: 'finale',
  challenge: 'challenge',
  exhibition: 'hors_saison',
}

export const PHASE_LABEL: Record<EventPhase, string> = {
  qualifications: 'Phase 1 — Qualifications',
  elite: 'Phase 2 — Élite',
  finale: 'Finale',
  challenge: 'Challenge Elite',
  hors_saison: 'Hors saison',
}
export const PHASE_SHORT: Record<EventPhase, string> = {
  qualifications: 'Qualifications',
  elite: 'Élite',
  finale: 'Finale',
  challenge: 'Challenge',
  hors_saison: 'Hors saison',
}
export const PHASES: EventPhase[] = ['qualifications', 'elite', 'finale', 'hors_saison']

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  registration_open: 'Inscriptions ouvertes',
  scheduled: 'Programmé',
  full: 'Complet',
  postponed: 'Reporté',
  cancelled: 'Annulé',
  in_progress: 'En cours',
  completed: 'Terminé',
}
export const EVENT_STATUSES: EventStatus[] = [
  'registration_open',
  'scheduled',
  'full',
  'postponed',
  'cancelled',
  'in_progress',
  'completed',
]

export const OUTCOME_LABEL: Record<ResultOutcome, string> = {
  finished: 'Classé',
  dnf: 'Abandon',
  dsq: 'Disqualifié',
  dns: 'Absent',
}
export const OUTCOME_SHORT: Record<ResultOutcome, string> = {
  finished: '',
  dnf: 'ABD',
  dsq: 'DSQ',
  dns: 'ABS',
}

export const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  registered: 'Inscrit',
  confirmed: 'Confirmé',
  withdrawn: 'Retiré',
}

export const SEASON_STATUS_LABEL: Record<SeasonStatus, string> = {
  draft: 'Brouillon',
  active: 'En cours',
  closed: 'Clôturée',
}

export const STAGE_LABEL: Record<Stage, string> = {
  runner: 'Qualifié (Runner)',
  challenger: 'Finaliste (Challenger)',
  elite: 'Elite',
}

export const CHALLENGE_STATUS_LABEL: Record<ChallengeStatus, string> = {
  pending: 'En attente',
  accepted: 'Accepté',
  refused: 'Refusé',
  scheduled: 'Programmé',
  completed: 'Terminé',
  cancelled: 'Annulé',
}

export const CHALLENGE_OUTCOME_LABEL: Record<ChallengeOutcome, string> = {
  challenger_won: 'Victoire du challenger',
  elite_defended: "L'Elite conserve sa place",
  forfeit: 'Forfait de l’Elite',
}

export const ROLE_LABEL: Record<AdminRole, string> = {
  owner: 'Owner',
  admin: 'Administrateur',
  editor: 'Éditeur',
}
export const ROLE_DESCRIPTION: Record<AdminRole, string> = {
  owner: 'Tous les droits, dont la gestion des comptes et la purge des données.',
  admin: 'Résultats, phases, barèmes, saisons, Challenges Elite et corrections de points.',
  editor: 'Contenus du site, pilotes et calendrier (sans saisie de résultats).',
}
export const ROLE_LEVEL: Record<AdminRole, number> = { owner: 3, admin: 2, editor: 1 }

export type Tone = 'neutral' | 'red' | 'bone' | 'muted' | 'success' | 'warning'

export const EVENT_STATUS_TONE: Record<EventStatus, Tone> = {
  registration_open: 'red',
  scheduled: 'bone',
  full: 'muted',
  postponed: 'warning',
  cancelled: 'muted',
  in_progress: 'red',
  completed: 'neutral',
}

export const CHALLENGE_STATUS_TONE: Record<ChallengeStatus, Tone> = {
  pending: 'warning',
  accepted: 'bone',
  refused: 'muted',
  scheduled: 'red',
  completed: 'neutral',
  cancelled: 'muted',
}
