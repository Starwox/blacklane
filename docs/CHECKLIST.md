# Checklist avant mise en production

Cochez chaque point sur le site **déployé** (URL Netlify), avec de vrais comptes.

## Configuration
- [ ] Les 4 migrations sont appliquées dans l'ordre, sans erreur.
- [ ] Variables Netlify renseignées ; `SUPABASE_SERVICE_ROLE_KEY` n'est **pas** préfixée `VITE_`.
- [ ] Dans le navigateur (outils de développement → Sources), rechercher `service_role` : aucun résultat.
- [ ] Supabase Auth : inscriptions désactivées, Site URL et Redirect URLs = domaine Netlify.
- [ ] SMTP configuré ; une invitation de test arrive et le lien mène à `/admin/reinitialiser`.
- [ ] Au moins deux comptes owner (secours si un compte est perdu).
- [ ] Mentions : éditeur du site complété puis publié.

## Sécurité
- [ ] Déconnecté, `/admin` redirige vers `/admin/login`.
- [ ] Un compte Supabase sans ligne `admin_users` voit « Compte non autorisé ».
- [ ] Un éditeur ne peut ni saisir de résultats ni accéder à Phases / Paramètres.
- [ ] Un admin ne voit pas l'écran Organisateurs ni la purge.
- [ ] Requête directe sans connexion (remplacer `<ref>` et `<anon>`) :
      `curl "https://<ref>.supabase.co/rest/v1/results" -H "apikey: <anon>"` → *permission denied*.
- [ ] `curl -X POST "https://<ref>.supabase.co/rest/v1/pilots" -H "apikey: <anon>" -H "Content-Type: application/json" -d '{"pseudonym":"x"}'` → refusé.
- [ ] La page publique d'un événement non publié renvoie « introuvable ».

## Calculs (sur une saison de test)
- [ ] Résultats d'une session : 10 / 8 / 6 / 5 / 4 / 3 / 2 / 1 / 0 / 0 ; abandon = 0.
- [ ] Réenregistrer les mêmes résultats ne change pas le classement.
- [ ] Pénalité sans motif refusée ; avec motif, le total est corrigé.
- [ ] Navigation : pilote classé sans checkpoint refusé.
- [ ] Positions non consécutives refusées ; 11e pilote dans une session refusé.
- [ ] Modifier le barème recalcule les points ; une saison clôturée reste inchangée.
- [ ] Égalité à la 3e place : validation impossible sans motif de départage.
- [ ] Qualifiés → rang Runner ; finalistes → Challenger ; finale → Elite ; historique visible sur la fiche pilote (back-office).
- [ ] Challenge gagné : rangs échangés ; perdu : nouveau défi bloqué pendant le délai configuré.

## Contenu et affichage
- [ ] Modifier un texte de l'accueil → Aperçu → Publier → visible sur le site public.
- [ ] Image de hero envoyée depuis le back-office et affichée.
- [ ] Événement reporté : date initiale affichée ; annulé : barré avec motif.
- [ ] Compteurs de l'accueil = données réelles (0 et message neutre si aucune course).
- [ ] Statistiques : état vide propre sans résultats ; graphiques à jour après une saisie.
- [ ] Mobile (≈ 390 px) : menu, classement, calendrier, fiche pilote, back-office utilisables, pas de défilement horizontal.
- [ ] Navigation clavier : focus visible, fenêtres fermables avec Échap.

## Avant ouverture
- [ ] Sauvegarde JSON téléchargée (Export & données).
- [ ] **Démo purgée** : le badge « Démo » a disparu du site.
- [ ] Une vraie saison est créée et active.
- [ ] Journal : les actions des tests apparaissent avec le bon auteur.
