# Mises à jour et récupération

Ouvrir **Mises à jour** sur l’accueil ou dans l’en-tête de l’éditeur plein écran. **Rechercher les mises à jour** compare la version installée à la publication stable la plus récente du dépôt. Les préversions et anciennes versions ne sont pas proposées à l’installation. Les modifications sont sélectionnées dans la langue actuelle si disponibles.

**Rechercher les mises à jour au démarrage** est désactivé initialement et mémorisé dans le navigateur, séparément pour l’application autonome et l’extension. L’activer autorise uniquement la recherche à l’ouverture, jamais un téléchargement ou une installation automatique. Le planificateur reste utilisable hors ligne ; les erreurs réseau et limites GitHub sont signalées.

## Application autonome

Installer une première fois **1.2.0**, première version avec cette fonction, par la procédure habituelle. Ensuite, les installations portables Linux/Windows accessibles en écriture et l’installation gérée dans le dossier utilisateur acceptent les mises à jour directes. Les sources et paquets système Debian ne sont pas écrasés silencieusement.

1. Enregistrer les modifications ou fermer l’éditeur.
2. Rechercher les mises à jour et lire les changements.
3. Cliquer **Installer et redémarrer**. Le téléchargement ne débute qu’à ce clic.
4. SHA-256 doit correspondre à l’empreinte GitHub et aux SHA256SUMS publiés. Chaque fichier est aussi vérifié. Chemins interdits, fichiers manquants, runtime incompatible et scripts invalides sont refusés.
5. L’ancienne application et `plans.json` sont sauvegardés ; les empreintes de sauvegarde sont vérifiées avant modification.
6. L’application est remplacée puis relancée avec le même runtime Node. Un superviseur indépendant vérifie version et identifiant de processus. En cas d’échec, l’ancienne application vérifiée est restaurée et relancée.

Le dossier de données reste inchangé. Le retour à l’application précédente ne remplace jamais des circuits enregistrés plus récemment. Node n’est pas mis à jour ; une exigence de runtime plus récent nécessite le paquet complet. Le nom d’un dossier portable peut garder son ancienne version ; la version affichée fait référence.

## Paquet système et extension RaceHubOS

Les installations Debian restent gérées par le gestionnaire de paquets. Le panneau propose le paquet adapté et les sommes de contrôle de la publication ; cette installation manuelle doit être vérifiée séparément.

Avec l’extension locale RaceHubOS, **Installer directement dans RaceHubOS** télécharge le paquet officiel en interne, vérifie les sommes GitHub et SHA256SUMS, sauvegarde le planificateur, la base et la compilation hôte, puis exécute les contrôles locaux. La vue est rechargée après réussite. En cas d’échec, les anciens fichiers sont rétablis sans restaurer les plans enregistrés. Les sessions actives et modifications non enregistrées bloquent l’installation. Les anciens hôtes gardent le téléchargement manuel.

## Récupération

Le panneau indique l’état, l’emplacement de sauvegarde et ce guide. Les sauvegardes sont conservées dans `update-backups/<date-ID>` du dossier de données autonome, sans suppression automatique. Elles contiennent `job.json`, `backup-manifest.json`, l’ancienne application sous `application/` et éventuellement `plans.json`.

Un échec au démarrage provoque normalement le retour automatique. Après une interruption, arrêter tous les processus du planificateur, puis utiliser le runtime Node inchangé pour lancer l’outil conservé :

```text
<application>/node <sauvegarde>/application/updater/restart.mjs --restore <sauvegarde>/job.json
```

Sous Windows, utiliser `node.exe` et citer les chemins contenant des espaces. Relancer ensuite normalement. L’outil vérifie la sauvegarde et restaure uniquement l’application. Une sauvegarde endommagée est refusée ; installer alors le paquet complet officiel en conservant les données.

Si l’interruption précède une sauvegarde complète, aucun `job.json` n’existe et l’application n’a pas été remplacée. Après arrêt des processus, supprimer le fichier résiduel `.planner-update.lock` dans le dossier de l’application puis réessayer. Ne pas supprimer les circuits ou stocks personnels.

Les paquets Windows sont créés ; un essai Windows natif est indisponible dans cet environnement Linux. L’installation Linux, les redémarrages réels et le retour automatique sont testés dans des installations isolées.

Ce guide est aussi disponible hors ligne dans `dist/update-guides/fr.txt` du dossier de l’application. Par défaut, les données sont dans `~/.local/share/racehubos-track-planner` sous Linux ou `%LOCALAPPDATA%\racehubos-track-planner` sous Windows. `RACEHUBOS_PLANNER_DATA_DIR` permet de changer cet emplacement.


Un fichier `Carrera-Track-Planner-update.json` téléchargé peut être sélectionné via **Installer un fichier de mise à jour**. Il est vérifié contre la dernière publication officielle et ses sommes SHA-256, puis installé avec sauvegarde et redémarrage. Les fichiers JSON d’extension ou de plan sont refusés. La version actuelle n’est pas écrasée.
