# Version 1.1.0 – Pièces, profils de hauteur et PDF vectoriel

Cette version regroupe les adaptations accumulées depuis la version 1.0.0.

- Le placement et la recherche automatique tiennent compte des niches et zones inutilisables. Un nouveau circuit commence dans le planificateur de pièce et reçoit directement des coordonnées valides.
- CU, départ/arrivée et rails de ravitaillement plus réalistes, tout en conservant l’aspect des rails. Bordures et accessoires automatiques proposent un aperçu au survol puis une fixation par clic.
- Barre centrale avec centrage des rails sélectionnés. Pose répétée, remplacement, coupures, jonction et raccordement parallèle restent disponibles.
- Vue 3D dans la pièce avec environ 150 mm de passage, rampes douces réglables et profils de hauteur individuels. Hauteurs, longueurs des rampes et pentes sont enregistrées avec le circuit.
- Étiquettes 2D de hauteur/pente modifiables, masquables et adaptées au zoom. Positions manuelles déplaçables, enregistrées et réinitialisables.
- Aperçu avant impression et exports PDF/PNG/SVG conservent les positions visibles. Le PDF contient rails, textures et polices intégrées sous forme vectorielle.
- L’adaptateur expérimental isolé préserve les nouvelles données même avec l’ancien parseur RaceHubOS. Aucune modification du cœur RaceHubOS ; l’interface officielle d’Anselme reste à définir.

## Documentation et validation

[Instructions](../README.fr.md) · [Revue](REVIEW.fr.md) · [Galeries et empreintes](TRACK-PLANNER-GALLERY.md) · [Hauteurs, 3D et export](ROOM-3D.fr.md) · [Accessoires automatiques](AUTOMATIC-ACCESSORIES.fr.md)

Commandes : `npm test`, `npm run test:browser`, `npm run screenshots`, `npm run build`. Les PDF sont également contrôlés pour l’absence d’images matricielles, les polices intégrées et le rendu agrandi. Le fichier `SHA256SUMS` accompagne les téléchargements.

## Paquets et limites

Linux : DEB et TAR.GZ portable avec Node. Windows : ZIP portable avec Node Windows x64 ; aucune exécution sous Windows depuis cette machine Linux. Aucun nouvel installateur EXE ou macOS n’est annoncé pour cette version. Les anciens installateurs ne sont pas la version 1.1.0. Circuits et inventaire sont séparés des fichiers du programme ; l’ancien module local est sauvegardé avant mise à jour.

La compatibilité complète Autorennbahnplaner 2.0 reste non confirmée et les suggestions automatiques de fermeture restent une proposition. La vue 3D est un aperçu de planification. L’avertissement Vite existant sur les gros blocs demeure.
