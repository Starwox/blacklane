-- =====================================================================
--  BLACKLANE — Logique métier
--  Migration 2/4 : fonctions utilitaires, déclencheurs, calcul des points,
--  vues publiques et procédures (RPC) du back-office.
--  Toutes les fonctions SECURITY DEFINER fixent search_path = '' et
--  vérifient explicitement le rôle de l'appelant.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Rôles et autorisations
-- ---------------------------------------------------------------------
create or replace function public.bl_role_level(p_role text)
returns int language sql immutable set search_path = '' as $$
  select case p_role when 'owner' then 3 when 'admin' then 2 when 'editor' then 1 else 0 end
$$;

create or replace function public.bl_rank_level(p_rank text)
returns int language sql immutable set search_path = '' as $$
  select case p_rank when 'elite' then 3 when 'challenger' then 2 when 'runner' then 1 else 0 end
$$;

-- Vrai lorsqu'aucun JWT n'est présent et que l'appel ne provient pas des
-- rôles API (anon / authenticated) : éditeur SQL Supabase, migrations,
-- connexion directe à la base. Ces contextes exigent déjà les identifiants
-- de la base de données.
create or replace function public.bl_is_system()
returns boolean language sql stable set search_path = '' as $$
  select auth.uid() is null
     and coalesce(nullif(current_setting('role', true), ''), 'none') not in ('anon', 'authenticated')
     and coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'role' is distinct from 'anon'
$$;

create or replace function public.admin_level()
returns int language sql stable security definer set search_path = '' as $$
  select case
    when public.bl_is_system() then 3
    else coalesce((select public.bl_role_level(a.role)
                   from public.admin_users a
                   where a.user_id = auth.uid() and a.active), 0)
  end
$$;

create or replace function public.is_admin(p_min_role text default 'editor')
returns boolean language sql stable security definer set search_path = '' as $$
  select public.admin_level() >= greatest(public.bl_role_level(p_min_role), 1)
$$;

create or replace function public.bl_require(p_min_role text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin(p_min_role) then
    raise exception 'Accès refusé : rôle « % » requis.', p_min_role using errcode = '42501';
  end if;
end $$;

create or replace function public.bl_actor_name()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select a.display_name from public.admin_users a where a.user_id = auth.uid()),
    case when public.bl_is_system() then 'Système' else 'Inconnu' end)
$$;

create or replace function public.bl_log(p_action text, p_entity text, p_entity_id text, p_details jsonb default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor, actor_name, action, entity, entity_id, details)
  values (auth.uid(), public.bl_actor_name(), p_action, p_entity, p_entity_id, p_details)
$$;

create or replace function public.bl_settings()
returns public.competition_settings language sql stable security definer set search_path = '' as $$
  select * from public.competition_settings where id = 1
$$;

-- Informations de session sur l'administrateur connecté (pour l'interface)
create or replace function public.my_admin_profile()
returns table (user_id uuid, display_name text, role text, level int)
language sql stable security definer set search_path = '' as $$
  select a.user_id, a.display_name, a.role, public.bl_role_level(a.role)
  from public.admin_users a
  where a.user_id = auth.uid() and a.active
$$;

-- ---------------------------------------------------------------------
--  Déclencheurs génériques
-- ---------------------------------------------------------------------
create or replace function public.bl_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Journal d'audit générique (insert / update / delete)
create or replace function public.bl_audit_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_id text;
  v_details jsonb;
  v_ignored text[] := array['updated_at', 'draft', 'draft_updated_at', 'published'];
begin
  if current_setting('blacklane.skip_audit', true) = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;

  v_id := coalesce(
    v_new ->> 'id', v_old ->> 'id',
    v_new ->> 'user_id', v_old ->> 'user_id',
    v_new ->> 'key', v_old ->> 'key',
    concat_ws(':',
      coalesce(v_new ->> 'event_id', v_old ->> 'event_id', v_new ->> 'season_id', v_old ->> 'season_id', v_new ->> 'scale_id', v_old ->> 'scale_id'),
      coalesce(v_new ->> 'pilot_id', v_old ->> 'pilot_id', v_new ->> 'position', v_old ->> 'position'),
      coalesce(v_new ->> 'stage', v_old ->> 'stage')));

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(t.k, jsonb_build_array(v_old -> t.k, v_new -> t.k))
      into v_details
      from jsonb_object_keys(v_new) as t(k)
     where not (t.k = any (v_ignored))
       and (v_old -> t.k) is distinct from (v_new -> t.k);
    if v_details is null then
      return new;
    end if;
  elsif tg_op = 'INSERT' then
    v_details := v_new - v_ignored;
  else
    v_details := v_old - v_ignored;
  end if;

  insert into public.audit_log (actor, actor_name, action, entity, entity_id, details)
  values (auth.uid(), public.bl_actor_name(), lower(tg_op), tg_table_name, v_id, v_details);
  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------------------
--  Saisons clôturées : données figées
-- ---------------------------------------------------------------------
create or replace function public.bl_season_is_closed(p_season uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select s.status = 'closed' from public.seasons s where s.id = p_season), false)
     and coalesce(current_setting('blacklane.purge', true), '') <> 'on'
$$;

-- ---------------------------------------------------------------------
--  Calcul des points d'un résultat
-- ---------------------------------------------------------------------
create or replace function public.bl_effective_scale(p_event uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(e.scale_id, s.scale_id, (select ps.id from public.point_scales ps where ps.is_default))
  from public.events e
  left join public.seasons s on s.id = e.season_id
  where e.id = p_event
$$;

create or replace function public.bl_results_compute()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_kind text;
  v_season uuid;
  v_scale uuid;
begin
  select e.kind, e.season_id into v_kind, v_season from public.events e where e.id = new.event_id;

  if public.bl_season_is_closed(v_season) then
    raise exception 'La saison de cet événement est clôturée : ses résultats sont figés.' using errcode = 'P0001';
  end if;

  if v_kind = 'navigation' and new.outcome = 'finished' and coalesce(new.checkpoint_ok, false) = false then
    raise exception 'Navigation : un pilote classé doit avoir franchi le checkpoint obligatoire. Sans validation du checkpoint, il doit être disqualifié.'
      using errcode = 'P0001';
  end if;

  if new.outcome <> 'finished' or v_kind = 'challenge' then
    new.base_points := 0;
  else
    v_scale := public.bl_effective_scale(new.event_id);
    new.base_points := coalesce(
      (select pse.points from public.point_scale_entries pse
        where pse.scale_id = v_scale and pse.position = new.position), 0);
  end if;

  if new.adjustment = 0 then
    new.adjustment_reason := null;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.bl_results_guard_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.bl_season_is_closed((select e.season_id from public.events e where e.id = old.event_id)) then
    raise exception 'La saison de cet événement est clôturée : ses résultats sont figés.' using errcode = 'P0001';
  end if;
  return old;
end $$;

-- Recalcule les points de tous les résultats des saisons non clôturées
-- (ou d'une saison / d'un événement précis). Idempotent.
create or replace function public.bl_recalc(p_season uuid default null, p_event uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  update public.results r
     set updated_at = now()
    from public.events e
    left join public.seasons s on s.id = e.season_id
   where r.event_id = e.id
     and coalesce(s.status, 'active') <> 'closed'
     and (p_season is null or e.season_id = p_season)
     and (p_event is null or e.id = p_event);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.bl_on_scale_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.bl_recalc();
  return null;
end $$;

create or replace function public.bl_on_event_scale_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.bl_recalc(null, new.id);
  return null;
end $$;

create or replace function public.bl_on_season_scale_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'closed' then
    perform public.bl_recalc(new.id, null);
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------
--  Garde-fous sur les événements
-- ---------------------------------------------------------------------
create or replace function public.bl_events_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if public.bl_season_is_closed(new.season_id) then
      raise exception 'Impossible d''ajouter un événement à une saison clôturée.' using errcode = 'P0001';
    end if;
    if new.status = 'completed' and public.admin_level() < 2 then
      raise exception 'Seul un administrateur peut marquer une course comme terminée.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  if public.bl_season_is_closed(old.season_id) or public.bl_season_is_closed(new.season_id) then
    raise exception 'La saison de cet événement est clôturée : l''événement ne peut plus être modifié.' using errcode = 'P0001';
  end if;
  if old.status is distinct from new.status
     and 'completed' in (old.status, new.status)
     and public.admin_level() < 2 then
    raise exception 'Seul un administrateur peut terminer ou rouvrir une course.' using errcode = '42501';
  end if;
  if (old.kind, old.season_id) is distinct from (new.kind, new.season_id)
     and exists (select 1 from public.results r where r.event_id = old.id) then
    raise exception 'Le type ou la saison d''un événement ne peut pas changer une fois des résultats saisis.' using errcode = 'P0001';
  end if;
  if new.status = 'postponed' and old.status <> 'postponed' and new.postponed_from is null then
    new.postponed_from := old.starts_at;
  end if;
  return new;
end $$;

create or replace function public.bl_events_guard_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('blacklane.purge', true), '') = 'on' then
    return old;
  end if;
  if exists (select 1 from public.results r where r.event_id = old.id) then
    raise exception 'Cet événement possède des résultats officiels : annulez-le plutôt, ou supprimez d''abord ses résultats.' using errcode = 'P0001';
  end if;
  if public.bl_season_is_closed(old.season_id) then
    raise exception 'La saison de cet événement est clôturée.' using errcode = 'P0001';
  end if;
  return old;
end $$;

-- ---------------------------------------------------------------------
--  Participants : capacité et éligibilité
-- ---------------------------------------------------------------------
create or replace function public.bl_participants_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  v_limit int;
  v_count int;
  v_pilot_status text;
  st public.competition_settings := public.bl_settings();
begin
  if new.status = 'withdrawn' then
    return new;
  end if;
  select * into e from public.events where id = new.event_id;
  select p.status into v_pilot_status from public.pilots p where p.id = new.pilot_id;

  if v_pilot_status in ('archived', 'banned') then
    raise exception 'Ce pilote est archivé ou exclu : il ne peut pas participer.' using errcode = 'P0001';
  end if;

  if e.kind = 'qualification' and exists (
      select 1 from public.stage_entries se
       where se.season_id = e.season_id and se.pilot_id = new.pilot_id and se.stage = 'runner'
         and se.source_event_id is distinct from e.id) then
    raise exception 'Ce pilote est déjà qualifié pour la phase Élite cette saison.' using errcode = 'P0001';
  end if;

  if e.kind in ('urban_run', 'navigation') and not exists (
      select 1 from public.stage_entries se
       where se.season_id = e.season_id and se.pilot_id = new.pilot_id
         and se.stage = 'runner' and se.group_label = e.group_label) then
    raise exception 'Seuls les pilotes qualifiés du groupe % peuvent participer à cette épreuve.', e.group_label using errcode = 'P0001';
  end if;

  if e.kind = 'finale' and not exists (
      select 1 from public.stage_entries se
       where se.season_id = e.season_id and se.pilot_id = new.pilot_id and se.stage = 'challenger') then
    raise exception 'Seuls les finalistes de la saison peuvent participer à la finale.' using errcode = 'P0001';
  end if;

  v_limit := e.capacity;
  if e.kind = 'qualification' then
    v_limit := least(coalesce(v_limit, st.max_pilots_per_session), st.max_pilots_per_session);
  end if;
  if v_limit is not null then
    select count(*) into v_count
      from public.event_participants ep
     where ep.event_id = new.event_id and ep.pilot_id <> new.pilot_id and ep.status <> 'withdrawn';
    if v_count >= v_limit then
      raise exception 'Capacité atteinte : % pilotes maximum pour cet événement.', v_limit using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
--  Pilotes : historique des rangs, archivage
-- ---------------------------------------------------------------------
create or replace function public.bl_pilots_before()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.pseudonym := trim(new.pseudonym);
  if tg_op = 'UPDATE' and new.status = 'archived' and old.status <> 'archived' then
    new.archived_at := now();
  elsif new.status <> 'archived' then
    new.archived_at := null;
  end if;
  return new;
end $$;

create or replace function public.bl_pilots_rank_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or old.rank is distinct from new.rank then
    insert into public.rank_history (pilot_id, season_id, from_rank, to_rank, source, reason, changed_by)
    values (
      new.id,
      nullif(current_setting('blacklane.season', true), '')::uuid,
      case when tg_op = 'UPDATE' then old.rank end,
      new.rank,
      coalesce(nullif(current_setting('blacklane.rank_source', true), ''), case when tg_op = 'INSERT' then 'creation' else 'manual' end),
      nullif(current_setting('blacklane.rank_reason', true), ''),
      auth.uid());
  end if;
  return null;
end $$;

-- Applique un changement de rang en renseignant le contexte d'historique
create or replace function public.bl_set_rank_context(p_source text, p_reason text, p_season uuid)
returns void language sql set search_path = '' as $$
  select set_config('blacklane.rank_source', coalesce(p_source, ''), true),
         set_config('blacklane.rank_reason', coalesce(p_reason, ''), true),
         set_config('blacklane.season', coalesce(p_season::text, ''), true);
$$;

-- Modification manuelle du rang avec justification (historisée)
create or replace function public.set_pilot_rank(p_pilot uuid, p_rank text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.bl_require('admin');
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Une justification est requise pour modifier un rang.' using errcode = 'P0001';
  end if;
  perform public.bl_set_rank_context('manual', p_reason,
    (select s.id from public.seasons s where s.status = 'active'));
  update public.pilots set rank = p_rank where id = p_pilot;
  if not found then
    raise exception 'Pilote introuvable.' using errcode = 'P0002';
  end if;
end $$;

-- ---------------------------------------------------------------------
--  Challenges Elite : validations
-- ---------------------------------------------------------------------
create or replace function public.bl_challenges_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_until timestamptz;
  st public.competition_settings := public.bl_settings();
begin
  if tg_op = 'INSERT' then
    if (select p.rank from public.pilots p where p.id = new.elite_id) is distinct from 'elite' then
      raise exception 'Le pilote défié doit être un pilote Elite.' using errcode = 'P0001';
    end if;
    if (select p.rank from public.pilots p where p.id = new.challenger_id) = 'elite' then
      raise exception 'Un pilote Elite ne peut pas lancer de défi contre un autre Elite.' using errcode = 'P0001';
    end if;
    if (select p.status from public.pilots p where p.id = new.challenger_id) <> 'active' then
      raise exception 'Seul un pilote actif peut lancer un défi.' using errcode = 'P0001';
    end if;
    select max(c.cooldown_until) into v_until
      from public.elite_challenges c
     where c.challenger_id = new.challenger_id and c.cooldown_until > now();
    if v_until is not null then
      raise exception 'Ce pilote doit attendre le % avant de lancer un nouveau défi.', to_char(v_until at time zone 'Europe/Paris', 'DD/MM/YYYY') using errcode = 'P0001';
    end if;
    if exists (select 1 from public.elite_challenges c
                where c.challenger_id = new.challenger_id and c.status in ('pending', 'accepted', 'scheduled')) then
      raise exception 'Ce pilote a déjà un défi en cours.' using errcode = 'P0001';
    end if;
    new.status := 'pending';
    new.outcome := null;
    new.winner_id := null;
    new.format := coalesce(nullif(trim(new.format), ''), st.challenge_format);
    new.season_id := coalesce(new.season_id, (select s.id from public.seasons s where s.status = 'active'));
    return new;
  end if;

  -- UPDATE
  if coalesce(current_setting('blacklane.via_rpc', true), '') <> 'on' then
    if old.status = 'completed' then
      raise exception 'Ce défi est terminé : son résultat ne peut plus être modifié.' using errcode = 'P0001';
    end if;
    if new.status = 'completed' or new.outcome is not null or new.winner_id is not null then
      raise exception 'Utilisez l''action « Enregistrer le résultat » pour terminer un défi.' using errcode = 'P0001';
    end if;
    if (new.challenger_id, new.elite_id) is distinct from (old.challenger_id, old.elite_id) then
      raise exception 'Les pilotes d''un défi ne peuvent pas être modifiés. Créez un nouveau défi.' using errcode = 'P0001';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
--  Administrateurs : toujours au moins un owner actif
-- ---------------------------------------------------------------------
create or replace function public.bl_admin_users_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admin_users a where a.role = 'owner' and a.active) then
    raise exception 'Il doit toujours rester au moins un compte « owner » actif.' using errcode = 'P0001';
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------
--  Contenus : la version publiée ne change que via publish_content()
-- ---------------------------------------------------------------------
create or replace function public.bl_site_content_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.published is distinct from old.published
     and coalesce(current_setting('blacklane.via_rpc', true), '') <> 'on' then
    raise exception 'Utilisez « Publier » pour mettre en ligne un contenu.' using errcode = 'P0001';
  end if;
  if new.draft is distinct from old.draft then
    new.draft_updated_at := now();
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
--  Garde-fou des corrections de points
-- ---------------------------------------------------------------------
create or replace function public.bl_adjustments_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.bl_season_is_closed(coalesce(new.season_id, old.season_id)) then
    raise exception 'La saison est clôturée : les points sont figés.' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    return new;
  end if;
  return old;
end $$;

-- =====================================================================
--  Branchement des déclencheurs
-- =====================================================================
create trigger admin_users_touch before update on public.admin_users for each row execute function public.bl_touch_updated_at();
create trigger point_scales_touch before update on public.point_scales for each row execute function public.bl_touch_updated_at();
create trigger seasons_touch before update on public.seasons for each row execute function public.bl_touch_updated_at();
create trigger pilots_touch before update on public.pilots for each row execute function public.bl_touch_updated_at();
create trigger events_touch before update on public.events for each row execute function public.bl_touch_updated_at();
create trigger settings_touch before update on public.competition_settings for each row execute function public.bl_touch_updated_at();
create trigger pilot_notes_touch before update on public.pilot_notes for each row execute function public.bl_touch_updated_at();
create trigger event_notes_touch before update on public.event_internal_notes for each row execute function public.bl_touch_updated_at();

create trigger results_compute before insert or update on public.results for each row execute function public.bl_results_compute();
create trigger results_guard_delete before delete on public.results for each row execute function public.bl_results_guard_delete();

create trigger scale_entries_recalc after insert or update or delete on public.point_scale_entries for each statement execute function public.bl_on_scale_change();
create trigger scale_default_recalc after update of is_default on public.point_scales for each statement execute function public.bl_on_scale_change();
create trigger events_scale_recalc after update of scale_id on public.events for each row when (old.scale_id is distinct from new.scale_id) execute function public.bl_on_event_scale_change();
create trigger seasons_scale_recalc after update of scale_id on public.seasons for each row when (old.scale_id is distinct from new.scale_id) execute function public.bl_on_season_scale_change();

create trigger events_guard before insert or update on public.events for each row execute function public.bl_events_guard();
create trigger events_guard_delete before delete on public.events for each row execute function public.bl_events_guard_delete();

create trigger participants_guard before insert or update on public.event_participants for each row execute function public.bl_participants_guard();

create trigger pilots_before before insert or update on public.pilots for each row execute function public.bl_pilots_before();
create trigger pilots_rank_history after insert or update of rank on public.pilots for each row execute function public.bl_pilots_rank_history();

create trigger challenges_guard before insert or update on public.elite_challenges for each row execute function public.bl_challenges_guard();

create trigger admin_users_guard after update or delete on public.admin_users for each statement execute function public.bl_admin_users_guard();

create trigger site_content_guard before update on public.site_content for each row execute function public.bl_site_content_guard();

create trigger adjustments_guard before insert or delete on public.point_adjustments for each row execute function public.bl_adjustments_guard();

-- Journal d'audit des actions sensibles
create trigger audit_results       after insert or update or delete on public.results              for each row execute function public.bl_audit_trigger();
create trigger audit_adjustments   after insert or update or delete on public.point_adjustments    for each row execute function public.bl_audit_trigger();
create trigger audit_scale_entries after insert or update or delete on public.point_scale_entries  for each row execute function public.bl_audit_trigger();
create trigger audit_scales        after insert or update or delete on public.point_scales         for each row execute function public.bl_audit_trigger();
create trigger audit_settings      after update                     on public.competition_settings for each row execute function public.bl_audit_trigger();
create trigger audit_seasons       after insert or update or delete on public.seasons              for each row execute function public.bl_audit_trigger();
create trigger audit_events        after insert or update or delete on public.events               for each row execute function public.bl_audit_trigger();
create trigger audit_pilots        after insert or update or delete on public.pilots               for each row execute function public.bl_audit_trigger();
create trigger audit_admin_users   after insert or update or delete on public.admin_users          for each row execute function public.bl_audit_trigger();
create trigger audit_stage_entries after insert or update or delete on public.stage_entries        for each row execute function public.bl_audit_trigger();
create trigger audit_challenges    after insert or update or delete on public.elite_challenges     for each row execute function public.bl_audit_trigger();
create trigger audit_site_content  after update of published       on public.site_content          for each row execute function public.bl_audit_trigger();

-- =====================================================================
--  Vues publiques
--  Ces vues s'exécutent avec les droits de leur propriétaire et filtrent
--  explicitement les données publiables : seules les épreuves publiées et
--  terminées sont comptabilisées. Les notes internes et les motifs de
--  correction ne sont jamais exposés.
-- =====================================================================

-- Résultats officiels par épreuve
create view public.v_event_rankings as
select
  r.event_id,
  e.season_id,
  e.name        as event_name,
  e.kind,
  e.phase,
  e.session_number,
  e.group_label,
  e.starts_at,
  r.pilot_id,
  p.pseudonym,
  p.tag,
  p.rank        as pilot_rank,
  r.outcome,
  r.position,
  r.base_points,
  r.adjustment,
  r.points,
  r.checkpoint_ok,
  r.time_label,
  p.is_demo     as pilot_is_demo
from public.results r
join public.events e on e.id = r.event_id
join public.pilots p on p.id = r.pilot_id
where e.is_published and e.status = 'completed' and p.status <> 'banned';

-- Classement général par saison (points officiels + corrections)
create view public.v_season_standings as
with res as (
  select e.season_id, r.pilot_id, r.points, r.position
  from public.results r
  join public.events e on e.id = r.event_id
  where e.is_published and e.status = 'completed' and e.counts_for_standings and e.season_id is not null
),
agg as (
  select season_id, pilot_id,
         count(*)                                as races,
         count(*) filter (where position = 1)    as wins,
         count(*) filter (where position <= 3)   as podiums,
         sum(points)                             as race_points,
         min(position)                           as best_position
  from res group by season_id, pilot_id
),
adj as (
  select season_id, pilot_id, sum(delta) as adjustments
  from public.point_adjustments group by season_id, pilot_id
),
base as (
  select coalesce(a.season_id, j.season_id)                    as season_id,
         coalesce(a.pilot_id, j.pilot_id)                      as pilot_id,
         coalesce(a.races, 0)::int                             as races,
         coalesce(a.wins, 0)::int                              as wins,
         coalesce(a.podiums, 0)::int                           as podiums,
         (coalesce(a.race_points, 0) + coalesce(j.adjustments, 0))::int as points,
         coalesce(j.adjustments, 0)::int                       as adjustments,
         a.best_position
  from agg a
  full join adj j on j.season_id = a.season_id and j.pilot_id = a.pilot_id
)
select
  b.season_id,
  s.name   as season_name,
  s.status as season_status,
  b.pilot_id,
  p.pseudonym,
  p.tag,
  p.rank,
  p.status as pilot_status,
  p.is_demo,
  b.races,
  b.wins,
  b.podiums,
  b.points,
  b.adjustments,
  b.best_position,
  case when b.races > 0 then round(100.0 * b.podiums / b.races, 1) end as podium_rate,
  rank() over (partition by b.season_id order by b.points desc)::int as position
from base b
join public.seasons s on s.id = b.season_id
join public.pilots p on p.id = b.pilot_id
where s.status <> 'draft' and p.status <> 'banned';

-- Progression dans la compétition (pilotes qualifiés, finalistes, Elite)
create view public.v_stage_entries as
select se.season_id, se.pilot_id, p.pseudonym, p.tag, p.rank, se.stage, se.group_label,
       se.source_event_id, se.source, se.decided_at
from public.stage_entries se
join public.pilots p on p.id = se.pilot_id
join public.seasons s on s.id = se.season_id
where s.status <> 'draft' and p.status <> 'banned';

-- Challenges Elite visibles publiquement (programmés ou terminés)
create view public.v_public_challenges as
select c.id, c.season_id, c.status, c.scheduled_at, c.format, c.outcome, c.updated_at,
       c.challenger_id, pc.pseudonym as challenger_pseudonym,
       c.elite_id, pe.pseudonym as elite_pseudonym,
       c.winner_id, pw.pseudonym as winner_pseudonym
from public.elite_challenges c
join public.pilots pc on pc.id = c.challenger_id
join public.pilots pe on pe.id = c.elite_id
left join public.pilots pw on pw.id = c.winner_id
where c.status in ('scheduled', 'completed');

-- Contenus publiés
create view public.v_site_content as
select key, published as content, published_at
from public.site_content
where published is not null;

-- Barème effectif (lecture publique)
create view public.v_scales as
select ps.id, ps.name, ps.description, ps.is_default,
       coalesce(jsonb_agg(jsonb_build_object('position', e.position, 'points', e.points) order by e.position)
                filter (where e.position is not null), '[]'::jsonb) as entries
from public.point_scales ps
left join public.point_scale_entries e on e.scale_id = ps.id
group by ps.id;

-- =====================================================================
--  Fonctions publiques
-- =====================================================================

-- Indicateurs de la page d'accueil : calculés uniquement sur les données enregistrées
create or replace function public.public_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  with active as (select s.id, s.name from public.seasons s where s.status = 'active' limit 1)
  select jsonb_build_object(
    'races_completed', (select count(*) from public.events e
                         where e.is_published and e.status = 'completed' and e.kind <> 'challenge'),
    'pilots_participated', (select count(distinct r.pilot_id) from public.results r
                             join public.events e on e.id = r.event_id
                             join public.pilots p on p.id = r.pilot_id
                            where e.is_published and e.status = 'completed' and p.status <> 'banned'),
    'pilots_ranked', (select count(*) from public.v_season_standings v
                       where v.season_id = (select id from active) and (v.races > 0 or v.points <> 0)),
    'upcoming_events', (select count(*) from public.events e
                         where e.is_published and e.status in ('registration_open', 'scheduled', 'full', 'postponed', 'in_progress')
                           and (e.starts_at is null or e.starts_at >= now() - interval '6 hours')),
    'active_season', (select jsonb_build_object('id', a.id, 'name', a.name) from active a),
    'has_demo', exists (select 1 from public.pilots p where p.is_demo)
             or exists (select 1 from public.events e where e.is_demo and e.is_published)
  )
$$;

-- Classement d'un ensemble d'épreuves. Utilisé pour les sessions de
-- qualification, les groupes Élite et la finale.
--  tie_rank : rang après application de la politique de départage ;
--  deux pilotes avec le même tie_rank sont à égalité réelle.
create or replace function public.bl_rank_events(p_event_ids uuid[], p_pilot_ids uuid[] default null)
returns table (
  pilot_id uuid, pseudonym text, tag text, points int, events_count int,
  best_position int, wins int, points_by_event jsonb, tie_rank int
)
language sql stable security definer set search_path = '' as $$
  with pool as (
    select distinct x.pid as pilot_id
    from (
      select unnest(p_pilot_ids) as pid
      union
      select r.pilot_id from public.results r
       where r.event_id = any (p_event_ids) and p_pilot_ids is null
    ) x
    where x.pid is not null
  ),
  agg as (
    select pl.pilot_id,
           coalesce(sum(r.points), 0)::int                          as points,
           count(r.event_id)::int                                   as events_count,
           min(r.position)                                          as best_position,
           (count(*) filter (where r.position = 1))::int            as wins,
           coalesce(jsonb_object_agg(r.event_id, r.points) filter (where r.event_id is not null), '{}'::jsonb) as points_by_event
    from pool pl
    left join public.results r on r.pilot_id = pl.pilot_id and r.event_id = any (p_event_ids)
    group by pl.pilot_id
  )
  select a.pilot_id, p.pseudonym, p.tag, a.points, a.events_count, a.best_position, a.wins, a.points_by_event,
         case (select st.tiebreak_policy from public.competition_settings st where st.id = 1)
           when 'best_finish_then_manual' then
             (rank() over (order by a.points desc, coalesce(a.best_position, 999) asc))::int
           else (rank() over (order by a.points desc))::int
         end as tie_rank
  from agg a
  join public.pilots p on p.id = a.pilot_id
  order by tie_rank, p.pseudonym
$$;

-- Événements visibles pour l'appelant
create or replace function public.bl_visible_completed_events(p_season uuid, p_kinds text[], p_group text default null, p_event uuid default null)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(e.id), '{}')
  from public.events e
  where e.status = 'completed'
    and (e.is_published or public.is_admin())
    and (p_event is null or e.id = p_event)
    and (p_season is null or e.season_id = p_season)
    and e.kind = any (p_kinds)
    and (p_group is null or e.group_label = p_group)
$$;

-- Classement d'une épreuve unique (session de qualification, épreuve, finale)
create or replace function public.session_ranking(p_event uuid)
returns table (pilot_id uuid, pseudonym text, tag text, points int, events_count int,
               best_position int, wins int, points_by_event jsonb, tie_rank int)
language sql stable security definer set search_path = '' as $$
  select * from public.bl_rank_events(
    public.bl_visible_completed_events(null, array['qualification', 'urban_run', 'navigation', 'finale', 'exhibition'], null, p_event))
$$;

create or replace function public.group_ranking(p_season uuid, p_group text)
returns table (pilot_id uuid, pseudonym text, tag text, points int, events_count int,
               best_position int, wins int, points_by_event jsonb, tie_rank int)
language sql stable security definer set search_path = '' as $$
  select * from public.bl_rank_events(
    public.bl_visible_completed_events(p_season, array['urban_run', 'navigation'], p_group),
    (select coalesce(array_agg(se.pilot_id), '{}') from public.stage_entries se
      where se.season_id = p_season and se.stage = 'runner' and se.group_label = p_group))
$$;

create or replace function public.finale_ranking(p_season uuid)
returns table (pilot_id uuid, pseudonym text, tag text, points int, events_count int,
               best_position int, wins int, points_by_event jsonb, tie_rank int)
language sql stable security definer set search_path = '' as $$
  select * from public.bl_rank_events(
    public.bl_visible_completed_events(p_season, array['finale']),
    (select coalesce(array_agg(se.pilot_id), '{}') from public.stage_entries se
      where se.season_id = p_season and se.stage = 'challenger'))
$$;

-- =====================================================================
--  Validation d'une sélection (qualifiés, finalistes, Elite)
--  Règle : un pilote retenu ne peut jamais être moins bien classé qu'un
--  pilote non retenu. En cas d'égalité à la limite, un départage explicite
--  (motif écrit) est obligatoire : aucune place n'est attribuée au hasard.
-- =====================================================================
create or replace function public.bl_check_selection(p_ranks jsonb, p_selected uuid[], p_n int, p_note text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  v_total int;
  v_n int;
  v_sel_max int;
  v_unsel_min int;
  v_unknown int;
begin
  v_total := jsonb_array_length(p_ranks);
  v_n := least(p_n, v_total);
  if v_n = 0 then
    raise exception 'Aucun pilote classé : impossible de valider la sélection.' using errcode = 'P0001';
  end if;
  if cardinality(p_selected) is distinct from v_n
     or (select count(distinct s) from unnest(p_selected) s) <> v_n then
    raise exception 'Sélectionnez exactement % pilote(s).', v_n using errcode = 'P0001';
  end if;

  select count(*) into v_unknown
    from unnest(p_selected) s
   where not exists (select 1 from jsonb_array_elements(p_ranks) r where (r ->> 'pilot_id')::uuid = s);
  if v_unknown > 0 then
    raise exception 'Un pilote sélectionné ne figure pas dans ce classement.' using errcode = 'P0001';
  end if;

  select max((r ->> 'tie_rank')::int) into v_sel_max
    from jsonb_array_elements(p_ranks) r where (r ->> 'pilot_id')::uuid = any (p_selected);
  select min((r ->> 'tie_rank')::int) into v_unsel_min
    from jsonb_array_elements(p_ranks) r where not ((r ->> 'pilot_id')::uuid = any (p_selected));

  if v_unsel_min is not null and v_sel_max > v_unsel_min then
    raise exception 'Sélection non conforme au règlement : un pilote mieux classé n''est pas retenu.' using errcode = 'P0001';
  end if;
  if v_unsel_min is not null and v_sel_max = v_unsel_min then
    if char_length(trim(coalesce(p_note, ''))) < 5 then
      raise exception 'Égalité à la limite de sélection : un départage explicite est requis (indiquez le motif).' using errcode = 'P0001';
    end if;
    return true;
  end if;
  return false;
end $$;

-- =====================================================================
--  RPC du back-office
-- =====================================================================

-- Enregistre (ou remplace) l'intégralité des résultats d'une épreuve.
-- Idempotent : ré-enregistrer les mêmes résultats ne modifie pas les totaux.
create or replace function public.save_event_results(p_event uuid, p_rows jsonb, p_complete boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  st public.competition_settings := public.bl_settings();
  v_count int;
  v_finished int;
  v_bad int;
  v_limit int;
begin
  perform public.bl_require('admin');

  select * into e from public.events where id = p_event for update;
  if not found then
    raise exception 'Événement introuvable.' using errcode = 'P0002';
  end if;
  if e.status = 'cancelled' then
    raise exception 'Cet événement est annulé : rétablissez son statut avant de saisir des résultats.' using errcode = 'P0001';
  end if;
  if public.bl_season_is_closed(e.season_id) then
    raise exception 'La saison de cet événement est clôturée : ses résultats sont figés.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Format de résultats invalide.' using errcode = '22023';
  end if;

  -- Des sélections ont-elles déjà été validées à partir de ces résultats ?
  if e.kind = 'qualification' and exists (
       select 1 from public.stage_entries se where se.stage = 'runner' and se.source_event_id = e.id) then
    raise exception 'Les qualifiés de cette session sont déjà validés. Annulez d''abord la validation dans « Phases ».' using errcode = 'P0001';
  end if;
  if e.kind in ('urban_run', 'navigation') and exists (
       select 1 from public.stage_entries se
         join public.stage_entries r on r.season_id = se.season_id and r.pilot_id = se.pilot_id and r.stage = 'runner'
        where se.season_id = e.season_id and se.stage = 'challenger' and r.group_label = e.group_label) then
    raise exception 'Les finalistes du groupe % sont déjà validés. Annulez d''abord la validation dans « Phases ».', e.group_label using errcode = 'P0001';
  end if;
  if e.kind = 'finale' and exists (
       select 1 from public.stage_entries se where se.season_id = e.season_id and se.stage = 'elite' and se.source = 'competition') then
    raise exception 'Les pilotes Elite de la saison sont déjà validés. Annulez d''abord la validation dans « Phases ».' using errcode = 'P0001';
  end if;

  drop table if exists pg_temp.bl_rows;
  create temporary table bl_rows on commit drop as
  select x.pilot_id,
         coalesce(nullif(x.outcome, ''), 'finished') as outcome,
         x.position,
         coalesce(x.adjustment, 0) as adjustment,
         nullif(trim(x.adjustment_reason), '') as adjustment_reason,
         x.checkpoint_ok,
         nullif(trim(x.time_label), '') as time_label,
         nullif(trim(x.note), '') as note
  from jsonb_to_recordset(p_rows) as x(
    pilot_id uuid, outcome text, position int, adjustment int, adjustment_reason text,
    checkpoint_ok boolean, time_label text, note text);

  select count(*), count(*) filter (where outcome = 'finished') into v_count, v_finished from bl_rows;

  if exists (select 1 from bl_rows where pilot_id is null) then
    raise exception 'Chaque ligne de résultat doit désigner un pilote.' using errcode = '22023';
  end if;
  if (select count(distinct pilot_id) from bl_rows) <> v_count then
    raise exception 'Un même pilote apparaît plusieurs fois dans les résultats.' using errcode = 'P0001';
  end if;
  if exists (select 1 from bl_rows where outcome not in ('finished', 'dnf', 'dsq', 'dns')) then
    raise exception 'Statut de résultat inconnu.' using errcode = '22023';
  end if;
  if exists (select 1 from bl_rows where (outcome = 'finished') <> (position is not null)) then
    raise exception 'Un pilote classé doit avoir une position ; un pilote non classé (abandon, disqualification, absent) n''en a pas.' using errcode = 'P0001';
  end if;
  -- Positions consécutives 1..n
  if v_finished > 0 and (
       (select count(distinct position) from bl_rows where outcome = 'finished') <> v_finished
    or (select min(position) from bl_rows where outcome = 'finished') <> 1
    or (select max(position) from bl_rows where outcome = 'finished') <> v_finished) then
    raise exception 'Les positions doivent être uniques et consécutives à partir de 1.' using errcode = 'P0001';
  end if;

  v_limit := e.capacity;
  if e.kind = 'qualification' then
    v_limit := least(coalesce(v_limit, st.max_pilots_per_session), st.max_pilots_per_session);
  end if;
  if v_limit is not null and v_count > v_limit then
    raise exception 'Trop de pilotes : % maximum pour cette épreuve.', v_limit using errcode = 'P0001';
  end if;

  select count(*) into v_bad from bl_rows r
   where not exists (select 1 from public.pilots p where p.id = r.pilot_id and p.status <> 'banned');
  if v_bad > 0 then
    raise exception 'Un pilote est introuvable ou exclu.' using errcode = 'P0001';
  end if;

  if e.kind in ('urban_run', 'navigation') then
    select count(*) into v_bad from bl_rows r
     where not exists (select 1 from public.stage_entries se
                        where se.season_id = e.season_id and se.pilot_id = r.pilot_id
                          and se.stage = 'runner' and se.group_label = e.group_label);
    if v_bad > 0 then
      raise exception 'Seuls les pilotes qualifiés du groupe % peuvent figurer dans ces résultats.', e.group_label using errcode = 'P0001';
    end if;
  elsif e.kind = 'finale' then
    select count(*) into v_bad from bl_rows r
     where not exists (select 1 from public.stage_entries se
                        where se.season_id = e.season_id and se.pilot_id = r.pilot_id and se.stage = 'challenger');
    if v_bad > 0 then
      raise exception 'Seuls les finalistes validés peuvent figurer dans les résultats de la finale.' using errcode = 'P0001';
    end if;
  elsif e.kind = 'qualification' then
    select count(*) into v_bad from bl_rows r
     where exists (select 1 from public.stage_entries se
                    where se.season_id = e.season_id and se.pilot_id = r.pilot_id and se.stage = 'runner');
    if v_bad > 0 then
      raise exception 'Un pilote déjà qualifié cette saison ne peut pas courir une nouvelle session de qualification.' using errcode = 'P0001';
    end if;
  end if;

  set constraints public.results_unique_position deferred;

  delete from public.results r
   where r.event_id = p_event
     and not exists (select 1 from bl_rows x where x.pilot_id = r.pilot_id);

  insert into public.results as t (event_id, pilot_id, outcome, position, adjustment, adjustment_reason, checkpoint_ok, time_label, note)
  select p_event, pilot_id, outcome, position, adjustment, adjustment_reason, checkpoint_ok, time_label, note
  from bl_rows
  on conflict (event_id, pilot_id) do update set
    outcome = excluded.outcome,
    position = excluded.position,
    adjustment = excluded.adjustment,
    adjustment_reason = excluded.adjustment_reason,
    checkpoint_ok = excluded.checkpoint_ok,
    time_label = excluded.time_label,
    note = excluded.note;

  set constraints public.results_unique_position immediate;

  -- Les pilotes classés sont inscrits comme participants confirmés
  insert into public.event_participants (event_id, pilot_id, status)
  select p_event, pilot_id, 'confirmed' from bl_rows
  on conflict (event_id, pilot_id) do update set status = 'confirmed';

  if p_complete and e.status <> 'completed' then
    update public.events set status = 'completed' where id = p_event;
  end if;

  perform public.bl_log('results.save', 'events', p_event::text,
    jsonb_build_object('rows', v_count, 'completed', p_complete or e.status = 'completed'));

  return jsonb_build_object('rows', v_count, 'finished', v_finished);
end $$;

-- Supprime tous les résultats d'une épreuve (avec garde-fous)
create or replace function public.clear_event_results(p_event uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.bl_require('admin');
  perform public.save_event_results(p_event, '[]'::jsonb, false);
  update public.events set status = 'scheduled' where id = p_event and status = 'completed';
  perform public.bl_log('results.clear', 'events', p_event::text, null);
end $$;

-- Recalcul manuel des points (après modification d'un barème, par exemple)
create or replace function public.recalculate_points(p_season uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  perform public.bl_require('admin');
  v_count := public.bl_recalc(p_season, null);
  perform public.bl_log('points.recalculate', 'seasons', coalesce(p_season::text, 'toutes'), jsonb_build_object('rows', v_count));
  return v_count;
end $$;

-- ---------------------------------------------------------------------
--  Phase 1 : validation des qualifiés d'une session
-- ---------------------------------------------------------------------
create or replace function public.confirm_session_qualifiers(p_event uuid, p_pilots uuid[], p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  st public.competition_settings := public.bl_settings();
  v_ranks jsonb;
  v_tie boolean;
begin
  perform public.bl_require('admin');
  select * into e from public.events where id = p_event for update;
  if not found or e.kind <> 'qualification' then
    raise exception 'Session de qualification introuvable.' using errcode = 'P0002';
  end if;
  if e.status <> 'completed' then
    raise exception 'La session doit être terminée avant de valider ses qualifiés.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.stage_entries se
              where se.season_id = e.season_id and se.stage = 'runner' and se.group_label is not null) then
    raise exception 'Les groupes de la phase Élite sont déjà constitués. Réinitialisez-les avant de modifier les qualifiés.' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('pilot_id', r.pilot_id, 'tie_rank', r.tie_rank)), '[]')
    into v_ranks from public.bl_rank_events(array[p_event]) r;
  v_tie := public.bl_check_selection(v_ranks, p_pilots, st.qualifiers_per_session, p_note);

  if exists (select 1 from public.stage_entries se
              where se.season_id = e.season_id and se.stage = 'runner'
                and se.pilot_id = any (p_pilots) and se.source_event_id is distinct from e.id) then
    raise exception 'Un pilote sélectionné est déjà qualifié via une autre session.' using errcode = 'P0001';
  end if;

  perform public.bl_set_rank_context('qualification', 'Annulation de qualification — ' || e.name, e.season_id);
  update public.pilots p set rank = 'prospect'
   where p.rank = 'runner'
     and p.id in (select se.pilot_id from public.stage_entries se where se.stage = 'runner' and se.source_event_id = e.id)
     and not (p.id = any (p_pilots));
  delete from public.stage_entries se where se.stage = 'runner' and se.source_event_id = e.id;

  insert into public.stage_entries (season_id, pilot_id, stage, source_event_id, source, tiebreak_note)
  select e.season_id, unnest(p_pilots), 'runner', e.id, 'competition', case when v_tie then trim(p_note) end;

  perform public.bl_set_rank_context('qualification', 'Qualifié — ' || e.name, e.season_id);
  update public.pilots set rank = 'runner'
   where id = any (p_pilots) and public.bl_rank_level(rank) < 1;

  perform public.bl_log('stage.confirm_qualifiers', 'events', e.id::text,
    jsonb_build_object('pilots', to_jsonb(p_pilots), 'tiebreak', v_tie, 'note', p_note));
end $$;

create or replace function public.revert_session_qualifiers(p_event uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
begin
  perform public.bl_require('admin');
  select * into e from public.events where id = p_event;
  if exists (select 1 from public.stage_entries se
              where se.season_id = e.season_id and se.stage = 'runner' and se.group_label is not null) then
    raise exception 'Les groupes de la phase Élite sont déjà constitués. Réinitialisez-les d''abord.' using errcode = 'P0001';
  end if;
  perform public.bl_set_rank_context('qualification', 'Annulation de qualification — ' || e.name, e.season_id);
  update public.pilots p set rank = 'prospect'
   where p.rank = 'runner'
     and p.id in (select se.pilot_id from public.stage_entries se where se.stage = 'runner' and se.source_event_id = e.id);
  delete from public.stage_entries se where se.stage = 'runner' and se.source_event_id = e.id;
  perform public.bl_log('stage.revert_qualifiers', 'events', e.id::text, null);
end $$;

-- ---------------------------------------------------------------------
--  Phase 2 : constitution des groupes Élite
--  p_assignments : [{"pilot_id": "...", "group_label": "A"}, ...]
-- ---------------------------------------------------------------------
create or replace function public.assign_elite_groups(p_season uuid, p_assignments jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  st public.competition_settings := public.bl_settings();
  v_labels text[];
  v_runners int;
  v_given int;
begin
  perform public.bl_require('admin');
  if public.bl_season_is_closed(p_season) then
    raise exception 'Saison clôturée.' using errcode = 'P0001';
  end if;
  v_labels := (array['A', 'B', 'C', 'D'])[1:st.elite_group_count];

  if exists (select 1 from public.results r join public.events e on e.id = r.event_id
              where e.season_id = p_season and e.kind in ('urban_run', 'navigation')) then
    raise exception 'Des résultats de la phase Élite existent déjà : les groupes ne peuvent plus être modifiés.' using errcode = 'P0001';
  end if;

  drop table if exists pg_temp.bl_groups;
  create temporary table bl_groups on commit drop as
  select x.pilot_id, upper(x.group_label) as group_label
  from jsonb_to_recordset(p_assignments) as x(pilot_id uuid, group_label text);

  select count(*) into v_runners from public.stage_entries se where se.season_id = p_season and se.stage = 'runner';
  select count(distinct pilot_id) into v_given from bl_groups;

  if v_runners = 0 then
    raise exception 'Aucun pilote qualifié pour cette saison.' using errcode = 'P0001';
  end if;
  if v_given <> (select count(*) from bl_groups) then
    raise exception 'Un pilote est affecté à plusieurs groupes.' using errcode = 'P0001';
  end if;
  if v_given <> v_runners or exists (
      select 1 from bl_groups g where not exists (
        select 1 from public.stage_entries se where se.season_id = p_season and se.stage = 'runner' and se.pilot_id = g.pilot_id)) then
    raise exception 'Chaque pilote qualifié doit être affecté à un groupe, et uniquement eux.' using errcode = 'P0001';
  end if;
  if exists (select 1 from bl_groups where not (group_label = any (v_labels))) then
    raise exception 'Groupes autorisés : %.', array_to_string(v_labels, ', ') using errcode = 'P0001';
  end if;
  if exists (select 1 from bl_groups group by group_label having count(*) > st.elite_group_size) then
    raise exception 'Un groupe dépasse la taille maximale de % pilotes.', st.elite_group_size using errcode = 'P0001';
  end if;

  update public.stage_entries se
     set group_label = g.group_label
    from bl_groups g
   where se.season_id = p_season and se.stage = 'runner' and se.pilot_id = g.pilot_id;

  -- Inscription automatique aux épreuves Urban Run / Navigation du groupe
  delete from public.event_participants ep
   using public.events e
   where ep.event_id = e.id and e.season_id = p_season and e.kind in ('urban_run', 'navigation');
  insert into public.event_participants (event_id, pilot_id, status)
  select e.id, g.pilot_id, 'confirmed'
  from public.events e
  join bl_groups g on g.group_label = e.group_label
  where e.season_id = p_season and e.kind in ('urban_run', 'navigation') and e.status <> 'cancelled';

  perform public.bl_log('stage.assign_groups', 'seasons', p_season::text, p_assignments);
end $$;

create or replace function public.reset_elite_groups(p_season uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.bl_require('admin');
  if exists (select 1 from public.results r join public.events e on e.id = r.event_id
              where e.season_id = p_season and e.kind in ('urban_run', 'navigation')) then
    raise exception 'Des résultats de la phase Élite existent déjà : supprimez-les avant de réinitialiser les groupes.' using errcode = 'P0001';
  end if;
  update public.stage_entries set group_label = null where season_id = p_season and stage = 'runner';
  delete from public.event_participants ep using public.events e
   where ep.event_id = e.id and e.season_id = p_season and e.kind in ('urban_run', 'navigation');
  perform public.bl_log('stage.reset_groups', 'seasons', p_season::text, null);
end $$;

-- ---------------------------------------------------------------------
--  Phase 2 → Finale : validation des finalistes d'un groupe
-- ---------------------------------------------------------------------
create or replace function public.confirm_finalists(p_season uuid, p_group text, p_pilots uuid[], p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  st public.competition_settings := public.bl_settings();
  v_ranks jsonb;
  v_tie boolean;
  v_group_pilots uuid[];
begin
  perform public.bl_require('admin');
  if not exists (select 1 from public.events e where e.season_id = p_season and e.kind = 'urban_run'
                  and e.group_label = p_group and e.status = 'completed')
     or not exists (select 1 from public.events e where e.season_id = p_season and e.kind = 'navigation'
                  and e.group_label = p_group and e.status = 'completed') then
    raise exception 'Les deux épreuves (Urban Run et Navigation) du groupe % doivent être terminées.', p_group using errcode = 'P0001';
  end if;
  if exists (select 1 from public.results r join public.events e on e.id = r.event_id
              where e.season_id = p_season and e.kind = 'finale') then
    raise exception 'La finale possède déjà des résultats : les finalistes ne peuvent plus être modifiés.' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(se.pilot_id), '{}') into v_group_pilots
    from public.stage_entries se where se.season_id = p_season and se.stage = 'runner' and se.group_label = p_group;

  select coalesce(jsonb_agg(jsonb_build_object('pilot_id', r.pilot_id, 'tie_rank', r.tie_rank)), '[]')
    into v_ranks
    from public.bl_rank_events(
      (select coalesce(array_agg(e.id), '{}') from public.events e
        where e.season_id = p_season and e.kind in ('urban_run', 'navigation') and e.group_label = p_group and e.status = 'completed'),
      v_group_pilots) r;
  v_tie := public.bl_check_selection(v_ranks, p_pilots, st.finalists_per_group, p_note);

  perform public.bl_set_rank_context('elite_phase', 'Annulation finaliste — groupe ' || p_group, p_season);
  update public.pilots p set rank = 'runner'
   where p.rank = 'challenger'
     and p.id in (select se.pilot_id from public.stage_entries se
                   where se.season_id = p_season and se.stage = 'challenger' and se.pilot_id = any (v_group_pilots))
     and not (p.id = any (p_pilots));
  delete from public.stage_entries se
   where se.season_id = p_season and se.stage = 'challenger' and se.pilot_id = any (v_group_pilots);

  insert into public.stage_entries (season_id, pilot_id, stage, group_label, source, tiebreak_note)
  select p_season, unnest(p_pilots), 'challenger', p_group, 'competition', case when v_tie then trim(p_note) end;

  perform public.bl_set_rank_context('elite_phase', 'Finaliste — groupe ' || p_group, p_season);
  update public.pilots set rank = 'challenger'
   where id = any (p_pilots) and public.bl_rank_level(rank) < 2;

  -- Inscription automatique à la finale
  insert into public.event_participants (event_id, pilot_id, status)
  select e.id, x.pid, 'confirmed'
  from public.events e cross join unnest(p_pilots) as x(pid)
  where e.season_id = p_season and e.kind = 'finale' and e.status not in ('cancelled', 'completed')
  on conflict (event_id, pilot_id) do update set status = 'confirmed';

  perform public.bl_log('stage.confirm_finalists', 'seasons', p_season::text,
    jsonb_build_object('group', p_group, 'pilots', to_jsonb(p_pilots), 'tiebreak', v_tie, 'note', p_note));
end $$;

create or replace function public.revert_finalists(p_season uuid, p_group text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_group_pilots uuid[];
begin
  perform public.bl_require('admin');
  if exists (select 1 from public.results r join public.events e on e.id = r.event_id
              where e.season_id = p_season and e.kind = 'finale') then
    raise exception 'La finale possède déjà des résultats.' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(se.pilot_id), '{}') into v_group_pilots
    from public.stage_entries se where se.season_id = p_season and se.stage = 'runner' and se.group_label = p_group;
  perform public.bl_set_rank_context('elite_phase', 'Annulation finaliste — groupe ' || p_group, p_season);
  update public.pilots p set rank = 'runner'
   where p.rank = 'challenger'
     and p.id in (select se.pilot_id from public.stage_entries se
                   where se.season_id = p_season and se.stage = 'challenger' and se.pilot_id = any (v_group_pilots));
  delete from public.event_participants ep using public.events e
   where ep.event_id = e.id and e.season_id = p_season and e.kind = 'finale' and ep.pilot_id = any (v_group_pilots);
  delete from public.stage_entries se
   where se.season_id = p_season and se.stage = 'challenger' and se.pilot_id = any (v_group_pilots);
  perform public.bl_log('stage.revert_finalists', 'seasons', p_season::text, jsonb_build_object('group', p_group));
end $$;

-- ---------------------------------------------------------------------
--  Finale : désignation des pilotes Elite de la saison
-- ---------------------------------------------------------------------
create or replace function public.confirm_season_elite(p_season uuid, p_pilots uuid[], p_note text default null, p_demote_previous boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  st public.competition_settings := public.bl_settings();
  v_ranks jsonb;
  v_tie boolean;
begin
  perform public.bl_require('admin');
  if not exists (select 1 from public.events e where e.season_id = p_season and e.kind = 'finale' and e.status = 'completed') then
    raise exception 'La finale de la saison doit être terminée.' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('pilot_id', r.pilot_id, 'tie_rank', r.tie_rank)), '[]')
    into v_ranks
    from public.bl_rank_events(
      (select coalesce(array_agg(e.id), '{}') from public.events e
        where e.season_id = p_season and e.kind = 'finale' and e.status = 'completed'),
      (select coalesce(array_agg(se.pilot_id), '{}') from public.stage_entries se
        where se.season_id = p_season and se.stage = 'challenger')) r;
  v_tie := public.bl_check_selection(v_ranks, p_pilots, st.elite_count, p_note);

  perform public.bl_set_rank_context('finale', 'Annulation Elite de la saison', p_season);
  update public.pilots p set rank = 'challenger'
   where p.rank = 'elite'
     and p.id in (select se.pilot_id from public.stage_entries se
                   where se.season_id = p_season and se.stage = 'elite' and se.source = 'competition')
     and not (p.id = any (p_pilots));
  delete from public.stage_entries se where se.season_id = p_season and se.stage = 'elite' and se.source = 'competition';

  insert into public.stage_entries (season_id, pilot_id, stage, source, tiebreak_note)
  select p_season, unnest(p_pilots), 'elite', 'competition', case when v_tie then trim(p_note) end
  on conflict (season_id, pilot_id, stage) do nothing;

  if p_demote_previous then
    perform public.bl_set_rank_context('finale', 'Nouvelle génération Elite', p_season);
    update public.pilots set rank = 'challenger' where rank = 'elite' and not (id = any (p_pilots));
  end if;

  perform public.bl_set_rank_context('finale', 'Elite de la saison', p_season);
  update public.pilots set rank = 'elite' where id = any (p_pilots);

  perform public.bl_log('stage.confirm_elite', 'seasons', p_season::text,
    jsonb_build_object('pilots', to_jsonb(p_pilots), 'tiebreak', v_tie, 'note', p_note, 'demote_previous', p_demote_previous));
end $$;

create or replace function public.revert_season_elite(p_season uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.bl_require('admin');
  perform public.bl_set_rank_context('finale', 'Annulation Elite de la saison', p_season);
  update public.pilots p set rank = 'challenger'
   where p.rank = 'elite'
     and p.id in (select se.pilot_id from public.stage_entries se
                   where se.season_id = p_season and se.stage = 'elite' and se.source = 'competition');
  delete from public.stage_entries se where se.season_id = p_season and se.stage = 'elite' and se.source = 'competition';
  perform public.bl_log('stage.revert_elite', 'seasons', p_season::text, null);
end $$;

-- ---------------------------------------------------------------------
--  Challenges Elite : issue d'un duel
-- ---------------------------------------------------------------------
create or replace function public.bl_apply_challenge_win(c public.elite_challenges, p_outcome text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_season uuid := coalesce(c.season_id, (select s.id from public.seasons s where s.status = 'active'));
  v_reason text := case p_outcome when 'forfeit' then 'Challenge Elite gagné par forfait' else 'Challenge Elite remporté' end;
begin
  perform set_config('blacklane.via_rpc', 'on', true);
  update public.elite_challenges
     set status = 'completed', outcome = p_outcome, winner_id = c.challenger_id,
         result_note = nullif(trim(coalesce(p_note, '')), ''), cooldown_until = null
   where id = c.id;

  perform public.bl_set_rank_context('challenge', v_reason, v_season);
  update public.pilots set rank = 'elite' where id = c.challenger_id;
  perform public.bl_set_rank_context('challenge', 'Place Elite perdue en Challenge', v_season);
  update public.pilots set rank = 'challenger' where id = c.elite_id and rank = 'elite';

  if v_season is not null then
    delete from public.stage_entries where season_id = v_season and pilot_id = c.elite_id and stage = 'elite';
    insert into public.stage_entries (season_id, pilot_id, stage, source, tiebreak_note)
    values (v_season, c.challenger_id, 'elite', 'challenge', null)
    on conflict (season_id, pilot_id, stage) do update set source = 'challenge', decided_at = now();
  end if;
  perform set_config('blacklane.via_rpc', '', true);
end $$;

create or replace function public.resolve_challenge(p_challenge uuid, p_winner uuid, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.elite_challenges;
  st public.competition_settings := public.bl_settings();
begin
  perform public.bl_require('admin');
  select * into c from public.elite_challenges where id = p_challenge for update;
  if not found then
    raise exception 'Défi introuvable.' using errcode = 'P0002';
  end if;
  if c.status not in ('accepted', 'scheduled') then
    raise exception 'Seul un défi accepté ou programmé peut recevoir un résultat.' using errcode = 'P0001';
  end if;
  if p_winner is null or p_winner not in (c.challenger_id, c.elite_id) then
    raise exception 'Le vainqueur doit être l''un des deux pilotes du duel.' using errcode = 'P0001';
  end if;

  if p_winner = c.challenger_id then
    perform public.bl_apply_challenge_win(c, 'challenger_won', p_note);
  else
    perform set_config('blacklane.via_rpc', 'on', true);
    update public.elite_challenges
       set status = 'completed', outcome = 'elite_defended', winner_id = c.elite_id,
           result_note = nullif(trim(coalesce(p_note, '')), ''),
           cooldown_until = now() + make_interval(days => st.challenge_cooldown_days)
     where id = c.id;
    perform set_config('blacklane.via_rpc', '', true);
  end if;
  perform public.bl_log('challenge.resolve', 'elite_challenges', c.id::text,
    jsonb_build_object('winner', p_winner, 'note', p_note));
end $$;

-- Refus d'un défi. p_forfeit = true : l'Elite a refusé sans raison valable
-- et sérieuse — il perd sa place au profit du challenger.
create or replace function public.decline_challenge(p_challenge uuid, p_reason text, p_forfeit boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.elite_challenges;
begin
  perform public.bl_require('admin');
  select * into c from public.elite_challenges where id = p_challenge for update;
  if not found then
    raise exception 'Défi introuvable.' using errcode = 'P0002';
  end if;
  if c.status in ('completed', 'refused', 'cancelled') then
    raise exception 'Ce défi est déjà clos.' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Indiquez le motif du refus.' using errcode = 'P0001';
  end if;
  if p_forfeit then
    perform public.bl_apply_challenge_win(c, 'forfeit', 'Refus sans motif valable : ' || trim(p_reason));
    perform set_config('blacklane.via_rpc', 'on', true);
    update public.elite_challenges set refusal_reason = trim(p_reason) where id = c.id;
    perform set_config('blacklane.via_rpc', '', true);
  else
    update public.elite_challenges set status = 'refused', refusal_reason = trim(p_reason) where id = c.id;
  end if;
  perform public.bl_log('challenge.decline', 'elite_challenges', c.id::text,
    jsonb_build_object('reason', p_reason, 'forfeit', p_forfeit));
end $$;

-- ---------------------------------------------------------------------
--  Contenus : publication
-- ---------------------------------------------------------------------
create or replace function public.publish_content(p_key text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_at timestamptz := now();
begin
  perform public.bl_require('editor');
  perform set_config('blacklane.via_rpc', 'on', true);
  update public.site_content set published = draft, published_at = v_at where key = p_key;
  if not found then
    raise exception 'Contenu introuvable.' using errcode = 'P0002';
  end if;
  perform set_config('blacklane.via_rpc', '', true);
  perform public.bl_log('content.publish', 'site_content', p_key, null);
  return v_at;
end $$;

-- Restaure le brouillon à partir de la version publiée
create or replace function public.discard_content_draft(p_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.bl_require('editor');
  update public.site_content set draft = published where key = p_key and published is not null;
end $$;

-- ---------------------------------------------------------------------
--  Saisons : changement de statut
-- ---------------------------------------------------------------------
create or replace function public.set_season_status(p_season uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.seasons;
begin
  perform public.bl_require('admin');
  select * into s from public.seasons where id = p_season for update;
  if not found then
    raise exception 'Saison introuvable.' using errcode = 'P0002';
  end if;
  if p_status not in ('draft', 'active', 'closed') then
    raise exception 'Statut de saison invalide.' using errcode = '22023';
  end if;
  if s.status = p_status then
    return;
  end if;
  if s.status = 'closed' and not public.is_admin('owner') then
    raise exception 'Seul un owner peut rouvrir une saison clôturée.' using errcode = '42501';
  end if;
  if p_status = 'active' and exists (select 1 from public.seasons x where x.status = 'active' and x.id <> p_season) then
    raise exception 'Une autre saison est déjà active : clôturez-la d''abord.' using errcode = 'P0001';
  end if;
  if p_status = 'draft' and exists (select 1 from public.events e where e.season_id = p_season and e.status = 'completed') then
    raise exception 'Une saison avec des courses terminées ne peut pas repasser en brouillon.' using errcode = 'P0001';
  end if;
  perform set_config('blacklane.via_rpc', 'on', true);
  update public.seasons
     set status = p_status,
         closed_at = case when p_status = 'closed' then now() else null end
   where id = p_season;
  perform set_config('blacklane.via_rpc', '', true);
  perform public.bl_log('season.status', 'seasons', p_season::text, jsonb_build_object('from', s.status, 'to', p_status));
end $$;

-- ---------------------------------------------------------------------
--  Export complet (sauvegarde)
-- ---------------------------------------------------------------------
create or replace function public.admin_export()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
begin
  perform public.bl_require('admin');
  select jsonb_build_object(
    'exported_at', now(),
    'competition_settings', (select to_jsonb(s) from public.competition_settings s where id = 1),
    'point_scales', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.point_scales x),
    'point_scale_entries', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.point_scale_entries x),
    'seasons', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.seasons x),
    'pilots', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.pilots x),
    'pilot_notes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.pilot_notes x),
    'events', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.events x),
    'event_internal_notes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.event_internal_notes x),
    'event_participants', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.event_participants x),
    'results', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.results x),
    'point_adjustments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.point_adjustments x),
    'stage_entries', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.stage_entries x),
    'rank_history', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.rank_history x),
    'elite_challenges', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.elite_challenges x),
    'site_content', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.site_content x)
  ) into v;
  perform public.bl_log('data.export', 'database', null, null);
  return v;
end $$;

-- ---------------------------------------------------------------------
--  Suppression des données de démonstration
-- ---------------------------------------------------------------------
create or replace function public.purge_demo_data()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_pilots int;
  v_events int;
  v_seasons int;
begin
  perform public.bl_require('owner');
  perform set_config('blacklane.purge', 'on', true);
  perform set_config('blacklane.skip_audit', 'on', true);
  perform set_config('blacklane.via_rpc', 'on', true);

  delete from public.elite_challenges c
   where c.is_demo
      or c.challenger_id in (select id from public.pilots where is_demo)
      or c.elite_id in (select id from public.pilots where is_demo);
  delete from public.results r
   where r.event_id in (select id from public.events where is_demo)
      or r.pilot_id in (select id from public.pilots where is_demo);
  delete from public.point_adjustments a
   where a.season_id in (select id from public.seasons where is_demo)
      or a.pilot_id in (select id from public.pilots where is_demo);
  delete from public.stage_entries se
   where se.season_id in (select id from public.seasons where is_demo)
      or se.pilot_id in (select id from public.pilots where is_demo);
  delete from public.event_participants ep where ep.pilot_id in (select id from public.pilots where is_demo);
  delete from public.events where is_demo;
  get diagnostics v_events = row_count;
  delete from public.pilots where is_demo;
  get diagnostics v_pilots = row_count;
  delete from public.seasons s where s.is_demo and not exists (select 1 from public.events e where e.season_id = s.id);
  get diagnostics v_seasons = row_count;

  perform set_config('blacklane.skip_audit', '', true);
  perform set_config('blacklane.purge', '', true);
  perform set_config('blacklane.via_rpc', '', true);
  perform public.bl_log('data.purge_demo', 'database', null,
    jsonb_build_object('pilots', v_pilots, 'events', v_events, 'seasons', v_seasons));
  return jsonb_build_object('pilots', v_pilots, 'events', v_events, 'seasons', v_seasons);
end $$;
