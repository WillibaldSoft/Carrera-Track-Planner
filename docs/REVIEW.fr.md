# Revue pour les mainteneurs

[Deutsch](REVIEW.de.md) · [English](REVIEW.md) · **Français**

Ce dépôt possède son propre historique et ne nécessite ni checkout parent RaceHubOS, ni backend, base de données ou migrations. `vendor/racehubos` fournit les sources UI/géométriques nécessaires sous Apache-2.0. `PROVENANCE.json` conserve les chemins d’origine et empreintes SHA-256. Le fichier de verrouillage fixe les dépendances.

## Parcours conseillé

1. Avec Node 22.13+, exécuter `npm ci`, `npm test`, `npm run build`, puis `npm start`.
2. Examiner les [galeries](TRACK-PLANNER-GALLERY.md) et l’interface.
3. Lire la [proposition de capacités](../addons/track-planner/integration/proposal.json), l’[adaptateur historique](../addons/track-planner/src/host/legacyBridge.js) et le [raccordement remplaçable](../addons/track-planner/src/EmbeddedPlanner.jsx).
4. Discuter du [transfert du circuit](../addons/track-planner/src/host/layoutHandoff.js) et de l’[exemple de secteurs](../addons/track-planner/integration/layout-handoff.example.json).

L’interface officielle, le téléchargement, les mises à jour, les autorisations et l’affichage des secteurs côté hôte relèvent de la conception d’Anselme. Le protocole iframe existant est une compatibilité expérimentale. Le format de transfert est une proposition, pas un contrat déjà adopté par RaceHubOS. Aucun nouveau correctif du cœur n’est nécessaire pour compiler ou lancer l’application autonome.

## État vérifié

111 cas unitaires dans seize fichiers ont réussi. La suite navigateur contient 83 cas : 82 ont réussi au passage complet ; le premier démarrage affecté par la compilation parallèle a ensuite réussi avec les 15 cas finaux de démarrage, export et intégration sur la compilation terminée. 18 scénarios réussis fournissent 150 PNG. L’ancien parseur hôte réel préserve hauteurs, rampes et positions manuelles via l’adaptateur. La compilation Vite/module réussit ; l’avertissement sur les gros blocs demeure. Commandes : `npm test`, `npm run test:browser`, `npm run screenshots`, `npm run build`.

[CU fixe, éléments des stands et alignement parallèle](CU-PIT-PARALLEL.fr.md)

## Limites

L’API officielle reste à définir. Le JSON conserve tout le circuit ; le placement libre ne peut pas être exporté en ancien TRK. Une compatibilité complète Autorennbahnplaner 2.0 n’est pas confirmée. L’AKS décrit une installation, sans simuler l’électronique. Un raccordement géométrique ne garantit ni la fermeture d’autres écarts ni la faisabilité réelle. Les suggestions automatiques de rails ne sont pas encore implémentées. L’avertissement Vite sur la taille des chunks demeure. Cette publication ne valide pas de nouvelle exécution ni d’installateur Windows/macOS.

Licence et provenance : [LICENSE](../LICENSE), [licence des sources fournies](../vendor/racehubos/LICENSE), [PROVENANCE.json](../PROVENANCE.json).


[Contour de la pièce et choix du local en premier](ROOM-FOOTPRINT.fr.md)


[CU, départ/arrivée et ravitaillement](UNIT-APPEARANCE.md)


[Accessoires automatiques et barre d’outils centrale](AUTOMATIC-ACCESSORIES.fr.md)

[Vue 3D dans la pièce](ROOM-3D.fr.md) — 150 mm de passage libre, aperçu local.
