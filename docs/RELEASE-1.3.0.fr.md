# Version 1.3.0 – Rampes 3D continues et propositions de pentes

- Centrer la vue en conservant le zoom et les angles de caméra.
- Transitions de hauteur progressives activées par défaut, y compris pour les plans existants.
- Le calcul des rampes utilise la tolérance de connexion de l’éditeur : les petits décalages importés ne séparent plus les rampes.
- Dans « 3D → Propositions de pentes », choisir une pente maximale et consulter les longueurs réelles, les pentes et les rails concernés avant application. Appliquer la montée et la descente séparément ou ensemble. Les limites d’espace sont indiquées ; les hauteurs individuelles sont préservées.
- Comptage correct des paires d’entrées et de sorties des stands placées séparément, sans compter deux fois les représentations des rails porteurs.

Vérifié sur un plan Fröhlichring enregistré : une descente de 160 mm sur 2 000 mm utilise sept rails (8 % en moyenne, 15 % maximum), avec des raccords de hauteur continus et 150 mm de passage aux trois croisements. Cet exemple de planification ne modifie pas les plans des utilisateurs ; appliquer et enregistrer les longueurs dans chaque plan.

Paquets : Linux x64 portable, Debian amd64, Windows x64 portable, extension RaceHubOS et paquet de mise à jour intégré. Les plans existants sont conservés. Contenu du paquet Windows vérifié ; exécution native Windows indisponible ici. Aucun nouvel installateur EXE ni paquet macOS.
