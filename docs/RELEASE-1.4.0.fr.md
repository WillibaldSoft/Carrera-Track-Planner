# Version 1.4.0 – Pentes séparées et mises à jour directes dans RaceHubOS

- Régler séparément la montée et la descente en pourcentage. Consulter les longueurs calculées, les pentes maximales réelles et les rails concernés, puis appliquer séparément ou ensemble. La géométrie 3D suit les valeurs appliquées ; les limites d’espace sont indiquées et les raccords de hauteur restent continus.
- Installer directement depuis le planificateur intégré à RaceHubOS, avec vérification du paquet officiel, sauvegarde de l’application et de la base, puis contrôles locaux de compatibilité. Les modifications non enregistrées et sessions actives bloquent l’installation.
- Application autonome : installer `Carrera-Track-Planner-update.json` téléchargé via « Installer un fichier de mise à jour ». Vérification officielle, sauvegarde, redémarrage et retour automatique conservés, y compris pour les fichiers dépassant 4 Mo.

**Prérequis RaceHubOS :** l’installation directe nécessite l’extension locale `carrera-local` pour RaceHubOS **1.32.0** et ses contrôles de mise à jour. **RaceHubOS-Planer-Direktupdate-1.4.0.zip** contient la passerelle, le planificateur et l’installateur. Installer une fois avec RaceHubOS arrêté ; les prochaines mises à jour utilisent le bouton intégré. Les autres hôtes conservent la procédure manuelle. [Instructions](https://github.com/WillibaldSoft/Carrera-Track-Planner/blob/v1.4.0/integrations/racehubos-1.32/README.md).

Paquets : Linux x64 portable, Windows x64 portable, Debian amd64, extension JSON, mise à jour autonome et intégration RaceHubOS 1.32. Les plans existants ne sont pas modifiés. Contenu Windows vérifié ; exécution native Windows indisponible ici. Aucun nouvel installateur EXE ni paquet macOS.
