// Accès aux données publiques (lecture seule, clé anon + RLS)
import { supabase } from './supabase'
import { unwrap } from './errors'
import type {
  BLEvent,
  CompetitionSettings,
  ContentKey,
  ContentMap,
  EventRanking,
  Pilot,
  PilotRank,
  PointScale,
  PublicChallenge,
  PublicStats,
  Season,
  StageEntry,
  StageRankingRow,
  Standing,
} from './types'

export async function getStats(): Promise<PublicStats> {
  return unwrap(await supabase.rpc('public_stats')) as PublicStats
}

export async function getSettings(): Promise<CompetitionSettings> {
  return unwrap(await supabase.from('competition_settings').select('*').eq('id', 1).single()) as CompetitionSettings
}

export async function getScales(): Promise<PointScale[]> {
  return (unwrap(await supabase.from('v_scales').select('*').order('name')) ?? []) as PointScale[]
}

export async function getContent<K extends ContentKey>(key: K): Promise<ContentMap[K] | null> {
  const row = unwrap(await supabase.from('v_site_content').select('content').eq('key', key).maybeSingle()) as {
    content: ContentMap[K]
  } | null
  return row?.content ?? null
}

export async function getSeasons(): Promise<Season[]> {
  return (unwrap(
    await supabase.from('seasons').select('*').order('starts_on', { ascending: false, nullsFirst: false }),
  ) ?? []) as Season[]
}

/** Saison active, sinon la plus récente */
export function pickCurrentSeason(seasons: Season[]): Season | null {
  return seasons.find((s) => s.status === 'active') ?? seasons.find((s) => s.status === 'closed') ?? null
}

export async function getStandings(seasonId: string): Promise<Standing[]> {
  return (unwrap(
    await supabase.from('v_season_standings').select('*').eq('season_id', seasonId).order('position').order('pseudonym'),
  ) ?? []) as Standing[]
}

export async function getPilotStandings(pilotId: string): Promise<Standing[]> {
  return (unwrap(await supabase.from('v_season_standings').select('*').eq('pilot_id', pilotId)) ?? []) as Standing[]
}

export async function getEvents(seasonId?: string | null): Promise<BLEvent[]> {
  let q = supabase.from('events').select('*').order('starts_at', { ascending: true, nullsFirst: false })
  if (seasonId) q = q.eq('season_id', seasonId)
  return (unwrap(await q) ?? []) as BLEvent[]
}

export async function getEvent(id: string): Promise<BLEvent | null> {
  return unwrap(await supabase.from('events').select('*').eq('id', id).maybeSingle()) as BLEvent | null
}

export interface ParticipantWithPilot {
  pilot_id: string
  status: string
  pilots: { pseudonym: string; tag: string | null; rank: PilotRank } | null
}

export async function getParticipants(eventId: string): Promise<ParticipantWithPilot[]> {
  return (unwrap(
    await supabase
      .from('event_participants')
      .select('pilot_id, status, pilots(pseudonym, tag, rank)')
      .eq('event_id', eventId)
      .neq('status', 'withdrawn'),
  ) ?? []) as unknown as ParticipantWithPilot[]
}

export async function getEventRankings(eventIds: string[]): Promise<EventRanking[]> {
  if (!eventIds.length) return []
  return (unwrap(
    await supabase
      .from('v_event_rankings')
      .select('*')
      .in('event_id', eventIds)
      .order('position', { ascending: true, nullsFirst: false }),
  ) ?? []) as EventRanking[]
}

export async function getSeasonRankings(seasonId: string): Promise<EventRanking[]> {
  return (unwrap(await supabase.from('v_event_rankings').select('*').eq('season_id', seasonId)) ?? []) as EventRanking[]
}

export async function getPilotRankings(pilotId: string): Promise<EventRanking[]> {
  return (unwrap(
    await supabase.from('v_event_rankings').select('*').eq('pilot_id', pilotId).order('starts_at', { ascending: false }),
  ) ?? []) as EventRanking[]
}

export async function getPilot(id: string): Promise<Pilot | null> {
  return unwrap(await supabase.from('pilots').select('*').eq('id', id).maybeSingle()) as Pilot | null
}

export async function getStageEntries(seasonId: string): Promise<StageEntry[]> {
  return (unwrap(await supabase.from('v_stage_entries').select('*').eq('season_id', seasonId)) ?? []) as StageEntry[]
}

export async function getPilotStages(pilotId: string): Promise<StageEntry[]> {
  return (unwrap(await supabase.from('v_stage_entries').select('*').eq('pilot_id', pilotId)) ?? []) as StageEntry[]
}

export async function getPublicChallenges(limit = 6): Promise<PublicChallenge[]> {
  return (unwrap(
    await supabase.from('v_public_challenges').select('*').order('updated_at', { ascending: false }).limit(limit),
  ) ?? []) as PublicChallenge[]
}

export async function getSessionRanking(eventId: string): Promise<StageRankingRow[]> {
  return (unwrap(await supabase.rpc('session_ranking', { p_event: eventId })) ?? []) as StageRankingRow[]
}

export async function getGroupRanking(seasonId: string, group: string): Promise<StageRankingRow[]> {
  return (unwrap(await supabase.rpc('group_ranking', { p_season: seasonId, p_group: group })) ?? []) as StageRankingRow[]
}

export async function getFinaleRanking(seasonId: string): Promise<StageRankingRow[]> {
  return (unwrap(await supabase.rpc('finale_ranking', { p_season: seasonId })) ?? []) as StageRankingRow[]
}

/** Dernières épreuves terminées avec leur podium */
export async function getLatestResults(limit: number): Promise<{ event: BLEvent; podium: EventRanking[] }[]> {
  const events = (unwrap(
    await supabase
      .from('events')
      .select('*')
      .eq('status', 'completed')
      .neq('kind', 'challenge')
      .order('starts_at', { ascending: false, nullsFirst: false })
      .limit(limit),
  ) ?? []) as BLEvent[]
  const rankings = await getEventRankings(events.map((e) => e.id))
  return events.map((event) => ({
    event,
    podium: rankings
      .filter((r) => r.event_id === event.id && r.position != null && r.position <= 3)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
  }))
}

/** Événements à venir (non terminés, non annulés) */
export function upcomingEvents(events: BLEvent[], now = Date.now()): BLEvent[] {
  const horizon = now - 6 * 3600 * 1000
  return events
    .filter((e) => !['completed', 'cancelled'].includes(e.status))
    .filter((e) => !e.starts_at || new Date(e.starts_at).getTime() >= horizon)
    .sort((a, b) => (a.starts_at ?? '9999').localeCompare(b.starts_at ?? '9999'))
}
