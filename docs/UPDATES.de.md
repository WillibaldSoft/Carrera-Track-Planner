# Updates und Wiederherstellung

Öffne **Updates** im Startfenster oder in der Kopfzeile des Vollbild-Editors. Die installierte Version bleibt sichtbar. **Nach Updates suchen** vergleicht mit der neuesten stabilen Veröffentlichung im eigenen GitHub-Repository. Vorabversionen und ältere Versionen werden nicht zur Installation angeboten. Änderungen werden, soweit im Release vorhanden, passend zur Sprache angezeigt.

**Beim Start nach Updates suchen** ist anfangs ausgeschaltet und wird im jeweiligen Browser gespeichert, getrennt für eigenständigen Planer und Add-on. Aktivieren erlaubt nur die Prüfung beim Öffnen. Es erfolgt weder ein automatischer Download noch eine automatische Installation. Ohne Netzwerk bleibt der Planer nutzbar; Fehler und GitHub-Anfragebegrenzungen werden angezeigt.

## Eigenständigen Planer aktualisieren

Die erste Version mit integriertem Updater, **1.2.0**, einmal normal installieren. Danach unterstützen beschreibbare portable Linux-/Windows-Installationen und die verwaltete Installation im Benutzerverzeichnis direkte Anwendungsupdates. Die Anwendung prüft den Installationsmodus; Quellcode-Checkouts und Debian-Systeminstallationen werden nicht im Hintergrund überschrieben.

1. Offene Änderungen speichern oder den Editor schließen.
2. Nach Updates suchen und die Änderungen lesen.
3. **Installieren und neu starten** anklicken. Erst jetzt beginnt der Download.
4. Der SHA-256-Wert muss mit dem GitHub-Asset-Digest und der veröffentlichten SHA256SUMS übereinstimmen. Zusätzlich wird jede Datei im Anwendungspaket geprüft; unzulässige Pfade, fehlende Dateien, Laufzeitanforderungen und ungültige Skripte werden abgelehnt.
5. Die bisherige Anwendung und `plans.json` werden gesichert. Eine eigene Prüfsummenliste kontrolliert die Sicherung vor Änderungen.
6. Die Anwendung wird ersetzt und mit derselben Node-Laufzeit neu gestartet. Ein separater Prozess prüft Version und Prozess-ID. Startet die neue Version nicht, wird die geprüfte alte Anwendung wiederhergestellt und gestartet.

Die Daten bleiben im bisherigen Datenverzeichnis. Eine Rückkehr zur alten Anwendung überschreibt keine inzwischen neueren gespeicherten Bahnen. Node selbst wird nicht ersetzt; bei einer neueren erforderlichen Laufzeit ist das vollständige Installationspaket nötig. Ordnernamen einer portablen Installation können die ursprüngliche Versionsnummer behalten; maßgeblich ist die angezeigte installierte Version.

## Systempaket und RaceHubOS-Add-on

Bei einem Debian-Systempaket bleibt der Paketmanager zuständig. Das Updatefenster bietet den passenden Download und die Veröffentlichung mit SHA256SUMS. Diese manuelle Installation außerhalb des Planers ist separat zu prüfen.

Mit der lokalen RaceHubOS-Erweiterung ist **Direkt in RaceHubOS installieren** verfügbar. Die Erweiterung lädt das offizielle Add-on-Paket intern, prüft die GitHub- und SHA256SUMS-Prüfsummen, sichert Planer, Datenbank und Host-Build und führt die bestehende lokale Updateprüfung aus. Erst danach wird die Planeransicht neu geladen. Bei einem Fehler werden die vorherigen Programmdateien wiederhergestellt; gespeicherte Pläne werden nicht zurückgesetzt. Laufende Sitzungen und ungespeicherte Änderungen sperren die Installation. Ohne diese Host-Funktion bleibt der manuelle Add-on-Download verfügbar.

## Wiederherstellung

Im Updatefenster stehen Status, Sicherungspfad und diese Anleitung. Sicherungen werden unter `update-backups/<Zeit-ID>` im eigenständigen Datenverzeichnis aufbewahrt; sie werden nicht automatisch gelöscht. Dort liegen `job.json`, `backup-manifest.json`, die alte Anwendung unter `application/` und gegebenenfalls die Datensicherung `plans.json`.

Bei einem normalen Startfehler erfolgt die Rückkehr automatisch. Nach einem unterbrochenen Update kann die alte Anwendung manuell wiederhergestellt werden: zunächst alle betroffenen Planerprozesse beenden, dann mit der unveränderten Node-Laufzeit den gesicherten Wiederherstellungshelfer aufrufen:

```text
<Programmordner>/node <Sicherung>/application/updater/restart.mjs --restore <Sicherung>/job.json
```

Unter Windows `node.exe` verwenden und Pfade mit Leerzeichen in Anführungszeichen setzen. Danach den üblichen Starter öffnen. Der Helfer prüft die Sicherung vor Änderungen und stellt ausschließlich Anwendungsdateien wieder her. Eine beschädigte Sicherung wird abgelehnt; dann das offizielle vollständige Paket installieren und das Datenverzeichnis erhalten.

Wurde vor der ersten vollständigen Sicherung abgebrochen, gibt es noch keine `job.json`; die Anwendung wurde dann noch nicht ersetzt. Nach Beenden aller Planerprozesse kann die zurückgebliebene Datei `.planner-update.lock` im Programmordner entfernt und die Prüfung erneut gestartet werden. Eigene Bahn- und Bestandsdateien nicht löschen.

Windows-Pakete werden gebaut; ein nativer Windows-Laufzeittest ist in dieser Linux-Umgebung nicht verfügbar. Linux-Installation, wirklicher Prozessneustart und automatischer Rückfall werden in isolierten Testinstallationen geprüft.

Die Anleitung liegt auch offline unter `dist/update-guides/de.txt` im Programmordner. Ohne abweichende Konfiguration liegt der Datenspeicher unter Linux in `~/.local/share/racehubos-track-planner`, unter Windows in `%LOCALAPPDATA%\racehubos-track-planner`. Ein gesetztes `RACEHUBOS_PLANNER_DATA_DIR` hat Vorrang.


Bereits heruntergeladene `Carrera-Track-Planner-update.json` lassen sich im Updatefenster über **Update-Datei installieren** direkt auswählen und installieren. Die Datei wird gegen die neueste offizielle Veröffentlichung und deren SHA-256-Prüfsummen geprüft; Sicherung und Neustart erfolgen wie beim Online-Update. Add-on- und Bahnplan-JSON-Dateien werden abgewiesen. Bei einer aktuellen Version wird nichts überschrieben.
