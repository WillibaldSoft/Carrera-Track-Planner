# Review für Maintainer

**Deutsch** · [English](REVIEW.md) · [Français](REVIEW.fr.md)

Dieses Repository besitzt eine eigene Historie und benötigt weder ein übergeordnetes RaceHubOS-Checkout noch dessen Backend, Datenbank oder Migrationen. `vendor/racehubos` enthält benötigte UI-/Geometriequellen mit Apache-2.0-Lizenz. `PROVENANCE.json` dokumentiert Originalpfade und SHA-256-Prüfsummen; die Abhängigkeiten sind durch die Lockdatei festgelegt.

## Empfohlener Einstieg

1. Mit Node 22.13+ `npm ci`, `npm test`, `npm run build` und `npm start` ausführen.
2. Die [Galerien](TRACK-PLANNER-GALLERY.md) und die Oberfläche prüfen.
3. Den [Fähigkeitenvorschlag](../addons/track-planner/integration/proposal.json), den [Legacy-Adapter](../addons/track-planner/src/host/legacyBridge.js) und die [austauschbare Anbindung](../addons/track-planner/src/EmbeddedPlanner.jsx) lesen.
4. [Layout-Übergabe](../addons/track-planner/src/host/layoutHandoff.js) und [Sektorenbeispiel](../addons/track-planner/integration/layout-handoff.example.json) abstimmen.

Die offizielle Plugin-Schnittstelle sowie Download, Updates, Berechtigungen und Sektorenanzeige auf Host-Seite liegen bei Anselme. Das vorhandene iframe-Protokoll ist experimentelle Kompatibilität. Das Übergabeformat ist ein Vorschlag, kein bereits übernommener RaceHubOS-Vertrag. Zum eigenständigen Bauen und Starten ist kein neuer Core-Patch nötig.

## Verifizierter Vorbereitungsstand

- Frische Installation anhand der Lockdatei und eigenständiger Build.
- Vier enthaltene Testdateien mit 22 gezielten Fällen für Geometrie, Ansicht, Austausch, Zusammenfügen, Adapter und Übergabe.
- 33 externe Browserfälle gegen den unabhängigen Build, einschließlich DE/EN/FR, responsiver Ansicht, Themes und bisheriger Editorfunktionen.
- Drei externe Aufnahme-Szenarien mit 57 echten PNGs und SHA-256-Manifesten.
- Während der Vorbereitung erstellte Linux-DEB/TAR-Dateien; UI-Inhalte byteweise mit dem Build verglichen. Vier Theme-/Legacy-Fälle gegen das extrahierte DEB bestanden. Diese Veröffentlichung hängt keine neue GitHub-Release-Datei an.
- Live-Prüfung im bisherigen Renn-PC-Host über dessen experimentellen Adapter, ohne eine Strecke zu speichern.

Der externe Browser-/Screenshot-Prüfaufbau liegt im [festgehaltenen Vorbereitungscheckout](https://github.com/WillibaldSoft/RaceHubOS/tree/fa038fff3327b7796ea0c14d2797714c35359335). `npm test` dieses Repositories führt die vier enthaltenen Unit-Testdateien aus. Die Veröffentlichung ergänzt Dokumentation und Bilder; Laufzeitquellen und Lockdatei bleiben auf dem geprüften Stand.

## Grenzen

Die offizielle API steht aus. JSON erhält den vollständigen Plan; freies Platzieren lässt sich nicht in altes TRK exportieren. Eine vollständige Autorennbahnplaner-2.0-Kompatibilität ist nicht bestätigt. AKS ist eine Einbauangabe, keine Elektroniksimulation. Geometrisches Zusammenfügen garantiert weder das Schließen weiterer Lücken noch reale Baubarkeit. Automatische Schließvorschläge sind noch nicht implementiert. Der Vite-Hinweis auf große Chunks bleibt. Windows-/macOS-Ausführung und entsprechende Installer wurden durch diese Veröffentlichung nicht neu geprüft.

Lizenz und Herkunft: [LICENSE](../LICENSE), [Vendor-Lizenz](../vendor/racehubos/LICENSE), [PROVENANCE.json](../PROVENANCE.json).
