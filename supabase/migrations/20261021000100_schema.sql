-- =====================================================================
--  BLACKLANE — Schéma de données
--  Migration 1/4 : tables, contraintes, index
--  Univers fictif de roleplay (GTA V / FiveM). Aucun nom civil n'est stocké
--  pour les pilotes : uniquement des pseudonymes.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Comptes administrateurs (organisateurs)
--  Chaque ligne référence un compte Supabase Auth. Le rôle détermine les
--  droits : editor < admin < owner.
-- ---------------------------------------------------------------------
create table public.admin_users (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(trim(display_name)) between 2 and 40),
  role          text not null default 'editor' check (role in ('owner', 'admin', 'editor')),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.admin_users is 'Organisateurs autorisés à accéder au back-office. display_name = alias RP (ex. Sullivan, Nyra).';

-- ---------------------------------------------------------------------
--  Paramètres de compétition (ligne unique)
-- ---------------------------------------------------------------------
create table public.competition_settings (
  id                      smallint primary key default 1 check (id = 1),
  sessions_count          int  not null default 4  check (sessions_count between 1 and 12),
  max_pilots_per_session  int  not null default 10 check (max_pilots_per_session between 2 and 40),
  qualifiers_per_session  int  not null default 3  check (qualifiers_per_session between 1 and 20),
  elite_group_count       int  not null default 2  check (elite_group_count between 1 and 4),
  elite_group_size        int  not null default 6  check (elite_group_size between 2 and 20),
  finalists_per_group     int  not null default 3  check (finalists_per_group between 1 and 20),
  elite_count             int  not null default 3  check (elite_count between 1 and 20),
  challenge_cooldown_days int  not null default 14 check (challenge_cooldown_days between 0 and 365),
  challenge_format        text not null default '1 contre 1 — 500 m aller-retour' check (char_length(challenge_format) <= 120),
  tiebreak_policy         text not null default 'manual' check (tiebreak_policy in ('manual', 'best_finish_then_manual')),
  updated_at              timestamptz not null default now(),
  check (qualifiers_per_session <= max_pilots_per_session),
  check (finalists_per_group <= elite_group_size),
  check (elite_count <= elite_group_count * finalists_per_group)
);
comment on column public.competition_settings.tiebreak_policy is
  'manual : toute égalité à la limite de qualification doit être départagée par un administrateur. best_finish_then_manual : départage par meilleure place obtenue, puis manuel.';

-- ---------------------------------------------------------------------
--  Barèmes de points
-- ---------------------------------------------------------------------
create table public.point_scales (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(trim(name)) between 2 and 60),
  description text check (char_length(description) <= 300),
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index point_scales_single_default on public.point_scales ((true)) where is_default;

create table public.point_scale_entries (
  scale_id  uuid not null references public.point_scales (id) on delete cascade,
  position  int  not null check (position between 1 and 50),
  points    int  not null check (points between 0 and 1000),
  primary key (scale_id, position)
);
comment on table public.point_scale_entries is 'Points attribués par position. Une position absente du barème rapporte 0 point.';

-- ---------------------------------------------------------------------
--  Saisons
-- ---------------------------------------------------------------------
create table public.seasons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(trim(name)) between 2 and 60),
  starts_on   date,
  ends_on     date,
  status      text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  scale_id    uuid references public.point_scales (id) on delete restrict,
  notes       text check (char_length(notes) <= 2000),
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  closed_at   timestamptz,
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create unique index seasons_single_active on public.seasons ((true)) where status = 'active';

-- ---------------------------------------------------------------------
--  Pilotes (pseudonymes uniquement)
-- ---------------------------------------------------------------------
create table public.pilots (
  id          uuid primary key default gen_random_uuid(),
  pseudonym   text not null check (char_length(trim(pseudonym)) between 2 and 32 and pseudonym !~ '[<>]'),
  tag         text check (tag ~ '^[A-Z0-9-]{1,12}$'),
  rank        text not null default 'prospect' check (rank in ('prospect', 'runner', 'challenger', 'elite')),
  status      text not null default 'active' check (status in ('active', 'inactive', 'archived', 'banned')),
  vehicle     text check (char_length(vehicle) <= 60),
  bio         text check (char_length(bio) <= 500),
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);
create unique index pilots_pseudonym_ci on public.pilots (lower(trim(pseudonym)));
create unique index pilots_tag_unique on public.pilots (tag) where tag is not null;
comment on table public.pilots is 'Pilotes Blacklane. Ne jamais stocker de nom civil ni de coordonnées ici : la table est lisible publiquement.';

-- Notes internes (jamais publiques)
create table public.pilot_notes (
  pilot_id   uuid primary key references public.pilots (id) on delete cascade,
  notes      text not null default '' check (char_length(notes) <= 4000),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Événements (courses, sessions, épreuves)
-- ---------------------------------------------------------------------
create table public.events (
  id                   uuid primary key default gen_random_uuid(),
  season_id            uuid references public.seasons (id) on delete restrict,
  name                 text not null check (char_length(trim(name)) between 2 and 80),
  description          text check (char_length(description) <= 4000),
  kind                 text not null check (kind in ('qualification', 'urban_run', 'navigation', 'finale', 'challenge', 'exhibition')),
  phase                text not null check (phase in ('qualifications', 'elite', 'finale', 'challenge', 'hors_saison')),
  session_number       int  check (session_number between 1 and 12),
  group_label          text check (group_label in ('A', 'B', 'C', 'D')),
  starts_at            timestamptz,
  location_rp          text check (char_length(location_rp) <= 120),
  participation_info   text check (char_length(participation_info) <= 2000),
  capacity             int  check (capacity between 1 and 50),
  status               text not null default 'scheduled'
                       check (status in ('registration_open', 'scheduled', 'full', 'postponed', 'cancelled', 'in_progress', 'completed')),
  status_note          text check (char_length(status_note) <= 200),
  postponed_from       timestamptz,
  is_published         boolean not null default false,
  featured             boolean not null default false,
  counts_for_standings boolean not null default true,
  scale_id             uuid references public.point_scales (id) on delete restrict,
  is_demo              boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Cohérence type d'épreuve / phase
  constraint events_kind_phase check (
       (kind = 'qualification' and phase = 'qualifications')
    or (kind in ('urban_run', 'navigation') and phase = 'elite')
    or (kind = 'finale' and phase = 'finale')
    or (kind = 'challenge' and phase = 'challenge')
    or (kind = 'exhibition' and phase = 'hors_saison')
  ),
  constraint events_session_required check (kind <> 'qualification' or session_number is not null),
  constraint events_group_required   check (kind not in ('urban_run', 'navigation') or group_label is not null),
  constraint events_season_required  check (kind = 'exhibition' or season_id is not null),
  constraint events_challenge_no_points check (kind <> 'challenge' or counts_for_standings = false)
);
create index events_season_idx on public.events (season_id);
create index events_starts_idx on public.events (starts_at);

create table public.event_internal_notes (
  event_id   uuid primary key references public.events (id) on delete cascade,
  notes      text not null default '' check (char_length(notes) <= 4000),
  updated_at timestamptz not null default now()
);

-- Participants inscrits / convoqués
create table public.event_participants (
  event_id   uuid not null references public.events (id) on delete cascade,
  pilot_id   uuid not null references public.pilots (id) on delete restrict,
  status     text not null default 'registered' check (status in ('registered', 'confirmed', 'withdrawn')),
  created_at timestamptz not null default now(),
  primary key (event_id, pilot_id)
);
create index event_participants_pilot_idx on public.event_participants (pilot_id);

-- ---------------------------------------------------------------------
--  Résultats officiels
--  Une seule ligne par (événement, pilote) : impossible de comptabiliser
--  deux fois un même résultat, quel que soit le nombre d'enregistrements.
-- ---------------------------------------------------------------------
create table public.results (
  event_id          uuid not null references public.events (id) on delete restrict,
  pilot_id          uuid not null references public.pilots (id) on delete restrict,
  outcome           text not null default 'finished' check (outcome in ('finished', 'dnf', 'dsq', 'dns')),
  position          int  check (position between 1 and 50),
  base_points       int  not null default 0,
  adjustment        int  not null default 0 check (adjustment between -100 and 100),
  adjustment_reason text check (char_length(adjustment_reason) <= 200),
  points            int  generated always as (base_points + adjustment) stored,
  checkpoint_ok     boolean,
  time_label        text check (char_length(time_label) <= 20),
  note              text check (char_length(note) <= 300),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (event_id, pilot_id),
  constraint results_position_iff_finished check ((outcome = 'finished') = (position is not null)),
  constraint results_adjustment_reason check (adjustment = 0 or char_length(trim(coalesce(adjustment_reason, ''))) >= 3),
  constraint results_unique_position unique (event_id, position) deferrable initially immediate
);
create index results_pilot_idx on public.results (pilot_id);

-- Corrections manuelles de points (toujours justifiées)
create table public.point_adjustments (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references public.seasons (id) on delete restrict,
  pilot_id    uuid not null references public.pilots (id) on delete restrict,
  event_id    uuid references public.events (id) on delete set null,
  delta       int  not null check (delta between -500 and 500 and delta <> 0),
  reason      text not null check (char_length(trim(reason)) between 5 and 300),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index point_adjustments_season_pilot_idx on public.point_adjustments (season_id, pilot_id);

-- ---------------------------------------------------------------------
--  Progression dans la compétition (par saison)
--  runner     : qualifié à l'issue d'une session (les 12)
--  challenger : finaliste (top de son groupe en phase Élite)
--  elite      : pilote Elite de la saison
-- ---------------------------------------------------------------------
create table public.stage_entries (
  season_id       uuid not null references public.seasons (id) on delete restrict,
  pilot_id        uuid not null references public.pilots (id) on delete restrict,
  stage           text not null check (stage in ('runner', 'challenger', 'elite')),
  group_label     text check (group_label in ('A', 'B', 'C', 'D')),
  source_event_id uuid references public.events (id) on delete set null,
  source          text not null default 'competition' check (source in ('competition', 'challenge', 'manual')),
  tiebreak_note   text check (char_length(tiebreak_note) <= 300),
  decided_by      uuid default auth.uid(),
  decided_at      timestamptz not null default now(),
  primary key (season_id, pilot_id, stage)
);

-- Historique des rangs
create table public.rank_history (
  id         bigint generated always as identity primary key,
  pilot_id   uuid not null references public.pilots (id) on delete cascade,
  season_id  uuid references public.seasons (id) on delete set null,
  from_rank  text,
  to_rank    text not null,
  source     text not null default 'manual',
  reason     text,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index rank_history_pilot_idx on public.rank_history (pilot_id, changed_at desc);

-- ---------------------------------------------------------------------
--  Challenges Elite
-- ---------------------------------------------------------------------
create table public.elite_challenges (
  id              uuid primary key default gen_random_uuid(),
  season_id       uuid references public.seasons (id) on delete restrict,
  challenger_id   uuid not null references public.pilots (id) on delete restrict,
  elite_id        uuid not null references public.pilots (id) on delete restrict,
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'refused', 'scheduled', 'completed', 'cancelled')),
  request_note    text check (char_length(request_note) <= 1000),
  scheduled_at    timestamptz,
  location_rp     text check (char_length(location_rp) <= 120),
  format          text check (char_length(format) <= 120),
  winner_id       uuid references public.pilots (id) on delete restrict,
  outcome         text check (outcome in ('challenger_won', 'elite_defended', 'forfeit')),
  refusal_reason  text check (char_length(refusal_reason) <= 300),
  result_note     text check (char_length(result_note) <= 500),
  cooldown_until  timestamptz,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (challenger_id <> elite_id),
  check ((status = 'completed') = (outcome is not null)),
  check (winner_id is null or winner_id in (challenger_id, elite_id))
);

-- ---------------------------------------------------------------------
--  Contenus éditables (brouillon / publié)
-- ---------------------------------------------------------------------
create table public.site_content (
  key              text primary key check (key in ('home', 'rules', 'qualifications', 'footer')),
  draft            jsonb not null,
  published        jsonb,
  draft_updated_at timestamptz not null default now(),
  published_at     timestamptz,
  updated_by       uuid
);

-- ---------------------------------------------------------------------
--  Journal des actions sensibles
-- ---------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid,
  actor_name  text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     jsonb
);
create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
