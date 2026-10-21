# BLACKLANE

> « Ils cherchent des coureurs. Nous cherchons des pilotes. »
> Blacklane n'est pas une course. C'est une sélection.

Plateforme officielle de **Blacklane**, ligue clandestine de courses automobiles d'un serveur **GTA V FiveM Roleplay**.
Univers entièrement fictif. Site public en français, responsive, avec back-office sécurisé et données persistantes.

| Couche | Choix |
| --- | --- |
| Front-end | React 19 + TypeScript, Vite 7, Tailwind CSS 4 |
| Données / auth | Supabase (PostgreSQL, Auth, Storage, Row Level Security) |
| Graphiques | d3-scale / d3-shape (composants SVG maison, thème sombre) |
| Hébergement | Netlify (site statique + 1 fonction serveur) |
| Routage | routeur léger interne (`src/lib/router.tsx`), sans dépendance |
| Polices | Barlow Condensed, Barlow, JetBrains Mono — auto-hébergées (`public/fonts`, licence OFL) |

---

## 1. Ce que contient le projet

```
supabase/
  migrations/            4 migrations SQL à appliquer dans l'ordre
    …0100_schema.sql     tables, contraintes, index
    …0200_logic.sql      calcul des points, déclencheurs, vues publiques, RPC
    …0300_security.sql   RLS, privilèges, bucket de stockage « media »
    …0400_defaults.sql   paramètres, barème officiel, contenus initiaux
  seed_demo.sql          données de démonstration (facultatives, purgeables)
  tests/                 tests SQL automatisés (75 vérifications)
netlify/functions/
  admin-invite.mjs       invitation d'organisateurs (clé service_role côté serveur)
src/
  pages/public/          Accueil, Classement, Fiche pilote, Calendrier, Épreuve,
                         Qualifications, Règlement, Mentions
  pages/admin/           Back-office (14 écrans)
  lib/                   client Supabase, API, calculs (scoring.ts), formats…
  components/            interface, graphiques, éléments de course
```

### Site public
- **Accueil** : hero (décor vectoriel ou image choisie dans le back-office), compteurs réels, classement, prochaines courses avec compte à rebours, timeline des phases, organisateurs (alias RP), derniers podiums, rappel du règlement.
- **Classement** : recherche, tri (points, victoires, podiums, courses), filtres saison / rang / statut, vues *Général*, *Qualifications*, *Élite*, *Finale*. Égalités = même position.
- **Fiche pilote** : statistiques, parcours de la saison, courbes de progression (points cumulés, position), historique complet.
- **Calendrier** : vue liste (à venir / passés) et vue mensuelle, filtres type / phase / statut, fiches détaillées ; annulés et reportés clairement signalés (date initiale conservée).
- **Qualifications** : règles illustrées, barème, état en direct des sessions, classements des groupes Élite, finalistes, Elite, Challenges récents.
- **Règlement** : sections repliables, tableau des sanctions configurable.
- **Mentions** : univers fictif, éditeur / hébergeurs, confidentialité.

Aucun nom civil n'est stocké pour les pilotes ; les organisateurs apparaissent sous leurs alias (Sullivan, Nyra).

### Back-office (`/admin/login`)
| Écran | Rôle minimum |
| --- | --- |
| Tableau de bord, actions rapides | éditeur |
| Courses : création, publication, report, annulation, suppression confirmée, participants | éditeur |
| **Saisie des résultats** (points calculés en direct, pénalités justifiées, checkpoint Navigation) | admin |
| Pilotes : profil, statut, archivage, notes internes, historique des rangs | éditeur |
| Rang manuel et corrections de points justifiées | admin |
| **Phases & sélection** : qualifiés par session, groupes Élite (répartition auto), finalistes, Elite de la saison | admin |
| Challenges Elite : demande → validation → programmation → résultat (rangs mis à jour), forfait | admin |
| Contenus : accueil, qualifications, règlement & sanctions, mentions — brouillon, aperçu, publication | éditeur |
| Barèmes & paramètres (sans toucher au code), recalcul | admin |
| Saisons : création, activation, clôture (archives figées), réouverture (owner) | admin |
| Statistiques : 7 graphiques, filtres saison / phase / période / pilotes | éditeur |
| Journal des actions sensibles | admin |
| Export JSON complet, export CSV du classement | admin |
| Organisateurs (invitation, rôles, suspension), purge de la démo | owner |

### Règles de calcul (appliquées dans la base, pas dans le navigateur)
- Points = barème de l'épreuve → sinon celui de la saison → sinon barème par défaut. Position hors barème = 0. Abandon / disqualification / absence = 0. Pénalité ou bonus : motif obligatoire.
- Une seule ligne par (épreuve, pilote) : réenregistrer ou recalculer ne compte jamais deux fois.
- Positions uniques et consécutives ; capacité par session (10) ; un pilote déjà qualifié ne recourt pas une session ; seuls les pilotes du groupe courent son Urban Run / sa Navigation ; un pilote classé en Navigation doit avoir validé le checkpoint.
- Sélections : un pilote retenu n'est jamais moins bien classé qu'un pilote écarté. **Égalité à la limite → départage explicite et motivé par un administrateur**, aucune place attribuée au hasard (ou « meilleure place, puis manuel » si ce mode est choisi).
- Rangs : validation des qualifiés → **Runner** ; finalistes → **Challenger** ; finale → **Elite**. Chaque changement est historisé.
- Une modification de barème recalcule automatiquement les saisons non clôturées. Une saison clôturée est figée.
- Toute correction de résultats déjà utilisés pour une sélection exige d'annuler d'abord la sélection (cohérence garantie).

> **Choix d'interprétation** : le dossier staff et le moodboard divergent légèrement sur « Runner / Challenger ». Le site suit le dossier : *Runner* = l'un des 12 qualifiés ; *Challenger* = finaliste (top 3 de son groupe) ; *Elite* = top 3 de la finale. Les textes publics de ces rangs sont modifiables dans **Contenus**.

---

## 2. Installation locale

Prérequis : Node.js ≥ 20.19 (22 recommandé), un projet Supabase.

```bash
npm install
cp .env.example .env      # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev               # http://localhost:5173
```

Commandes utiles :

| Commande | Effet |
| --- | --- |
| `npm run build` | vérification TypeScript + build de production dans `dist/` |
| `npm run preview` | sert le build localement |
| `npm test` | tests unitaires des calculs (`src/lib/scoring.test.ts`) |
| `npm run test:db` | rejoue migrations + démo + 75 tests SQL sur un PostgreSQL **local jetable** (`PGHOST`, `PGPORT`, `PGUSER`) |

La fonction d'invitation ne tourne pas avec `npm run dev` ; utilisez `npx netlify dev` pour la tester localement.

---

## 3. Mise en place de Supabase

1. **Créer le projet** sur <https://supabase.com> (région UE conseillée).
2. **Appliquer les migrations**, au choix :
   - *Éditeur SQL* (Dashboard → SQL Editor) : exécuter les 4 fichiers de `supabase/migrations/` **dans l'ordre** ;
   - *CLI* : `npx supabase link --project-ref <ref>` puis `npx supabase db push`.
3. **Données de démonstration (facultatif)** : exécuter `supabase/seed_demo.sql`. Tout est marqué `is_demo` ; suppression en un clic (Export & données → *Purger la démo*) ou `select public.purge_demo_data();`.
4. **Authentification** (Authentication → Providers / Settings) :
   - garder *Email* activé, **désactiver les inscriptions** (« Allow new users to sign up » = off) ;
   - URL Configuration → *Site URL* : `https://votre-site.netlify.app` ;
   - *Redirect URLs* : `https://votre-site.netlify.app/admin/reinitialiser` (+ `http://localhost:5173/admin/reinitialiser` pour le développement) ;
   - configurer un SMTP (Project Settings → Auth → SMTP) pour des e-mails d'invitation fiables.
5. **Premier organisateur (owner)** :
   - Authentication → Users → *Add user* (e-mail + mot de passe, « Auto confirm ») ;
   - puis dans l'éditeur SQL :
     ```sql
     insert into public.admin_users (user_id, display_name, role)
     select id, 'Sullivan', 'owner' from auth.users where email = 'votre-adresse@exemple.fr';
     ```
   Les organisateurs suivants s'invitent depuis **Back-office → Organisateurs**.
6. **Clés** : Project Settings → API → URL du projet et clé `anon` (publique) pour le front ; clé `service_role` uniquement dans Netlify.

Sécurité en place : RLS sur toutes les tables, lecture publique limitée aux épreuves publiées et terminées, aucune écriture possible sans compte présent dans `admin_users`, résultats / sélections / issues de défis modifiables uniquement par des fonctions SQL qui vérifient le rôle, fonctions d'administration non exécutables par `anon`, journal non modifiable, au moins un owner actif garanti.

---

## 4. Déploiement sur Netlify

Le dépôt est prêt (`netlify.toml` : build `npm run build`, publication `dist`, fonctions `netlify/functions`, Node 22, redirection SPA, en-têtes de sécurité et de cache).

1. Pousser le dépôt sur GitHub / GitLab :
   ```bash
   git remote add origin git@github.com:<compte>/blacklane.git
   git push -u origin main
   ```
2. Netlify → *Add new site* → *Import an existing project* → choisir le dépôt. Les réglages sont lus depuis `netlify.toml`.
3. Site configuration → **Environment variables** :

   | Variable | Valeur | Secret |
   | --- | --- | --- |
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | non |
   | `VITE_SUPABASE_ANON_KEY` | clé anon | non (publique par conception) |
   | `SUPABASE_URL` | `https://<ref>.supabase.co` | non |
   | `SUPABASE_SERVICE_ROLE_KEY` | clé service_role | **oui** — scope « Functions » uniquement |
   | `SITE_URL` | `https://votre-site.netlify.app` | non |

4. *Deploy*. Chaque push sur `main` redéploie automatiquement.
5. Reporter l'URL Netlify définitive dans Supabase (étape 3.4) puis vérifier avec la checklist (`docs/CHECKLIST.md`).

Domaine Supabase personnalisé ? Ajoutez-le aux directives `img-src` / `connect-src` de la Content-Security-Policy dans `netlify.toml`.

---

## 5. Utilisation du back-office — déroulé d'une saison

1. **Saisons** → créer « Saison 2 », l'**activer**.
2. **Courses** → créer les 4 *Qualification* (session 1 à 4), les *Urban Run* et *Navigation* des groupes A et B, la *Finale*. Cocher « Publié ».
3. **Pilotes** → enregistrer les Prospects invités, les inscrire dans l'onglet *Participants* de leur session.
4. Après chaque session : onglet **Résultats** → ordonner les pilotes (flèches), statut, pénalités → *Valider : course terminée*.
5. **Phases & sélection** → valider les 3 qualifiés de chaque session (départage motivé en cas d'égalité), puis *Répartition automatique* des groupes → *Enregistrer les groupes* (inscription automatique aux épreuves Élite).
6. Saisir Urban Run et Navigation → valider les finalistes de chaque groupe (inscription automatique à la finale).
7. Saisir la finale → *Couronner les pilotes Elite*.
8. **Challenges Elite** tout au long de la saison.
9. **Saisons** → *Clôturer* : tout est archivé et reste consultable dans le classement.

Contenus : modifier → *Aperçu* → *Publier*. Les textes acceptent des variables (`{sessions_count}`, `{elite_count}`…) remplacées par les paramètres actuels.

---

## 6. Données et confidentialité

- Visiteurs : aucun cookie, aucun traceur, aucune police ni script tiers.
- Organisateurs : session conservée en stockage local technique.
- Export JSON complet et CSV depuis le back-office ; sauvegardes automatiques Supabase selon l'offre.
- À compléter avant ouverture : **éditeur du site** dans Contenus → Pied de page & mentions (obligation légale).

Projet de roleplay : aucune incitation à la conduite dangereuse dans la vie réelle.
