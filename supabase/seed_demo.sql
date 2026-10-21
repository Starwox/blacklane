-- =====================================================================
--  BLACKLANE — DONNÉES DE DÉMONSTRATION
--  Toutes les lignes créées ici sont marquées is_demo = true.
--  À exécuter dans l'éditeur SQL Supabase APRÈS les migrations.
--  Pour tout supprimer avant la mise en production :
--      select public.purge_demo_data();
--  (ou bouton « Purger la démo » dans Back-office → Export & données)
-- =====================================================================
begin;

create temporary table demo_ids (kind text, name text, id uuid) on commit drop;
create function pg_temp.pid(p text) returns uuid language sql as $$ select id from public.pilots where pseudonym = p $$;
create function pg_temp.eid(p text) returns uuid language sql as $$ select id from public.events where name = p and is_demo $$;

insert into public.seasons (name, starts_on, ends_on, status, notes, is_demo)
values ('Saison 1 — Démo', '2026-09-01', '2026-11-15', 'draft', 'Saison fictive générée pour la démonstration.', true);
select public.set_season_status((select id from public.seasons where name = 'Saison 1 — Démo'), 'active');

insert into public.pilots (pseudonym, tag, vehicle, bio, is_demo) values
  ('Vanta', 'BL-001', 'Nightfall GT — noir mat', 'Elite de la saison précédente. Ne parle jamais avant une course.', true),
  ('Onyx', 'BL-002', 'Itali RSX carbone', null, true),
  ('Wraith', 'BL-003', 'Pariah sombre', null, true),
  ('Kestrel', 'BL-007', 'Elegy Retro', null, true),
  ('Nox', 'BL-008', 'Jester RR', null, true),
  ('Halcyon', 'BL-009', 'Comet S2', null, true),
  ('Rook', 'BL-010', 'Sultan RS', null, true),
  ('Ember', 'BL-011', 'Calico GTF', null, true),
  ('Static', 'BL-012', 'Futo GTX', null, true),
  ('Viper', 'BL-013', 'Banshee 900R', null, true),
  ('Dusk', 'BL-014', 'Euros', null, true),
  ('Cipher', 'BL-015', 'ZR350', null, true),
  ('Riot', 'BL-016', 'Vectre', null, true),
  ('Mirage', 'BL-017', 'Remus', null, true),
  ('Phantom', 'BL-018', 'Growler', null, true),
  ('Blitz', 'BL-019', 'Cypher', null, true),
  ('Slate', 'BL-020', 'Dominator ASP', null, true),
  ('Hex', 'BL-021', 'Tailgater S', null, true),
  ('Torque', 'BL-022', 'Kuruma', null, true),
  ('Raze', 'BL-023', 'Sugoi', null, true),
  ('Specter', 'BL-024', 'Penumbra FF', null, true),
  ('Nomad', 'BL-025', 'Rt3000', null, true);
select public.set_pilot_rank(pg_temp.pid('Vanta'), 'elite', 'Elite de la saison précédente (démo)');
select public.set_pilot_rank(pg_temp.pid('Onyx'), 'elite', 'Elite de la saison précédente (démo)');
select public.set_pilot_rank(pg_temp.pid('Wraith'), 'elite', 'Elite de la saison précédente (démo)');
insert into public.events (season_id, name, description, kind, phase, session_number, group_label, starts_at, location_rp, participation_info, capacity, status, status_note, postponed_from, is_published, featured, counts_for_standings, is_demo)
values ((select id from public.seasons where name = 'Saison 1 — Démo'), 'Qualification #1', 'Session de qualification. Départ arrêté, parcours communiqué sur place.', 'qualification', 'qualifications', 1, null, '2026-09-05 22:00+02', 'Docks de Elysian Island', 'Convocation par DarkChat uniquement. Présence 30 minutes avant le départ.', 10, 'scheduled', null, null, true, false, true, true);
select public.save_event_results(pg_temp.eid('Qualification #1'), jsonb_build_array(
  jsonb_build_object('pilot_id', pg_temp.pid('Cipher'), 'outcome', 'finished', 'position', 1, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Rook'), 'outcome', 'finished', 'position', 2, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Nox'), 'outcome', 'finished', 'position', 3, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Ember'), 'outcome', 'finished', 'position', 4, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Dusk'), 'outcome', 'finished', 'position', 5, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Kestrel'), 'outcome', 'finished', 'position', 6, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Riot'), 'outcome', 'finished', 'position', 7, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Viper'), 'outcome', 'finished', 'position', 8, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Halcyon'), 'outcome', 'finished', 'position', 9, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Static'), 'outcome', 'finished', 'position', 10, 'checkpoint_ok', null)), true);
select public.confirm_session_qualifiers(pg_temp.eid('Qualification #1'), array[pg_temp.pid('Cipher'), pg_temp.pid('Rook'), pg_temp.pid('Nox')]);
insert into public.events (season_id, name, description, kind, phase, session_number, group_label, starts_at, location_rp, participation_info, capacity, status, status_note, postponed_from, is_published, featured, counts_for_standings, is_demo)
values ((select id from public.seasons where name = 'Saison 1 — Démo'), 'Qualification #2', 'Session de qualification. Départ arrêté, parcours communiqué sur place.', 'qualification', 'qualifications', 2, null, '2026-09-12 22:00+02', 'Parking du Maze Bank Arena', 'Convocation par DarkChat uniquement. Présence 30 minutes avant le départ.', 10, 'scheduled', null, null, true, false, true, true);
select public.save_event_results(pg_temp.eid('Qualification #2'), jsonb_build_array(
  jsonb_build_object('pilot_id', pg_temp.pid('Viper'), 'outcome', 'finished', 'position', 1, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Dusk'), 'outcome', 'finished', 'position', 2, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Mirage'), 'outcome', 'finished', 'position', 3, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Blitz'), 'outcome', 'finished', 'position', 4, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Phantom'), 'outcome', 'finished', 'position', 5, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Torque'), 'outcome', 'finished', 'position', 6, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Slate'), 'outcome', 'finished', 'position', 7, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Static'), 'outcome', 'finished', 'position', 8, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Riot'), 'outcome', 'finished', 'position', 9, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Hex'), 'outcome', 'dnf', 'position', null, 'checkpoint_ok', null)), true);
select public.confirm_session_qualifiers(pg_temp.eid('Qualification #2'), array[pg_temp.pid('Viper'), pg_temp.pid('Dusk'), pg_temp.pid('Mirage')]);
insert into public.events (season_id, name, description, kind, phase, session_number, group_label, starts_at, location_rp, participation_info, capacity, status, status_note, postponed_from, is_published, featured, counts_for_standings, is_demo)
values ((select id from public.seasons where name = 'Saison 1 — Démo'), 'Qualification #3', 'Session de qualification. Départ arrêté, parcours communiqué sur place.', 'qualification', 'qualifications', 3, null, '2026-09-19 22:00+02', 'Terminal de La Mesa', 'Convocation par DarkChat uniquement. Présence 30 minutes avant le départ.', 10, 'scheduled', null, null, true, false, true, true);
select public.save_event_results(pg_temp.eid('Qualification #3'), jsonb_build_array(
  jsonb_build_object('pilot_id', pg_temp.pid('Torque'), 'outcome', 'finished', 'position', 1, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Specter'), 'outcome', 'finished', 'position', 2, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Hex'), 'outcome', 'finished', 'position', 3, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Slate'), 'outcome', 'finished', 'position', 4, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Kestrel'), 'outcome', 'finished', 'position', 5, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Raze'), 'outcome', 'finished', 'position', 6, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Ember'), 'outcome', 'finished', 'position', 7, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Blitz'), 'outcome', 'finished', 'position', 8, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Nomad'), 'outcome', 'finished', 'position', 9, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Halcyon'), 'outcome', 'finished', 'position', 10, 'checkpoint_ok', null)), true);
select public.confirm_session_qualifiers(pg_temp.eid('Qualification #3'), array[pg_temp.pid('Torque'), pg_temp.pid('Specter'), pg_temp.pid('Hex')]);
insert into public.events (season_id, name, description, kind, phase, session_number, group_label, starts_at, location_rp, participation_info, capacity, status, status_note, postponed_from, is_published, featured, counts_for_standings, is_demo)
values ((select id from public.seasons where name = 'Saison 1 — Démo'), 'Qualification #4', 'Session de qualification. Départ arrêté, parcours communiqué sur place.', 'qualification', 'qualifications', 4, null, '2026-09-26 22:00+02', 'Échangeur de Del Perro', 'Convocation par DarkChat uniquement. Présence 30 minutes avant le départ.', 10, 'scheduled', null, null, true, false, true, true);
select public.save_event_results(pg_temp.eid('Qualification #4'), jsonb_build_array(
  jsonb_build_object('pilot_id', pg_temp.pid('Riot'), 'outcome', 'finished', 'position', 1, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Halcyon'), 'outcome', 'finished', 'position', 2, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Ember'), 'outcome', 'finished', 'position', 3, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Slate'), 'outcome', 'finished', 'position', 4, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Static'), 'outcome', 'finished', 'position', 5, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Blitz'), 'outcome', 'finished', 'position', 6, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Kestrel'), 'outcome', 'finished', 'position', 7, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Nomad'), 'outcome', 'finished', 'position', 8, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Phantom'), 'outcome', 'finished', 'position', 9, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Raze'), 'outcome', 'dnf', 'position', null, 'checkpoint_ok', null)), true);
select public.confirm_session_qualifiers(pg_temp.eid('Qualification #4'), array[pg_temp.pid('Riot'), pg_temp.pid('Halcyon'), pg_temp.pid('Ember')]);
insert into public.events (season_id, name, description, kind, phase, session_number, group_label, starts_at, location_rp, participation_info, capacity, status, status_note, postponed_from, is_published, featured, counts_for_standings, is_demo)
values ((select id from public.seasons where name = 'Saison 1 — Démo'), 'Urban Run — Groupe A', 'Course urbaine nocturne en circulation réelle.', 'urban_run', 'elite', null, 'A', '2026-10-03 22:30+02', 'Centre-ville — Pillbox Hill', null, null, 'scheduled', null, null, true, false, true, true);
insert into public.events (season_id, name, description, kind, phase, session_number, group_label, starts_at, location_rp, participation_info, capacity, status, status_note, postponed_from, is_published, featured, counts_for_standings, is_demo)
values ((select id from public.seasons where name = 'Saison 1 — Démo'), 'Urban Run — Groupe B', 'Course urbaine nocturne en circulation réelle.', 'urban_run', 'elite', null, 'B', '2026-10-10 22:30+02', 'Centre-ville — Little Seoul', null, null, 'scheduled', null, null, true, false, true, true);
insert into public.events (season_id, name, description, kind, phase, session_number, group_label, starts_at, location_rp, participation_info, capacity, status, status_note, postponed_from, is_published, featured, counts_for_standings, is_demo)
values ((select id from public.seasons where name = 'Saison 1 — Démo'), 'Navigation — Groupe A', 'Position GPS d''arrivée communiquée au départ. Checkpoint obligatoire.', 'navigation', 'elite', null, 'A', '2026-10-17 23:00+02', 'Départ : Sandy Shores', null, null, 'scheduled', null, null, true, false, true, true);
insert into public.events (season_id, name, description, kind, phase, session_number, group_label, starts_at, location_rp, participation_info, capacity, status, status_note, postponed_from, is_published, featured, counts_for_standings, is_demo)
values ((select id from public.seasons where name = 'Saison 1 — Démo'), 'Navigation — Groupe B', 'Position GPS d''arrivée communiquée au départ. Checkpoint obligatoire.', 'navigation', 'elite', null, 'B', '2026-10-24 23:00+02', 'Départ : Paleto Bay', null, null, 'scheduled', 'Reportée d''une semaine : présence policière trop importante sur le secteur.', '2026-10-17 23:30+02', true, true, true, true);
insert into public.events (season_id, name, description, kind, phase, session_number, group_label, starts_at, location_rp, participation_info, capacity, status, status_note, postponed_from, is_published, featured, counts_for_standings, is_demo)
values ((select id from public.seasons where name = 'Saison 1 — Démo'), 'Finale — Saison 1', 'Six pilotes. Une course décisive.', 'finale', 'finale', null, null, '2026-10-31 23:30+02', 'Lieu communiqué aux finalistes', null, null, 'scheduled', null, null, true, true, true, true);
insert into public.events (season_id, name, description, kind, phase, session_number, group_label, starts_at, location_rp, participation_info, capacity, status, status_note, postponed_from, is_published, featured, counts_for_standings, is_demo)
values (null, 'Run du Vinewood', 'Run d''exhibition hors classement.', 'exhibition', 'hors_saison', null, null, '2026-10-14 22:00+02', 'Vinewood Hills', null, null, 'scheduled', 'Annulé par les organisateurs.', null, true, false, false, true);
insert into public.events (season_id, name, description, kind, phase, session_number, group_label, starts_at, location_rp, participation_info, capacity, status, status_note, postponed_from, is_published, featured, counts_for_standings, is_demo)
values (null, 'Nuit libre — Port de Los Santos', 'Rencontre hors classement ouverte aux Prospects invités.', 'exhibition', 'hors_saison', null, null, '2026-11-07 22:00+02', 'Port de Los Santos', 'Inscription via DarkChat auprès de Nyra.', 16, 'scheduled', null, null, true, false, false, true);
select public.assign_elite_groups((select id from public.seasons where name = 'Saison 1 — Démo'), jsonb_build_array(jsonb_build_object('pilot_id', pg_temp.pid('Cipher'), 'group_label', 'A'),jsonb_build_object('pilot_id', pg_temp.pid('Nox'), 'group_label', 'A'),jsonb_build_object('pilot_id', pg_temp.pid('Dusk'), 'group_label', 'A'),jsonb_build_object('pilot_id', pg_temp.pid('Torque'), 'group_label', 'A'),jsonb_build_object('pilot_id', pg_temp.pid('Hex'), 'group_label', 'A'),jsonb_build_object('pilot_id', pg_temp.pid('Halcyon'), 'group_label', 'A'),jsonb_build_object('pilot_id', pg_temp.pid('Rook'), 'group_label', 'B'),jsonb_build_object('pilot_id', pg_temp.pid('Viper'), 'group_label', 'B'),jsonb_build_object('pilot_id', pg_temp.pid('Mirage'), 'group_label', 'B'),jsonb_build_object('pilot_id', pg_temp.pid('Specter'), 'group_label', 'B'),jsonb_build_object('pilot_id', pg_temp.pid('Riot'), 'group_label', 'B'),jsonb_build_object('pilot_id', pg_temp.pid('Ember'), 'group_label', 'B')));
select public.save_event_results(pg_temp.eid('Urban Run — Groupe A'), jsonb_build_array(
  jsonb_build_object('pilot_id', pg_temp.pid('Torque'), 'outcome', 'finished', 'position', 1, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Halcyon'), 'outcome', 'finished', 'position', 2, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Dusk'), 'outcome', 'finished', 'position', 3, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Cipher'), 'outcome', 'finished', 'position', 4, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Hex'), 'outcome', 'finished', 'position', 5, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Nox'), 'outcome', 'finished', 'position', 6, 'checkpoint_ok', null)), true);
select public.save_event_results(pg_temp.eid('Urban Run — Groupe B'), jsonb_build_array(
  jsonb_build_object('pilot_id', pg_temp.pid('Ember'), 'outcome', 'finished', 'position', 1, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Specter'), 'outcome', 'finished', 'position', 2, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Mirage'), 'outcome', 'finished', 'position', 3, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Rook'), 'outcome', 'finished', 'position', 4, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Viper'), 'outcome', 'finished', 'position', 5, 'checkpoint_ok', null),
  jsonb_build_object('pilot_id', pg_temp.pid('Riot'), 'outcome', 'dnf', 'position', null, 'checkpoint_ok', null)), true);
select public.save_event_results(pg_temp.eid('Navigation — Groupe A'), jsonb_build_array(
  jsonb_build_object('pilot_id', pg_temp.pid('Nox'), 'outcome', 'finished', 'position', 1, 'checkpoint_ok', true),
  jsonb_build_object('pilot_id', pg_temp.pid('Torque'), 'outcome', 'finished', 'position', 2, 'checkpoint_ok', true),
  jsonb_build_object('pilot_id', pg_temp.pid('Halcyon'), 'outcome', 'finished', 'position', 3, 'checkpoint_ok', true),
  jsonb_build_object('pilot_id', pg_temp.pid('Hex'), 'outcome', 'finished', 'position', 4, 'checkpoint_ok', true),
  jsonb_build_object('pilot_id', pg_temp.pid('Cipher'), 'outcome', 'finished', 'position', 5, 'checkpoint_ok', true),
  jsonb_build_object('pilot_id', pg_temp.pid('Dusk'), 'outcome', 'dsq', 'position', null, 'checkpoint_ok', false)), true);
update public.events set status = 'postponed' where name = 'Navigation — Groupe B' and is_demo;
update public.events set status = 'cancelled' where name = 'Run du Vinewood' and is_demo;
update public.events set status = 'registration_open' where name = 'Nuit libre — Port de Los Santos' and is_demo;
insert into public.point_adjustments (season_id, pilot_id, event_id, delta, reason) values ((select id from public.seasons where name = 'Saison 1 — Démo'), pg_temp.pid('Nox'), pg_temp.eid('Urban Run — Groupe A'), -2, 'Démo : contact volontaire au virage du Legion Square.');
insert into public.elite_challenges (challenger_id, elite_id, request_note, is_demo)
values (pg_temp.pid('Riot'), pg_temp.pid('Vanta'), 'Demande transmise à Nyra via DarkChat (démo).', true);
update public.elite_challenges set status = 'scheduled', scheduled_at = '2026-09-30 23:00+02', location_rp = 'Route 68' where challenger_id = pg_temp.pid('Riot');
select public.resolve_challenge((select id from public.elite_challenges where challenger_id = pg_temp.pid('Riot')), pg_temp.pid('Vanta'), 'Vanta conserve sa place (démo).');
insert into public.elite_challenges (challenger_id, elite_id, request_note, is_demo)
values (pg_temp.pid('Specter'), pg_temp.pid('Onyx'), 'Demande transmise à Sullivan (démo).', true);
update public.elite_challenges set status = 'scheduled', scheduled_at = '2026-10-28 23:30+02', location_rp = 'Great Ocean Highway' where challenger_id = pg_temp.pid('Specter');
insert into public.elite_challenges (challenger_id, elite_id, request_note, is_demo)
values (pg_temp.pid('Torque'), pg_temp.pid('Wraith'), 'En attente de validation (démo).', true);

commit;
