-- =====================================================================
--  BLACKLANE — Sécurité
--  Migration 3/4 : Row Level Security, privilèges, stockage des visuels.
--
--  Principe :
--   * lecture publique (anon) limitée aux données publiables ;
--   * toute écriture exige un compte présent dans admin_users ;
--   * les résultats, qualifications et issues de défis ne s'écrivent
--     qu'au travers des fonctions RPC, qui valident le règlement ;
--   * les fonctions d'administration ne sont pas exécutables par anon.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Activation de RLS sur toutes les tables
-- ---------------------------------------------------------------------
alter table public.admin_users           enable row level security;
alter table public.competition_settings  enable row level security;
alter table public.point_scales          enable row level security;
alter table public.point_scale_entries   enable row level security;
alter table public.seasons               enable row level security;
alter table public.pilots                enable row level security;
alter table public.pilot_notes           enable row level security;
alter table public.events                enable row level security;
alter table public.event_internal_notes  enable row level security;
alter table public.event_participants    enable row level security;
alter table public.results               enable row level security;
alter table public.point_adjustments     enable row level security;
alter table public.stage_entries         enable row level security;
alter table public.rank_history          enable row level security;
alter table public.elite_challenges      enable row level security;
alter table public.site_content          enable row level security;
alter table public.audit_log             enable row level security;

-- ---------------------------------------------------------------------
--  Administrateurs
-- ---------------------------------------------------------------------
create policy admin_users_select on public.admin_users
  for select to authenticated using (public.is_admin() or user_id = auth.uid());
create policy admin_users_insert on public.admin_users
  for insert to authenticated with check (public.is_admin('owner'));
create policy admin_users_update on public.admin_users
  for update to authenticated using (public.is_admin('owner')) with check (public.is_admin('owner'));
create policy admin_users_delete on public.admin_users
  for delete to authenticated using (public.is_admin('owner') and user_id <> auth.uid());

-- ---------------------------------------------------------------------
--  Paramètres et barèmes : lecture publique, écriture admin
-- ---------------------------------------------------------------------
create policy settings_read on public.competition_settings for select to anon, authenticated using (true);
create policy settings_write on public.competition_settings
  for update to authenticated using (public.is_admin('admin')) with check (public.is_admin('admin'));

create policy scales_read on public.point_scales for select to anon, authenticated using (true);
create policy scales_insert on public.point_scales for insert to authenticated with check (public.is_admin('admin'));
create policy scales_update on public.point_scales for update to authenticated using (public.is_admin('admin')) with check (public.is_admin('admin'));
create policy scales_delete on public.point_scales for delete to authenticated using (public.is_admin('admin'));

create policy scale_entries_read on public.point_scale_entries for select to anon, authenticated using (true);
create policy scale_entries_insert on public.point_scale_entries for insert to authenticated with check (public.is_admin('admin'));
create policy scale_entries_update on public.point_scale_entries for update to authenticated using (public.is_admin('admin')) with check (public.is_admin('admin'));
create policy scale_entries_delete on public.point_scale_entries for delete to authenticated using (public.is_admin('admin'));

-- ---------------------------------------------------------------------
--  Saisons
-- ---------------------------------------------------------------------
create policy seasons_read on public.seasons
  for select to anon, authenticated using (status <> 'draft' or public.is_admin());
create policy seasons_insert on public.seasons
  for insert to authenticated with check (public.is_admin('admin') and status = 'draft');
create policy seasons_update on public.seasons
  for update to authenticated using (public.is_admin('admin')) with check (public.is_admin('admin'));
create policy seasons_delete on public.seasons
  for delete to authenticated using (public.is_admin('owner'));

-- Le statut d'une saison ne change que via set_season_status()
create or replace function public.bl_seasons_status_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status is distinct from new.status
     and coalesce(current_setting('blacklane.via_rpc', true), '') <> 'on'
     and not public.bl_is_system() then
    raise exception 'Utilisez les actions « Activer » / « Clôturer » pour changer le statut d''une saison.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger seasons_status_guard before update of status on public.seasons
  for each row execute function public.bl_seasons_status_guard();

-- ---------------------------------------------------------------------
--  Pilotes
-- ---------------------------------------------------------------------
create policy pilots_read on public.pilots
  for select to anon, authenticated using (status <> 'banned' or public.is_admin());
create policy pilots_insert on public.pilots
  for insert to authenticated with check (public.is_admin('editor'));
create policy pilots_update on public.pilots
  for update to authenticated using (public.is_admin('editor')) with check (public.is_admin('editor'));
create policy pilots_delete on public.pilots
  for delete to authenticated using (public.is_admin('owner'));

-- Le rang ne peut être modifié directement que par un admin (via set_pilot_rank, historisé)
create or replace function public.bl_pilots_rank_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.rank is distinct from new.rank and public.admin_level() < 2 then
    raise exception 'Seul un administrateur peut modifier le rang d''un pilote.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger pilots_rank_guard before update of rank on public.pilots
  for each row execute function public.bl_pilots_rank_guard();

create policy pilot_notes_all on public.pilot_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
--  Événements
-- ---------------------------------------------------------------------
create policy events_read on public.events
  for select to anon, authenticated using (is_published or public.is_admin());
create policy events_insert on public.events
  for insert to authenticated with check (public.is_admin('editor'));
create policy events_update on public.events
  for update to authenticated using (public.is_admin('editor')) with check (public.is_admin('editor'));
create policy events_delete on public.events
  for delete to authenticated using (public.is_admin('admin'));

create policy event_notes_all on public.event_internal_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy participants_read on public.event_participants
  for select to anon, authenticated using (
    public.is_admin() or exists (select 1 from public.events e where e.id = event_id and e.is_published));
create policy participants_insert on public.event_participants
  for insert to authenticated with check (public.is_admin('editor'));
create policy participants_update on public.event_participants
  for update to authenticated using (public.is_admin('editor')) with check (public.is_admin('editor'));
create policy participants_delete on public.event_participants
  for delete to authenticated using (public.is_admin('editor'));

-- ---------------------------------------------------------------------
--  Résultats, progression : lecture admin (le public passe par les vues),
--  écriture uniquement via les fonctions RPC.
-- ---------------------------------------------------------------------
create policy results_read on public.results for select to authenticated using (public.is_admin());
create policy stage_entries_read on public.stage_entries for select to authenticated using (public.is_admin());
create policy rank_history_read on public.rank_history for select to authenticated using (public.is_admin());

create policy adjustments_read on public.point_adjustments for select to authenticated using (public.is_admin());
create policy adjustments_insert on public.point_adjustments for insert to authenticated with check (public.is_admin('admin'));
create policy adjustments_delete on public.point_adjustments for delete to authenticated using (public.is_admin('admin'));

-- ---------------------------------------------------------------------
--  Challenges Elite
-- ---------------------------------------------------------------------
create policy challenges_read on public.elite_challenges for select to authenticated using (public.is_admin());
create policy challenges_insert on public.elite_challenges for insert to authenticated with check (public.is_admin('admin'));
create policy challenges_update on public.elite_challenges
  for update to authenticated using (public.is_admin('admin')) with check (public.is_admin('admin'));
create policy challenges_delete on public.elite_challenges for delete to authenticated using (public.is_admin('owner'));

-- ---------------------------------------------------------------------
--  Contenus éditables (le public lit la vue v_site_content)
-- ---------------------------------------------------------------------
create policy content_read on public.site_content for select to authenticated using (public.is_admin());
create policy content_update on public.site_content
  for update to authenticated using (public.is_admin('editor')) with check (public.is_admin('editor'));

-- ---------------------------------------------------------------------
--  Journal d'audit : lecture admin, aucune écriture directe
-- ---------------------------------------------------------------------
create policy audit_read on public.audit_log for select to authenticated using (public.is_admin('admin'));

-- =====================================================================
--  Privilèges
-- =====================================================================
revoke all on all tables in schema public from anon;
grant select on public.competition_settings, public.point_scales, public.point_scale_entries,
                public.seasons, public.pilots, public.events, public.event_participants
  to anon;
grant select on public.v_event_rankings, public.v_season_standings, public.v_stage_entries,
                public.v_public_challenges, public.v_site_content, public.v_scales
  to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
-- Le journal n'est jamais modifiable depuis l'API
revoke insert, update, delete on public.audit_log from authenticated;
revoke insert, update, delete on public.results, public.stage_entries, public.rank_history from authenticated;
-- Les vues sont en lecture seule
revoke insert, update, delete on public.v_event_rankings, public.v_season_standings, public.v_stage_entries,
                                 public.v_public_challenges, public.v_site_content, public.v_scales
  from authenticated;

-- Fonctions : tout révoquer, puis ouvrir explicitement
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.public_stats() to anon, authenticated;
grant execute on function public.session_ranking(uuid) to anon, authenticated;
grant execute on function public.group_ranking(uuid, text) to anon, authenticated;
grant execute on function public.finale_ranking(uuid) to anon, authenticated;
-- utilitaires appelés par les politiques RLS / vues
grant execute on function public.is_admin(text), public.admin_level(), public.bl_role_level(text),
                          public.bl_is_system()
  to anon, authenticated;

grant execute on function
  public.my_admin_profile(),
  public.set_pilot_rank(uuid, text, text),
  public.save_event_results(uuid, jsonb, boolean),
  public.clear_event_results(uuid),
  public.recalculate_points(uuid),
  public.confirm_session_qualifiers(uuid, uuid[], text),
  public.revert_session_qualifiers(uuid),
  public.assign_elite_groups(uuid, jsonb),
  public.reset_elite_groups(uuid),
  public.confirm_finalists(uuid, text, uuid[], text),
  public.revert_finalists(uuid, text),
  public.confirm_season_elite(uuid, uuid[], text, boolean),
  public.revert_season_elite(uuid),
  public.resolve_challenge(uuid, uuid, text),
  public.decline_challenge(uuid, text, boolean),
  public.publish_content(text),
  public.discard_content_draft(text),
  public.set_season_status(uuid, text),
  public.admin_export(),
  public.purge_demo_data()
  to authenticated;

-- Les futures fonctions ne sont pas exécutables par défaut par anon
alter default privileges in schema public revoke execute on functions from public, anon;

-- =====================================================================
--  Stockage des visuels (bucket public « media »)
--  Lecture publique des images ; envoi / suppression réservés aux admins.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy media_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin('editor'));
create policy media_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin('editor'))
  with check (bucket_id = 'media' and public.is_admin('editor'));
create policy media_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin('editor'));
