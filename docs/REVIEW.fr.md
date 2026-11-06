# Revue pour les mainteneurs

[Deutsch](REVIEW.de.md) · [English](REVIEW.md) · **Français**

Ce dépôt possède son propre historique et ne nécessite ni checkout parent RaceHubOS, ni backend, base de données ou migrations. `vendor/racehubos` fournit les sources UI/géométriques nécessaires sous Apache-2.0. `PROVENANCE.json` conserve les chemins d’origine et empreintes SHA-256. Le fichier de verrouillage fixe les dépendances.

## Parcours conseillé

1. Avec Node 22.13+, exécuter `npm ci`, `npm test`, `npm run build`, puis `npm start`.
2. Examiner les [galeries](TRACK-PLANNER-GALLERY.md) et l’interface.
3. Lire la [proposition de capacités](../addons/track-planner/integration/proposal.json), l’[adaptateur historique](../addons/track-planner/src/host/legacyBridge.js) et le [raccordement remplaçable](../addons/track-planner/src/EmbeddedPlanner.jsx).
4. Discuter du [transfert du circuit](../addons/track-planner/src/host/layoutHandoff.js) et de l’[exemple de secteurs](../addons/track-planner/integration/layout-handoff.example.json).

L’interface officielle, le téléchargement, les mises à jour, les autorisations et l’affichage des secteurs côté hôte relèvent de la conception d’Anselme. Le protocole iframe existant est une compatibilité expérimentale. Le format de transfert est une proposition, pas un contrat déjà adopté par RaceHubOS. Aucun nouveau correctif du cœur n’est nécessaire pour compiler ou lancer l’application autonome.

## Préparation vérifiée

- Installation fraîche à partir du fichier de verrouillage et build autonome.
- Quatre fichiers de tests inclus, avec 22 cas ciblés : géométrie, cadrage, remplacement, raccordement, adaptateur et transfert.
- 33 cas navigateur externes contre le build indépendant, couvrant DE/EN/FR, vue responsive, thèmes et fonctions existantes.
- Trois scénarios de capture externes : 57 véritables PNG avec manifestes SHA-256.
- Paquets Linux DEB/TAR construits pendant la préparation ; UI comparée octet par octet au build. Quatre cas thème/compatibilité ont réussi contre le DEB extrait. Cette publication ne joint pas de nouvelle archive GitHub Release.
- Vérification dans l’hôte existant du PC de course via son adaptateur expérimental, sans enregistrer de circuit.

Le dispositif navigateur/captures externe reste dans le [checkout de préparation fixé](https://github.com/WillibaldSoft/RaceHubOS/tree/fa038fff3327b7796ea0c14d2797714c35359335). Ici, `npm test` exécute les quatre fichiers unitaires inclus. Cette publication ajoute documentation et images ; les sources d’exécution et dépendances verrouillées restent celles vérifiées.

## Limites

L’API officielle reste à définir. Le JSON conserve tout le circuit ; le placement libre ne peut pas être exporté en ancien TRK. Une compatibilité complète Autorennbahnplaner 2.0 n’est pas confirmée. L’AKS décrit une installation, sans simuler l’électronique. Un raccordement géométrique ne garantit ni la fermeture d’autres écarts ni la faisabilité réelle. Les suggestions automatiques de rails ne sont pas encore implémentées. L’avertissement Vite sur la taille des chunks demeure. Cette publication ne valide pas de nouvelle exécution ni d’installateur Windows/macOS.

Licence et provenance : [LICENSE](../LICENSE), [licence des sources fournies](../vendor/racehubos/LICENSE), [PROVENANCE.json](../PROVENANCE.json).
