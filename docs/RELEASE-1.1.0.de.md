# Version 1.1.0 – Raum, Höhenprofile und Vektor-PDF

Die seit Version 1.0.0 gesammelten Anpassungen werden gemeinsam veröffentlicht.

- Raumkontur mit Nischen und nicht nutzbaren Flächen wird bei Platzierung und automatischer Streckensuche berücksichtigt. Neue Bahnen starten im Raumplaner; abgelegte Bahnen besitzen gültige Koordinaten.
- Realistischere Control Unit, Start/Ziel und Tankschienen bei beibehaltener Schienenoptik. Automatische Randstreifen und Anbauteile erscheinen beim Überfahren mit der Maus und lassen sich mit Vorschau anfügen.
- Zentrale Werkzeugleiste einschließlich Zentrieren markierter Schienen. Vorhandene Funktionen für Mehrfachlegen, Ersetzen, Trennpunkte, Zusammenfügen und paralleles Andocken bleiben erhalten.
- 3D-Ansicht im Raum mit etwa 150 mm Durchfahrtshöhe, sanften und einstellbaren Rampen sowie individuellen Höhenprofilen. Höhen, Rampenlängen und daraus folgende Steigungen werden mit der Bahn gespeichert.
- Höhen-/Steigungswerte sind in 2D ausblendbar, bearbeitbar, zoomabhängig angeordnet und manuell verschiebbar. Manuelle Positionen lassen sich automatisch zurücksetzen und werden gespeichert.
- Druckvorschau und PDF/PNG/SVG übernehmen die sichtbaren Beschriftungspositionen. PDF enthält Vektorschienen, Oberflächenmuster und eingebettete Schriften statt einer Rasteraufnahme.
- Der isolierte Legacy-Adapter erhält die neuen Szenen- und Beschriftungsdaten auch durch den älteren RaceHubOS-Parser. Keine Änderung am RaceHubOS-Kern; Anselmes offizielle Plugin-Schnittstelle bleibt offen.

## Unterlagen und Prüfung

[Anleitung](../README.de.md) · [Review](REVIEW.de.md) · [Galerien und Prüfsummen](TRACK-PLANNER-GALLERY.md) · [Höhen, 3D und Export](ROOM-3D.de.md) · [Automatisches Zubehör](AUTOMATIC-ACCESSORIES.de.md)

Prüfbefehle: `npm test`, `npm run test:browser`, `npm run screenshots`, `npm run build`. Für PDF werden zusätzlich Bildfreiheit, eingebettete Schriften und vergrößerte Renderings geprüft. Paketprüfsummen stehen in `SHA256SUMS` der Release-Downloads.

## Pakete und Grenzen

Linux: DEB und portables TAR.GZ mit Node-Laufzeit. Windows: portables ZIP mit Windows-x64-Laufzeit; auf diesem Linux-Rechner nicht unter Windows ausgeführt. Für diese Version werden keine neuen EXE- oder macOS-Installer behauptet. Vorhandene ältere Installer gehören nicht zu Version 1.1.0. Benutzerbahnen und Inventar sind von Programmdateien getrennt; vor der lokalen Aktualisierung wird das bisherige Add-on gesichert.

Vollständige Autorennbahnplaner-2.0-Kompatibilität und automatische Teileempfehlungen zum Schließen sind weiterhin nicht bestätigt beziehungsweise noch Vorschläge. Die 3D-Ansicht ist eine Planungsvorschau. Der vorhandene Vite-Hinweis auf große Chunks bleibt bestehen.
