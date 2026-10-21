// Accès aux données du back-office. Toutes les opérations sont vérifiées
// côté base de données (RLS + fonctions SQL) : l'interface ne fait que
// les appeler.
import { supabase, MEDIA_BUCKET } from './supabase'
import { unwrap } from './errors'
import type {
  AdminUser,
  AuditEntry,
  BLEvent,
  CompetitionSettings,
  ContentKey,
  ContentMap,
  EliteChallenge,
  EventParticipant,
  Pilot,
  PilotRank,
  PointAdjustment,
  RankHistoryEntry,
  Result,
  ResultOutcome,
  Season,
  SeasonStatus,
  SiteContentRow,
  StageEntry,
} from './types'

// ---------------------------------------------------------------------
//  Pilotes
// ---------------------------------------------------------------------
export async function listPilots(): Promise<Pilot[]> {
  return (unwrap(await supabase.from('pilots').select('*').order('pseudonym')) ?? []) as Pilot[]
}

export type PilotInput = Pick<Pilot, 'pseudonym' | 'tag' | 'vehicle' | 'bio' | 'status'>

export async function createPilot(input: PilotInput): Promise<Pilot> {
  return unwrap(await supabase.from('pilots').insert(input).select().single()) as Pilot
}

export async function updatePilot(id: string, patch: Partial<PilotInput>): Promise<Pilot> {
  return unwrap(await supabase.from('pilots').update(patch).eq('id', id).select().single()) as Pilot
}

export async function deletePilot(id: string): Promise<void> {
  unwrap(await supabase.from('pilots').delete().eq('id', id))
}

export async function setPilotRank(id: string, rank: PilotRank, reason: string): Promise<void> {
  unwrap(await supabase.rpc('set_pilot_rank', { p_pilot: id, p_rank: rank, p_reason: reason }))
}

export async function getPilotNotes(id: string): Promise<string> {
  const row = unwrap(await supabase.from('pilot_notes').select('notes').eq('pilot_id', id).maybeSingle()) as { notes: string } | null
  return row?.notes ?? ''
}

export async function savePilotNotes(id: string, notes: string): Promise<void> {
  unwrap(await supabase.from('pilot_notes').upsert({ pilot_id: id, notes }))
}

export async function getRankHistory(pilotId: string): Promise<RankHistoryEntry[]> {
  return (unwrap(
    await supabase.from('rank_history').select('*').eq('pilot_id', pilotId).order('changed_at', { ascending: false }),
  ) ?? []) as RankHistoryEntry[]
}

export async function getPilotResults(pilotId: string): Promise<(Result & { events: Pick<BLEvent, 'name' | 'kind' | 'starts_at' | 'season_id' | 'status'> | null })[]> {
  return (unwrap(
    await supabase.from('results').select('*, events(name, kind, starts_at, season_id, status)').eq('pilot_id', pilotId),
  ) ?? []) as unknown as (Result & { events: Pick<BLEvent, 'name' | 'kind' | 'starts_at' | 'season_id' | 'status'> | null })[]
}

// ---------------------------------------------------------------------
//  Corrections de points
// ---------------------------------------------------------------------
export async function listAdjustments(filter: { pilotId?: string; seasonId?: string } = {}): Promise<PointAdjustment[]> {
  let q = supabase.from('point_adjustments').select('*').order('created_at', { ascending: false })
  if (filter.pilotId) q = q.eq('pilot_id', filter.pilotId)
  if (filter.seasonId) q = q.eq('season_id', filter.seasonId)
  return (unwrap(await q) ?? []) as PointAdjustment[]
}

export async function addAdjustment(input: { season_id: string; pilot_id: string; event_id?: string | null; delta: number; reason: string }): Promise<void> {
  unwrap(await supabase.from('point_adjustments').insert(input))
}

export async function deleteAdjustment(id: string): Promise<void> {
  unwrap(await supabase.from('point_adjustments').delete().eq('id', id))
}

// ---------------------------------------------------------------------
//  Saisons
// ---------------------------------------------------------------------
export async function listSeasons(): Promise<Season[]> {
  return (unwrap(await supabase.from('seasons').select('*').order('created_at', { ascending: false })) ?? []) as Season[]
}

export type SeasonInput = Pick<Season, 'name' | 'starts_on' | 'ends_on' | 'scale_id' | 'notes'>

export async function createSeason(input: SeasonInput): Promise<Season> {
  return unwrap(await supabase.from('seasons').insert({ ...input, status: 'draft' }).select().single()) as Season
}

export async function updateSeason(id: string, patch: Partial<SeasonInput>): Promise<void> {
  unwrap(await supabase.from('seasons').update(patch).eq('id', id))
}

export async function setSeasonStatus(id: string, status: SeasonStatus): Promise<void> {
  unwrap(await supabase.rpc('set_season_status', { p_season: id, p_status: status }))
}

export async function deleteSeason(id: string): Promise<void> {
  unwrap(await supabase.from('seasons').delete().eq('id', id))
}

// ---------------------------------------------------------------------
//  Événements
// ---------------------------------------------------------------------
export async function listEvents(): Promise<BLEvent[]> {
  return (unwrap(
    await supabase.from('events').select('*').order('starts_at', { ascending: false, nullsFirst: true }),
  ) ?? []) as BLEvent[]
}

export async function getEventAdmin(id: string): Promise<BLEvent | null> {
  return unwrap(await supabase.from('events').select('*').eq('id', id).maybeSingle()) as BLEvent | null
}

export type EventInput = Omit<BLEvent, 'id' | 'created_at' | 'updated_at' | 'is_demo'>

export async function createEvent(input: Partial<EventInput>): Promise<BLEvent> {
  return unwrap(await supabase.from('events').insert(input).select().single()) as BLEvent
}

export async function updateEvent(id: string, patch: Partial<EventInput>): Promise<BLEvent> {
  return unwrap(await supabase.from('events').update(patch).eq('id', id).select().single()) as BLEvent
}

export async function deleteEvent(id: string): Promise<void> {
  unwrap(await supabase.from('events').delete().eq('id', id))
}

export async function getEventNotes(id: string): Promise<string> {
  const row = unwrap(await supabase.from('event_internal_notes').select('notes').eq('event_id', id).maybeSingle()) as { notes: string } | null
  return row?.notes ?? ''
}

export async function saveEventNotes(id: string, notes: string): Promise<void> {
  unwrap(await supabase.from('event_internal_notes').upsert({ event_id: id, notes }))
}

export async function listParticipants(eventId: string): Promise<EventParticipant[]> {
  return (unwrap(await supabase.from('event_participants').select('*').eq('event_id', eventId).order('created_at')) ?? []) as EventParticipant[]
}

export async function addParticipant(eventId: string, pilotId: string): Promise<void> {
  unwrap(await supabase.from('event_participants').upsert({ event_id: eventId, pilot_id: pilotId, status: 'registered' }))
}

export async function setParticipantStatus(eventId: string, pilotId: string, status: EventParticipant['status']): Promise<void> {
  unwrap(await supabase.from('event_participants').update({ status }).eq('event_id', eventId).eq('pilot_id', pilotId))
}

export async function removeParticipant(eventId: string, pilotId: string): Promise<void> {
  unwrap(await supabase.from('event_participants').delete().eq('event_id', eventId).eq('pilot_id', pilotId))
}

// ---------------------------------------------------------------------
//  Résultats
// ---------------------------------------------------------------------
export async function listResults(eventId: string): Promise<Result[]> {
  return (unwrap(await supabase.from('results').select('*').eq('event_id', eventId)) ?? []) as Result[]
}

export async function listAllResults(): Promise<Result[]> {
  return (unwrap(await supabase.from('results').select('*')) ?? []) as Result[]
}

export interface ResultRowInput {
  pilot_id: string
  outcome: ResultOutcome
  position: number | null
  adjustment: number
  adjustment_reason: string | null
  checkpoint_ok: boolean | null
  time_label: string | null
  note: string | null
}

export async function saveResults(eventId: string, rows: ResultRowInput[], complete: boolean): Promise<void> {
  unwrap(await supabase.rpc('save_event_results', { p_event: eventId, p_rows: rows, p_complete: complete }))
}

export async function clearResults(eventId: string): Promise<void> {
  unwrap(await supabase.rpc('clear_event_results', { p_event: eventId }))
}

export async function recalculatePoints(seasonId: string | null): Promise<number> {
  return unwrap(await supabase.rpc('recalculate_points', { p_season: seasonId })) as number
}

// ---------------------------------------------------------------------
//  Phases
// ---------------------------------------------------------------------
export async function listStageEntries(seasonId: string): Promise<(StageEntry & { tiebreak_note: string | null })[]> {
  const rows = (unwrap(
    await supabase.from('stage_entries').select('*, pilots(pseudonym, tag, rank)').eq('season_id', seasonId),
  ) ?? []) as unknown as (Omit<StageEntry, 'pseudonym' | 'tag' | 'rank'> & {
    tiebreak_note: string | null
    pilots: { pseudonym: string; tag: string | null; rank: PilotRank } | null
  })[]
  return rows.map(({ pilots, ...r }) => ({ ...r, pseudonym: pilots?.pseudonym ?? '?', tag: pilots?.tag ?? null, rank: pilots?.rank ?? 'prospect' }))
}

export async function confirmQualifiers(eventId: string, pilots: string[], note: string): Promise<void> {
  unwrap(await supabase.rpc('confirm_session_qualifiers', { p_event: eventId, p_pilots: pilots, p_note: note || null }))
}
export async function revertQualifiers(eventId: string): Promise<void> {
  unwrap(await supabase.rpc('revert_session_qualifiers', { p_event: eventId }))
}
export async function assignGroups(seasonId: string, assignments: { pilot_id: string; group_label: string }[]): Promise<void> {
  unwrap(await supabase.rpc('assign_elite_groups', { p_season: seasonId, p_assignments: assignments }))
}
export async function resetGroups(seasonId: string): Promise<void> {
  unwrap(await supabase.rpc('reset_elite_groups', { p_season: seasonId }))
}
export async function confirmFinalists(seasonId: string, group: string, pilots: string[], note: string): Promise<void> {
  unwrap(await supabase.rpc('confirm_finalists', { p_season: seasonId, p_group: group, p_pilots: pilots, p_note: note || null }))
}
export async function revertFinalists(seasonId: string, group: string): Promise<void> {
  unwrap(await supabase.rpc('revert_finalists', { p_season: seasonId, p_group: group }))
}
export async function confirmElite(seasonId: string, pilots: string[], note: string, demotePrevious: boolean): Promise<void> {
  unwrap(
    await supabase.rpc('confirm_season_elite', { p_season: seasonId, p_pilots: pilots, p_note: note || null, p_demote_previous: demotePrevious }),
  )
}
export async function revertElite(seasonId: string): Promise<void> {
  unwrap(await supabase.rpc('revert_season_elite', { p_season: seasonId }))
}

// ---------------------------------------------------------------------
//  Challenges Elite
// ---------------------------------------------------------------------
export async function listChallenges(): Promise<EliteChallenge[]> {
  return (unwrap(await supabase.from('elite_challenges').select('*').order('created_at', { ascending: false })) ?? []) as EliteChallenge[]
}

export async function createChallenge(input: { challenger_id: string; elite_id: string; request_note: string | null }): Promise<void> {
  unwrap(await supabase.from('elite_challenges').insert(input))
}

export async function updateChallenge(
  id: string,
  patch: Partial<Pick<EliteChallenge, 'status' | 'scheduled_at' | 'location_rp' | 'format' | 'request_note' | 'refusal_reason'>>,
): Promise<void> {
  unwrap(await supabase.from('elite_challenges').update(patch).eq('id', id))
}

export async function resolveChallenge(id: string, winnerId: string, note: string): Promise<void> {
  unwrap(await supabase.rpc('resolve_challenge', { p_challenge: id, p_winner: winnerId, p_note: note || null }))
}

export async function declineChallenge(id: string, reason: string, forfeit: boolean): Promise<void> {
  unwrap(await supabase.rpc('decline_challenge', { p_challenge: id, p_reason: reason, p_forfeit: forfeit }))
}

export async function deleteChallenge(id: string): Promise<void> {
  unwrap(await supabase.from('elite_challenges').delete().eq('id', id))
}

// ---------------------------------------------------------------------
//  Contenus
// ---------------------------------------------------------------------
export async function getContentRow<K extends ContentKey>(key: K): Promise<SiteContentRow<K>> {
  return unwrap(await supabase.from('site_content').select('*').eq('key', key).single()) as SiteContentRow<K>
}

export async function saveDraft<K extends ContentKey>(key: K, draft: ContentMap[K]): Promise<void> {
  unwrap(await supabase.from('site_content').update({ draft }).eq('key', key))
}

export async function publishContent(key: ContentKey): Promise<void> {
  unwrap(await supabase.rpc('publish_content', { p_key: key }))
}

export async function discardDraft(key: ContentKey): Promise<void> {
  unwrap(await supabase.rpc('discard_content_draft', { p_key: key }))
}

/** Envoie une image dans le stockage public et renvoie son URL */
export async function uploadImage(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) throw new Error('Format accepté : JPEG, PNG, WebP ou AVIF.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Image trop lourde (5 Mo maximum).')
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `site/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type })
  if (error) throw error
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
}

// ---------------------------------------------------------------------
//  Paramètres et barèmes
// ---------------------------------------------------------------------
export async function updateSettings(patch: Partial<Omit<CompetitionSettings, 'id' | 'updated_at'>>): Promise<void> {
  unwrap(await supabase.from('competition_settings').update(patch).eq('id', 1))
}

export async function createScale(name: string, description: string, entries: { position: number; points: number }[]): Promise<string> {
  const scale = unwrap(await supabase.from('point_scales').insert({ name, description: description || null }).select('id').single()) as { id: string }
  if (entries.length) unwrap(await supabase.from('point_scale_entries').insert(entries.map((e) => ({ ...e, scale_id: scale.id }))))
  return scale.id
}

/** Remplace les lignes d'un barème (les points sont recalculés automatiquement en base) */
export async function saveScale(id: string, patch: { name: string; description: string }, entries: { position: number; points: number }[]): Promise<void> {
  unwrap(await supabase.from('point_scales').update({ name: patch.name, description: patch.description || null }).eq('id', id))
  const positions = entries.map((e) => e.position)
  if (positions.length) {
    unwrap(await supabase.from('point_scale_entries').delete().eq('scale_id', id).not('position', 'in', `(${positions.join(',')})`))
    unwrap(await supabase.from('point_scale_entries').upsert(entries.map((e) => ({ ...e, scale_id: id }))))
  } else {
    unwrap(await supabase.from('point_scale_entries').delete().eq('scale_id', id))
  }
}

export async function setDefaultScale(id: string): Promise<void> {
  unwrap(await supabase.from('point_scales').update({ is_default: false }).eq('is_default', true).neq('id', id))
  unwrap(await supabase.from('point_scales').update({ is_default: true }).eq('id', id))
}

export async function deleteScale(id: string): Promise<void> {
  unwrap(await supabase.from('point_scales').delete().eq('id', id))
}

// ---------------------------------------------------------------------
//  Administrateurs, journal, export
// ---------------------------------------------------------------------
export async function listAdmins(): Promise<AdminUser[]> {
  return (unwrap(await supabase.from('admin_users').select('*').order('created_at')) ?? []) as AdminUser[]
}

export async function updateAdmin(userId: string, patch: Partial<Pick<AdminUser, 'display_name' | 'role' | 'active'>>): Promise<void> {
  unwrap(await supabase.from('admin_users').update(patch).eq('user_id', userId))
}

export async function removeAdmin(userId: string): Promise<void> {
  unwrap(await supabase.from('admin_users').delete().eq('user_id', userId))
}

/** Invitation d'un organisateur via la fonction serveur Netlify (clé service_role côté serveur uniquement) */
export async function inviteAdmin(input: { email: string; display_name: string; role: string }): Promise<{ invited: boolean; existing: boolean }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Session expirée : reconnectez-vous.')
  let res: Response
  try {
    res = await fetch('/.netlify/functions/admin-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    })
  } catch {
    throw new Error('Fonction d’invitation injoignable. Elle n’est disponible qu’une fois le site déployé sur Netlify (ou via « netlify dev »).')
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string; invited?: boolean; existing?: boolean }
  if (res.status === 404) throw new Error('Fonction d’invitation introuvable : vérifiez le déploiement Netlify.')
  if (!res.ok) throw new Error(body.error || `Invitation impossible (erreur ${res.status}).`)
  return { invited: Boolean(body.invited), existing: Boolean(body.existing) }
}

export async function listAudit(opts: { limit: number; offset: number; entity?: string; action?: string }): Promise<{ rows: AuditEntry[]; total: number }> {
  let q = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('at', { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1)
  if (opts.entity) q = q.eq('entity', opts.entity)
  if (opts.action) q = q.ilike('action', `${opts.action}%`)
  const { data, error, count } = await q
  if (error) throw error
  return { rows: (data ?? []) as AuditEntry[], total: count ?? 0 }
}

export async function exportAll(): Promise<unknown> {
  return unwrap(await supabase.rpc('admin_export'))
}

export async function purgeDemo(): Promise<{ pilots: number; events: number; seasons: number }> {
  return unwrap(await supabase.rpc('purge_demo_data')) as { pilots: number; events: number; seasons: number }
}
