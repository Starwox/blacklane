-- =====================================================================
--  BLACKLANE — Données de référence (production)
--  Migration 4/4 : paramètres, barème officiel, contenus éditables.
--  Ces données ne sont PAS des données de démonstration : elles
--  constituent la configuration initiale du site et restent modifiables
--  depuis le back-office.
--  Les textes peuvent contenir des variables remplacées à l'affichage par
--  les paramètres de compétition : {sessions_count}, {max_pilots_per_session},
--  {qualifiers_per_session}, {total_qualified}, {elite_group_count},
--  {elite_group_size}, {finalists_per_group}, {finalists_total},
--  {elite_count}, {challenge_cooldown_days}, {challenge_format}.
-- =====================================================================

insert into public.competition_settings (id) values (1) on conflict (id) do nothing;

with s as (
  insert into public.point_scales (name, description, is_default)
  values ('Barème officiel', 'Barème commun aux qualifications, à la phase Élite et à la finale.', true)
  on conflict (name) do update set is_default = true
  returning id
)
insert into public.point_scale_entries (scale_id, position, points)
select s.id, v.position, v.points
from s, (values (1, 10), (2, 8), (3, 6), (4, 5), (5, 4), (6, 3), (7, 2), (8, 1), (9, 0), (10, 0)) as v(position, points)
on conflict (scale_id, position) do nothing;

-- ---------------------------------------------------------------------
--  Page d'accueil
-- ---------------------------------------------------------------------
insert into public.site_content (key, draft, published, published_at) values ('home', $json$
{
  "announcement": {
    "enabled": false,
    "tone": "info",
    "text": "Les inscriptions à la prochaine session de qualification passent exclusivement par DarkChat.",
    "link_label": "Voir le calendrier",
    "link_href": "/calendrier"
  },
  "hero": {
    "kicker": "Ligue clandestine — Los Santos",
    "title_left": "BLACK",
    "title_right": "LANE",
    "tagline_1": "Ils cherchent des coureurs.",
    "tagline_2": "Nous cherchons des pilotes.",
    "motto": "Blacklane n'est pas une course. C'est une sélection.",
    "image_url": null,
    "image_alt": "Voiture de sport sombre dans les rues de Los Santos, de nuit",
    "primary_cta": { "label": "Voir le classement", "href": "/classement" },
    "secondary_cta": { "label": "Prochain événement", "href": null }
  },
  "stats": {
    "enabled": true,
    "title": "Le circuit en chiffres",
    "items": {
      "races_completed": { "enabled": true, "label": "Courses organisées" },
      "pilots_participated": { "enabled": true, "label": "Pilotes participants" },
      "pilots_ranked": { "enabled": true, "label": "Pilotes classés cette saison" },
      "upcoming_events": { "enabled": true, "label": "Événements à venir" }
    }
  },
  "standings": {
    "enabled": true,
    "title": "Classement des pilotes",
    "subtitle": "Points officiels de la saison en cours.",
    "limit": 10
  },
  "upcoming": {
    "enabled": true,
    "title": "Prochaines courses",
    "limit": 3,
    "featured_only": false
  },
  "phases": {
    "enabled": true,
    "title": "Les phases Blacklane",
    "intro": "Personne n'entre par hasard. Chaque pilote gravit les échelons un par un — ou reste au bord de la route.",
    "items": [
      { "key": "prospect", "name": "Prospect", "description": "Pilote invité à participer à une session de qualification." },
      { "key": "runner", "name": "Runner", "description": "A validé sa session de qualification : fait partie des {total_qualified} pilotes de la phase Élite." },
      { "key": "challenger", "name": "Challenger", "description": "A franchi la phase Élite : top {finalists_per_group} de son groupe, qualifié pour la finale." },
      { "key": "elite", "name": "Elite", "description": "Les {elite_count} meilleurs pilotes de la saison. Les références à battre." }
    ],
    "cta_label": "Comprendre les qualifications"
  },
  "organizers": {
    "enabled": true,
    "title": "Organisateurs",
    "people": [
      { "alias": "Sullivan", "roles": "Stratégie · Sélection", "verbs": "Observe. Analyse. Décide." },
      { "alias": "Nyra", "roles": "Communication · Logistique", "verbs": "Organise. Coordonne. Protège." }
    ],
    "quote": "Nous ne courons pas. Nous sélectionnons les meilleurs."
  },
  "results": {
    "enabled": true,
    "title": "Derniers résultats",
    "limit": 3
  },
  "rules": {
    "enabled": true,
    "title": "Les règles de Blacklane",
    "items": [
      { "title": "Respect", "text": "Respecte les autres pilotes, les organisateurs, les lieux et le règlement." },
      { "title": "Anonymat absolu", "text": "Ne révèle jamais l'identité d'un membre, d'un organisateur ou d'un pilote." },
      { "title": "Fair-play", "text": "Pas de triche, pas de glitch, pas de coup bas. La skill avant tout." },
      { "title": "Format de l'épreuve", "text": "Chaque événement a ses propres règles : elles s'appliquent sans exception." },
      { "title": "Aucun héros", "text": "Tu n'es pas invincible. Les conséquences RP de la course sont les tiennes." }
    ],
    "cta_label": "Consulter le règlement complet"
  },
  "closing": {
    "enabled": true,
    "line_1": "La nuit. La ville.",
    "line_2": "Les règles sont les nôtres."
  }
}
$json$::jsonb, null, null)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
--  Règlement
-- ---------------------------------------------------------------------
insert into public.site_content (key, draft, published, published_at) values ('rules', $json$
{
  "intro": "Toute participation à un événement Blacklane vaut acceptation du présent règlement. Les organisateurs en sont les seuls garants et peuvent l'adapter à chaque épreuve.",
  "sections": [
    {
      "id": "respect",
      "title": "Respect",
      "body": "Respecte les autres pilotes, les organisateurs, les lieux et le règlement.\n\nLes consignes données par Sullivan ou Nyra avant et pendant une épreuve sont à suivre sans discussion. Les différends se règlent après la course, en privé, via DarkChat."
    },
    {
      "id": "anonymat",
      "title": "Anonymat absolu",
      "body": "Dans l'univers Blacklane, chacun est connu uniquement par son surnom.\n\n- Ne révèle jamais l'identité réelle d'un membre, d'un pilote ou d'un organisateur sans son accord.\n- Les communications opérationnelles passent exclusivement par DarkChat : aucun réseau public, aucun message inutile.\n- Ne filme pas les événements. La discrétion est obligatoire.\n\nRévéler volontairement une identité entraîne une exclusion définitive."
    },
    {
      "id": "fair-play",
      "title": "Fair-play",
      "body": "La skill avant tout.\n\n- Aucune triche, aucune exploitation de glitch ou de bug.\n- Aucun coup bas grave : fusillade, sabotage, freins coupés, embuscade.\n- Ne bloque pas volontairement la route."
    },
    {
      "id": "vandalisme",
      "title": "Pas de vandalisme",
      "body": "Les courses sont illégales, mais elles ne sont pas un prétexte à la destruction gratuite. Les dégradations volontaires pendant un événement sont sanctionnées."
    },
    {
      "id": "format",
      "title": "Consignes et format des épreuves",
      "body": "Chaque épreuve possède son propre format, communiqué par les organisateurs : point de départ, parcours ou position GPS d'arrivée, checkpoints obligatoires, horaires.\n\nEn Navigation, le passage au checkpoint obligatoire est vérifié par un organisateur. Un pilote qui ne l'a pas franchi est disqualifié de l'épreuve."
    },
    {
      "id": "accidents",
      "title": "Accidents et sécurité",
      "body": "En cas d'accident, la course continue selon le règlement de l'événement.\n\n- Un pilote qui s'arrête ou quitte la course sans raison valable prend le risque de perdre des points, voire de perdre la course.\n- Un témoin (passager ou autre) peut transmettre la position GPS de l'accident aux organisateurs via DarkChat. Le pilote accidenté peut également transmettre sa position s'il en est capable.\n- Sullivan ou Nyra se rend sur place pour évaluer la situation, sécuriser la zone et, si nécessaire, contacter les secours RP — sans jamais compromettre Blacklane.\n\nL'intervention des organisateurs ne supprime pas les risques RP liés à la course. Nous sommes humains : votre sécurité compte."
    },
    {
      "id": "consequences",
      "title": "Conséquences RP",
      "body": "Chaque participant accepte les conséquences possibles d'une course clandestine : poursuite policière, arrestation, amende, saisie ou perte du véhicule, peine de prison, accident et conséquences RP associées.\n\nBlacklane organise des événements. Blacklane ne protège personne. Toute conséquence liée à la participation relève uniquement du pilote."
    },
    {
      "id": "challenge",
      "title": "Challenges Elite",
      "body": "Tout pilote Blacklane peut défier un pilote Elite.\n\n- La demande est transmise à Sullivan ou Nyra, qui la valident ou non.\n- Si la demande est validée, les organisateurs contactent le pilote Elite et organisent le duel : {challenge_format}.\n- Un pilote Elite qui refuse un défi sans raison valable et sérieuse perd sa place.\n- Si le challenger gagne, il prend la place du pilote Elite. S'il perd, il doit attendre {challenge_cooldown_days} jours avant de pouvoir lancer un nouveau défi."
    },
    {
      "id": "exclusion",
      "title": "Une fois dedans, tu n'en ressors jamais",
      "body": "Une fuite d'identité ou une trahison entraîne un bannissement définitif. Aucun retour possible."
    }
  ],
  "sanctions": [
    { "id": "s1", "infraction": "Manque de respect envers un pilote ou un organisateur", "sanction": "Avertissement, puis exclusion temporaire en cas de récidive." },
    { "id": "s2", "infraction": "Révélation volontaire d'une identité", "sanction": "Exclusion définitive." },
    { "id": "s3", "infraction": "Triche ou exploitation de glitch", "sanction": "Disqualification de l'épreuve et perte des points obtenus. Exclusion en cas de récidive." },
    { "id": "s4", "infraction": "Coup bas grave (fusillade, sabotage…)", "sanction": "Disqualification et exclusion définitive." },
    { "id": "s5", "infraction": "Vandalisme gratuit pendant un événement", "sanction": "Pénalité de points, voire disqualification." },
    { "id": "s6", "infraction": "Non-respect du format (checkpoint manqué, parcours interdit…)", "sanction": "Disqualification de l'épreuve." },
    { "id": "s7", "infraction": "Arrêt ou abandon sans raison valable", "sanction": "Perte de points sur l'épreuve." },
    { "id": "s8", "infraction": "Refus d'un Challenge Elite sans motif valable", "sanction": "Perte de la place Elite." },
    { "id": "s9", "infraction": "Trahison ou fuite d'informations", "sanction": "Bannissement définitif." }
  ]
}
$json$::jsonb, null, null)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
--  Page Qualifications
-- ---------------------------------------------------------------------
insert into public.site_content (key, draft, published, published_at) values ('qualifications', $json$
{
  "intro": "Blacklane ne se gagne pas en une nuit. Une saison se joue en trois phases : les qualifications, la phase Élite, puis la finale. À chaque étape, seuls les meilleurs avancent.",
  "phase1": {
    "title": "Phase 1 — Qualifications",
    "text": "{sessions_count} sessions de qualification, {max_pilots_per_session} pilotes maximum par session. Chaque session est une course indépendante avec son propre classement par points. À la fin de chaque session, les {qualifiers_per_session} pilotes ayant obtenu le plus de points sont qualifiés. Un pilote non qualifié peut retenter sa chance lors d'une autre session.",
    "summary": "{sessions_count} sessions × {qualifiers_per_session} pilotes = {total_qualified} pilotes qualifiés pour la phase Élite."
  },
  "phase2": {
    "title": "Phase 2 — Élite",
    "text": "Les {total_qualified} pilotes qualifiés sont répartis en {elite_group_count} groupes de {elite_group_size}. Chaque groupe dispute deux épreuves : Urban Run et Navigation, avec le même barème que la phase 1. Les points des deux épreuves sont additionnés ; les {finalists_per_group} meilleurs pilotes de chaque groupe accèdent à la finale."
  },
  "urban_run": {
    "title": "Urban Run",
    "text": "Course urbaine nocturne. Vitesse, trajectoires, réflexes, gestion du trafic et maîtrise du véhicule."
  },
  "navigation": {
    "title": "Navigation",
    "text": "Une position GPS d'arrivée est communiquée aux pilotes, sans itinéraire imposé. Un checkpoint obligatoire doit être franchi : un organisateur vérifie chaque passage."
  },
  "finale": {
    "title": "Finale",
    "text": "{finalists_total} pilotes. Une course décisive. Les {elite_count} premiers deviennent les pilotes Elite de la saison."
  },
  "tiebreak": {
    "title": "Égalités",
    "text": "En cas d'égalité de points à la limite de qualification, aucune place n'est attribuée au hasard : le départage est décidé et justifié par les organisateurs."
  },
  "challenge": {
    "title": "Challenge Elite",
    "text": "Tout pilote peut défier un membre Elite. Le duel se court en {challenge_format}.",
    "steps": [
      "Contacter Sullivan ou Nyra pour lancer un défi.",
      "Exposer sa demande et attendre la validation.",
      "Si le défi est accepté, Blacklane organise une rencontre officielle.",
      "Le challenger affronte le pilote Elite en duel."
    ],
    "win": "Si le challenger gagne, il prend la place du pilote Elite.",
    "lose": "S'il perd, il devra attendre {challenge_cooldown_days} jours avant de pouvoir lancer un nouveau défi."
  },
  "calendar": {
    "title": "Déroulé indicatif d'une saison",
    "items": [
      { "label": "Semaine 1", "text": "Qualification #1" },
      { "label": "Semaine 2", "text": "Qualification #2" },
      { "label": "Semaine 3", "text": "Qualification #3" },
      { "label": "Semaine 4", "text": "Qualification #4" },
      { "label": "Semaine 5", "text": "Phase Élite — Urban Run" },
      { "label": "Semaine 6", "text": "Phase Élite — Navigation" },
      { "label": "Semaine 7", "text": "Finale" },
      { "label": "Semaine 8", "text": "Annonce des Elite · Challenges · inter-saison" }
    ]
  }
}
$json$::jsonb, null, null)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
--  Pied de page et mentions
-- ---------------------------------------------------------------------
insert into public.site_content (key, draft, published, published_at) values ('footer', $json$
{
  "tagline": "Blacklane. Pas une course. Une sélection.",
  "subline": "Bienvenue dans l'ombre.",
  "disclaimer": "Blacklane est un projet de roleplay se déroulant dans un univers fictif (GTA V — serveur FiveM). Les personnages, organisations, lieux et événements décrits sur ce site sont fictifs. Il ne s'agit en aucun cas d'une incitation à la conduite dangereuse ou à des courses illégales dans la vie réelle.",
  "legal": "Éditeur du site : [à compléter par les organisateurs du serveur].\nHébergement du site : Netlify, Inc. — 512 2nd Street, Suite 200, San Francisco, CA 94107, États-Unis.\nBase de données et authentification : Supabase, Inc.",
  "privacy": "Le site public ne dépose aucun cookie publicitaire ni traceur de mesure d'audience. Seuls les comptes organisateurs utilisent un stockage local technique pour maintenir leur session de connexion. Aucune donnée personnelle réelle des joueurs n'est collectée ni publiée : les pilotes apparaissent uniquement sous leur pseudonyme RP."
}
$json$::jsonb, null, null)
on conflict (key) do nothing;

-- Le contenu initial est publié tel quel
do $$
begin
  perform set_config('blacklane.via_rpc', 'on', true);
  update public.site_content set published = draft, published_at = now() where published is null;
  perform set_config('blacklane.via_rpc', '', true);
end $$;
