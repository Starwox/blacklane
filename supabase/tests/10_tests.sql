-- =====================================================================
--  Tests automatisés : calculs, règles de sélection, permissions (RLS).
--  Exécutés par supabase/tests/run.sh sur une base locale jetable,
--  après les migrations et seed_demo.sql.
-- =====================================================================
\set ON_ERROR_STOP 1
set client_min_messages = warning;

create schema t;
grant usage on schema t to anon, authenticated;

create table t.results (n serial, name text, ok boolean, detail text);
grant insert, select on t.results to anon, authenticated;
grant usage on sequence t.results_n_seq to anon, authenticated;

create function t.ok(p_name text, p_cond boolean, p_detail text default null) returns void
language plpgsql as $$
begin
  insert into t.results (name, ok, detail) values (p_name, coalesce(p_cond, false), p_detail);
end $$;

-- Exécute p_sql et vérifie qu'une erreur correspondant à p_pattern est levée
create function t.throws(p_name text, p_sql text, p_pattern text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
    insert into t.results (name, ok, detail) values (p_name, false, 'aucune erreur levée');
  exception when others then
    insert into t.results (name, ok, detail) values (p_name, sqlerrm ~* p_pattern, sqlerrm);
  end;
end $$;

create function t.as_user(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
$$;
grant execute on all functions in schema t to anon, authenticated;

create function pg_temp.pid(p text) returns uuid language sql as $$ select id from public.pilots where pseudonym = p $$;
create function pg_temp.eid(p text) returns uuid language sql as $$ select id from public.events where name = p $$;

-- Comptes de test
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin@test'),
  ('00000000-0000-0000-0000-0000000000a3', 'editor@test'),
  ('00000000-0000-0000-0000-0000000000a4', 'random@test');
insert into public.admin_users (user_id, display_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Sullivan', 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', 'Nyra', 'admin'),
  ('00000000-0000-0000-0000-0000000000a3', 'Rédac', 'editor');

-- ---------------------------------------------------------------------
-- 1. Barème appliqué
-- ---------------------------------------------------------------------
select t.ok('barème : 1er = 10 pts, 2e = 8, 3e = 6, 9e = 0',
  (select array_agg(base_points order by position) from public.results
    where event_id = pg_temp.eid('Qualification #1') and position in (1, 2, 3, 9)) = array[10, 8, 6, 0]);

select t.ok('barème : un abandon rapporte 0 point',
  not exists (select 1 from public.results where outcome <> 'finished' and base_points <> 0));

select t.ok('classement saison = somme des résultats publiés + corrections',
  (select sum(points) from public.v_season_standings) =
  (select sum(r.points) from public.results r join public.events e on e.id = r.event_id
    where e.status = 'completed' and e.is_published and e.counts_for_standings)
  + (select sum(delta) from public.point_adjustments));

-- ---------------------------------------------------------------------
-- 2. Idempotence : ré-enregistrer les mêmes résultats ne double rien
-- ---------------------------------------------------------------------
create temporary table snap as select pilot_id, points from public.v_season_standings;
select public.save_event_results(pg_temp.eid('Navigation — Groupe A'),
  (select jsonb_agg(jsonb_build_object('pilot_id', pilot_id, 'outcome', outcome, 'position', position, 'checkpoint_ok', checkpoint_ok))
     from public.results where event_id = pg_temp.eid('Navigation — Groupe A')), true);
select public.save_event_results(pg_temp.eid('Navigation — Groupe A'),
  (select jsonb_agg(jsonb_build_object('pilot_id', pilot_id, 'outcome', outcome, 'position', position, 'checkpoint_ok', checkpoint_ok))
     from public.results where event_id = pg_temp.eid('Navigation — Groupe A')), true);
select t.ok('idempotence : double enregistrement sans effet sur les totaux',
  not exists (select 1 from public.v_season_standings v join snap s using (pilot_id) where v.points <> s.points));
select t.ok('idempotence : une seule ligne par pilote et par épreuve',
  (select count(*) = count(distinct (event_id, pilot_id)) from public.results));

-- ---------------------------------------------------------------------
-- 3. Recalcul après modification du barème
-- ---------------------------------------------------------------------
update public.point_scale_entries set points = 12
 where position = 1 and scale_id = (select id from public.point_scales where is_default);
select t.ok('recalcul : le vainqueur passe à 12 points après changement de barème',
  (select base_points from public.results where event_id = pg_temp.eid('Qualification #1') and position = 1) = 12);
update public.point_scale_entries set points = 10
 where position = 1 and scale_id = (select id from public.point_scales where is_default);
select t.ok('recalcul : retour à 10 points',
  (select base_points from public.results where event_id = pg_temp.eid('Qualification #1') and position = 1) = 10);
select t.ok('recalcul : totaux identiques après aller-retour',
  not exists (select 1 from public.v_season_standings v join snap s using (pilot_id) where v.points <> s.points));

-- ---------------------------------------------------------------------
-- 4. Validations de saisie
-- ---------------------------------------------------------------------
select t.throws('saisie : positions non consécutives refusées',
  format($$select public.save_event_results(%L, jsonb_build_array(
     jsonb_build_object('pilot_id', %L, 'position', 1),
     jsonb_build_object('pilot_id', %L, 'position', 3)), false)$$,
     pg_temp.eid('Nuit libre — Port de Los Santos'), pg_temp.pid('Slate'), pg_temp.pid('Blitz')),
  'consécutives');
select t.throws('saisie : pilote en double refusé',
  format($$select public.save_event_results(%L, jsonb_build_array(
     jsonb_build_object('pilot_id', %L, 'position', 1),
     jsonb_build_object('pilot_id', %L, 'position', 2)), false)$$,
     pg_temp.eid('Nuit libre — Port de Los Santos'), pg_temp.pid('Slate'), pg_temp.pid('Slate')),
  'plusieurs fois');
select t.throws('navigation : classé sans checkpoint refusé',
  format($$select public.save_event_results(%L, jsonb_build_array(
     jsonb_build_object('pilot_id', %L, 'position', 1, 'checkpoint_ok', false)), false)$$,
     pg_temp.eid('Navigation — Groupe B'), pg_temp.pid('Rook')),
  'checkpoint');
select t.throws('élite : pilote hors groupe refusé',
  format($$select public.save_event_results(%L, jsonb_build_array(
     jsonb_build_object('pilot_id', %L, 'position', 1, 'checkpoint_ok', true)), false)$$,
     pg_temp.eid('Navigation — Groupe B'), pg_temp.pid('Cipher')),
  'groupe B');
select t.throws('qualifications : pilote déjà qualifié refusé dans une autre session',
  format($$insert into public.event_participants (event_id, pilot_id) values (%L, %L)$$,
     pg_temp.eid('Qualification #2'), pg_temp.pid('Cipher')),
  'déjà qualifié');
select t.throws('résultats verrouillés une fois les qualifiés validés',
  format($$select public.save_event_results(%L, '[]'::jsonb, false)$$, pg_temp.eid('Qualification #1')),
  'déjà validés');

-- ---------------------------------------------------------------------
-- 5. Sélection des finalistes : conformité au classement et égalités
-- ---------------------------------------------------------------------
create temporary table rk_a as select * from public.group_ranking(
  (select id from public.seasons where status = 'active'), 'A');
select t.ok('classement groupe A : 6 pilotes, cumul des 2 épreuves',
  (select count(*) from rk_a) = 6
  and (select bool_and(points = (select coalesce(sum(r.points), 0) from public.results r join public.events e on e.id = r.event_id
                                   where r.pilot_id = rk_a.pilot_id and e.kind in ('urban_run', 'navigation'))) from rk_a));

select t.throws('finalistes : sélection non conforme refusée',
  format($$select public.confirm_finalists(%L, 'A', %L::uuid[])$$,
    (select id from public.seasons where status = 'active'),
    (select array_agg(pilot_id) from (select pilot_id from rk_a order by tie_rank desc, pseudonym limit 3) x)),
  'non conforme|départage');

select t.throws('finalistes : mauvais nombre de pilotes refusé',
  format($$select public.confirm_finalists(%L, 'A', %L::uuid[])$$,
    (select id from public.seasons where status = 'active'),
    (select array_agg(pilot_id) from (select pilot_id from rk_a order by tie_rank limit 2) x)),
  'exactement 3');

-- Création d'une égalité artificielle à la limite (3e / 4e)
do $$
declare
  v_third uuid; v_fourth uuid; v_diff int; v_season uuid := (select id from public.seasons where status = 'active');
begin
  select pilot_id into v_third from (select pilot_id, row_number() over (order by points desc, pseudonym) rn from public.group_ranking(v_season, 'A')) x where rn = 3;
  select pilot_id into v_fourth from (select pilot_id, row_number() over (order by points desc, pseudonym) rn from public.group_ranking(v_season, 'A')) x where rn = 4;
  select (select points from public.group_ranking(v_season, 'A') where pilot_id = v_third)
       - (select points from public.group_ranking(v_season, 'A') where pilot_id = v_fourth) into v_diff;
  if v_diff > 0 then
    update public.results set adjustment = v_diff, adjustment_reason = 'Test égalité'
     where pilot_id = v_fourth and event_id = pg_temp.eid('Urban Run — Groupe A');
  end if;
end $$;

create temporary table rk_tie as select * from public.group_ranking((select id from public.seasons where status = 'active'), 'A');
select t.ok('égalité détectée à la limite de qualification',
  (select count(*) from rk_tie where tie_rank = (select tie_rank from rk_tie order by tie_rank, pseudonym offset 2 limit 1)) >= 2);

select t.throws('égalité : validation refusée sans motif de départage',
  format($$select public.confirm_finalists(%L, 'A', %L::uuid[])$$,
    (select id from public.seasons where status = 'active'),
    (select array_agg(pilot_id) from (select pilot_id from rk_tie order by tie_rank, pseudonym limit 3) x)),
  'départage');

select public.confirm_finalists((select id from public.seasons where status = 'active'), 'A',
  (select array_agg(pilot_id) from (select pilot_id from rk_tie order by tie_rank, pseudonym limit 3) x),
  'Départage au meilleur temps sur la Navigation (test)');
select t.ok('égalité : validation acceptée avec motif, rang Challenger attribué',
  (select count(*) from public.stage_entries where stage = 'challenger') = 3
  and (select count(*) from public.pilots where rank = 'challenger') = 3
  and (select count(*) from public.stage_entries where stage = 'challenger' and tiebreak_note is not null) = 3);
select t.ok('finalistes inscrits automatiquement à la finale',
  (select count(*) from public.event_participants where event_id = pg_temp.eid('Finale — Saison 1')) = 3);
select t.ok('historique des rangs alimenté',
  (select count(*) from public.rank_history where to_rank = 'challenger' and source = 'elite_phase') = 3);

-- ---------------------------------------------------------------------
-- 6. Challenges Elite
-- ---------------------------------------------------------------------
select t.throws('challenge : délai d''attente après une défaite',
  format($$insert into public.elite_challenges (challenger_id, elite_id) values (%L, %L)$$, pg_temp.pid('Riot'), pg_temp.pid('Wraith')),
  'attendre');
select t.throws('challenge : la cible doit être Elite',
  format($$insert into public.elite_challenges (challenger_id, elite_id) values (%L, %L)$$, pg_temp.pid('Slate'), pg_temp.pid('Blitz')),
  'Elite');
select t.throws('challenge : le résultat ne s''écrit pas directement',
  $$update public.elite_challenges set status = 'completed', outcome = 'challenger_won' where status = 'scheduled'$$,
  'Enregistrer le résultat');
select public.resolve_challenge((select id from public.elite_challenges where status = 'scheduled'),
                                (select challenger_id from public.elite_challenges where status = 'scheduled'), 'Test');
select t.ok('challenge gagné : le challenger devient Elite, l''Elite est rétrogradé',
  (select rank from public.pilots where pseudonym = 'Specter') = 'elite'
  and (select rank from public.pilots where pseudonym = 'Onyx') = 'challenger');
select public.decline_challenge((select id from public.elite_challenges where status = 'pending'), 'Refus non justifié (test)', true);
select t.ok('refus injustifié : forfait, l''Elite perd sa place',
  (select rank from public.pilots where pseudonym = 'Torque') = 'elite'
  and (select rank from public.pilots where pseudonym = 'Wraith') = 'challenger'
  and (select outcome from public.elite_challenges where challenger_id = pg_temp.pid('Torque')) = 'forfeit');

-- ---------------------------------------------------------------------
-- 7. Permissions : visiteur anonyme
-- ---------------------------------------------------------------------
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select t.ok('anon : lit les pilotes', (select count(*) from public.pilots) > 0);
select t.ok('anon : lit le classement', (select count(*) from public.v_season_standings) > 0);
select t.ok('anon : ne voit que les événements publiés', not exists (select 1 from public.events where not is_published));
select t.ok('anon : contenus publiés lisibles', (select count(*) from public.v_site_content) = 4);
select t.ok('anon : statistiques publiques', (public.public_stats() ->> 'races_completed')::int > 0);
select t.throws('anon : pas d''accès direct aux résultats', 'select * from public.results', 'permission denied');
select t.throws('anon : pas d''accès aux notes internes', 'select * from public.pilot_notes', 'permission denied');
select t.throws('anon : pas d''accès aux brouillons', 'select * from public.site_content', 'permission denied');
select t.throws('anon : pas d''accès au journal', 'select * from public.audit_log', 'permission denied');
select t.throws('anon : pas d''accès aux comptes admin', 'select * from public.admin_users', 'permission denied');
select t.throws('anon : ne peut pas créer de pilote', $$insert into public.pilots (pseudonym) values ('Intrus')$$, 'permission denied|row-level');
select t.throws('anon : ne peut pas modifier un événement', $$update public.events set name = 'Piraté'$$, 'permission denied');
select t.throws('anon : ne peut pas saisir de résultats',
  $$select public.save_event_results(gen_random_uuid(), '[]'::jsonb, true)$$, 'permission denied');
select t.throws('anon : ne peut pas purger les données', 'select public.purge_demo_data()', 'permission denied');
reset role;

-- ---------------------------------------------------------------------
-- 8. Permissions : compte connecté non autorisé
-- ---------------------------------------------------------------------
set role authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000a4');
select t.ok('non-admin : aucun résultat brut visible', (select count(*) from public.results) = 0);
select t.ok('non-admin : aucune note interne visible', (select count(*) from public.pilot_notes) = 0);
select t.throws('non-admin : création de pilote refusée', $$insert into public.pilots (pseudonym) values ('Intrus')$$, 'row-level');
update public.events set name = 'Piraté'; -- RLS : 0 ligne modifiée
select t.throws('non-admin : saisie de résultats refusée',
  format($$select public.save_event_results(%L, '[]'::jsonb, false)$$, pg_temp.eid('Finale — Saison 1')), 'Accès refusé');
select t.throws('non-admin : publication refusée', $$select public.publish_content('home')$$, 'Accès refusé');
select t.throws('non-admin : s''auto-promouvoir admin refusé',
  $$insert into public.admin_users (user_id, display_name, role) values ('00000000-0000-0000-0000-0000000000a4', 'Pirate', 'owner')$$, 'row-level');
select t.throws('non-admin : export refusé', 'select public.admin_export()', 'Accès refusé');
reset role;
select t.ok('non-admin : aucun événement renommé', not exists (select 1 from public.events where name = 'Piraté'));

-- ---------------------------------------------------------------------
-- 9. Permissions : rôles editor / admin / owner
-- ---------------------------------------------------------------------
set role authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000a3');
insert into public.pilots (pseudonym, tag) values ('Recrue', 'BL-099');
select t.ok('editor : peut créer un pilote', exists (select 1 from public.pilots where pseudonym = 'Recrue'));
select t.throws('editor : ne peut pas modifier un rang', $$update public.pilots set rank = 'elite' where pseudonym = 'Recrue'$$, 'administrateur');
select t.throws('editor : ne peut pas terminer une course',
  format($$update public.events set status = 'completed' where id = %L$$, pg_temp.eid('Nuit libre — Port de Los Santos')), 'administrateur');
select t.throws('editor : ne peut pas saisir de résultats',
  format($$select public.save_event_results(%L, '[]'::jsonb, false)$$, pg_temp.eid('Finale — Saison 1')), 'Accès refusé');
update public.site_content set draft = jsonb_set(draft, '{hero,kicker}', '"Brouillon de test"') where key = 'home';
select t.ok('editor : brouillon modifié sans toucher au publié',
  (select content #>> '{hero,kicker}' from public.v_site_content where key = 'home') <> 'Brouillon de test');
select t.throws('editor : la version publiée ne change pas directement',
  $$update public.site_content set published = draft where key = 'home'$$, 'Publier');
select public.publish_content('home');
select t.ok('editor : publication effective',
  (select content #>> '{hero,kicker}' from public.v_site_content where key = 'home') = 'Brouillon de test');
update public.point_scale_entries set points = 50 where position = 1; -- RLS : 0 ligne modifiée
reset role;
select t.ok('editor : barème non modifiable',
  (select points from public.point_scale_entries where position = 1 and scale_id = (select id from public.point_scales where is_default)) = 10);

set role authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000a2');
select t.ok('admin : voit les résultats bruts', (select count(*) from public.results) > 0);
select public.set_pilot_rank(pg_temp.pid('Recrue'), 'runner', 'Test de modification manuelle');
select t.ok('admin : rang modifié avec justification historisée',
  exists (select 1 from public.rank_history where pilot_id = pg_temp.pid('Recrue') and to_rank = 'runner' and reason = 'Test de modification manuelle'));
select t.throws('admin : correction de points sans justification refusée',
  format($$insert into public.point_adjustments (season_id, pilot_id, delta, reason) values (%L, %L, 3, 'x')$$,
    (select id from public.seasons where status = 'active'), pg_temp.pid('Recrue')), 'check');
update public.admin_users set role = 'owner' where display_name = 'Nyra'; -- RLS : 0 ligne modifiée
select t.throws('admin : ne peut pas purger la démo', 'select public.purge_demo_data()', 'Accès refusé');
reset role;
select t.ok('admin : ne peut pas s''attribuer le rôle owner', (select role from public.admin_users where display_name = 'Nyra') = 'admin');

set role authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select t.throws('owner : impossible de retirer le dernier owner',
  $$update public.admin_users set role = 'admin' where display_name = 'Sullivan'$$, 'owner');
reset role;

-- ---------------------------------------------------------------------
-- 10. Saison clôturée : données figées
-- ---------------------------------------------------------------------
select t.throws('saison : statut modifiable uniquement par l''action dédiée',
  $$set role authenticated; select t.as_user('00000000-0000-0000-0000-0000000000a2'); update public.seasons set status = 'closed'$$,
  'Clôturer');
reset role;
select public.set_season_status((select id from public.seasons where status = 'active'), 'closed');
select t.throws('saison clôturée : résultats figés',
  format($$update public.results set adjustment = 1, adjustment_reason = 'test' where event_id = %L$$, pg_temp.eid('Qualification #2')),
  'clôturée');
select t.throws('saison clôturée : pas de nouvel événement',
  format($$insert into public.events (season_id, name, kind, phase, session_number) values (%L, 'Test', 'qualification', 'qualifications', 1)$$,
    (select id from public.seasons where name = 'Saison 1 — Démo')),
  'clôturée');
select t.ok('saison clôturée : classement historique conservé',
  (select count(*) from public.v_season_standings where season_status = 'closed') > 0);

-- ---------------------------------------------------------------------
-- 11. Journal d'audit
-- ---------------------------------------------------------------------
select t.ok('audit : saisies de résultats journalisées', exists (select 1 from public.audit_log where action = 'results.save'));
select t.ok('audit : changement de barème journalisé', exists (select 1 from public.audit_log where entity = 'point_scale_entries' and action = 'update'));
select t.ok('audit : publication journalisée', exists (select 1 from public.audit_log where action = 'content.publish' and actor_name = 'Rédac'));
select t.ok('audit : auteur des modifications identifié', exists (select 1 from public.audit_log where actor_name = 'Nyra'));

-- ---------------------------------------------------------------------
-- 12. Purge de la démo
-- ---------------------------------------------------------------------
select public.purge_demo_data();
select t.ok('purge : plus aucun pilote de démo', not exists (select 1 from public.pilots where is_demo));
select t.ok('purge : plus aucun événement de démo', not exists (select 1 from public.events where is_demo));
select t.ok('purge : plus aucune saison de démo', not exists (select 1 from public.seasons where is_demo));
select t.ok('purge : configuration conservée',
  exists (select 1 from public.point_scales where is_default) and (select count(*) from public.site_content) = 4
  and exists (select 1 from public.pilots where pseudonym = 'Recrue'));

-- ---------------------------------------------------------------------
--  Rapport
-- ---------------------------------------------------------------------
\pset format aligned
select n, case when ok then 'OK ' else 'ÉCHEC' end as statut, name,
       case when not ok then detail end as detail
from t.results order by n;
select count(*) filter (where ok) as reussis, count(*) filter (where not ok) as echecs from t.results;
do $$ begin
  if exists (select 1 from t.results where not ok) then raise exception 'Des tests ont échoué.'; end if;
end $$;
