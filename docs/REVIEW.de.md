# Review für Maintainer

**Deutsch** · [English](REVIEW.md) · [Français](REVIEW.fr.md)

Dieses Repository besitzt eine eigene Historie und benötigt weder ein übergeordnetes RaceHubOS-Checkout noch dessen Backend, Datenbank oder Migrationen. `vendor/racehubos` enthält benötigte UI-/Geometriequellen mit Apache-2.0-Lizenz. `PROVENANCE.json` dokumentiert Originalpfade und SHA-256-Prüfsummen; die Abhängigkeiten sind durch die Lockdatei festgelegt.

## Empfohlener Einstieg

1. Mit Node 22.13+ `npm ci`, `npm test`, `npm run build` und `npm start` ausführen.
2. Die [Galerien](TRACK-PLANNER-GALLERY.md) und die Oberfläche prüfen.
3. Den [Fähigkeitenvorschlag](../addons/track-planner/integration/proposal.json), den [Legacy-Adapter](../addons/track-planner/src/host/legacyBridge.js) und die [austauschbare Anbindung](../addons/track-planner/src/EmbeddedPlanner.jsx) lesen.
4. [Layout-Übergabe](../addons/track-planner/src/host/layoutHandoff.js) und [Sektorenbeispiel](../addons/track-planner/integration/layout-handoff.example.json) abstimmen.

Die offizielle Plugin-Schnittstelle sowie Download, Updates, Berechtigungen und Sektorenanzeige auf Host-Seite liegen bei Anselme. Das vorhandene iframe-Protokoll ist experimentelle Kompatibilität. Das Übergabeformat ist ein Vorschlag, kein bereits übernommener RaceHubOS-Vertrag. Zum eigenständigen Bauen und Starten ist kein neuer Core-Patch nötig.

## Verifizierter Stand

111 Unit-Fälle in sechzehn Dateien bestanden. Die Browser-Suite enthält 83 Fälle: 82 bestanden im vollständigen Lauf; der durch den parallelen Build betroffene erste Startfall bestand anschließend mit allen 15 abschließenden Start-, Export- und Integrationsfällen gegen den fertigen Build. 18 erfolgreiche Aufnahme-Szenarien liefern 150 PNGs. Der echte ältere Host-Parser erhält über den Adapter Höhen, Rampen und manuelle Positionen. Der Vite-/Add-on-Build besteht; der Hinweis auf große Chunks bleibt. Reproduzierbar: `npm test`, `npm run test:browser`, `npm run screenshots`, `npm run build`.

[CU, einzelne Boxenteile und paralleles Andocken](CU-PIT-PARALLEL.de.md)

## Grenzen

Die offizielle API steht aus. JSON erhält den vollständigen Plan; freies Platzieren lässt sich nicht in altes TRK exportieren. Eine vollständige Autorennbahnplaner-2.0-Kompatibilität ist nicht bestätigt. AKS ist eine Einbauangabe, keine Elektroniksimulation. Geometrisches Zusammenfügen garantiert weder das Schließen weiterer Lücken noch reale Baubarkeit. Automatische Schließvorschläge sind noch nicht implementiert. Der Vite-Hinweis auf große Chunks bleibt. Windows-/macOS-Ausführung und entsprechende Installer wurden durch diese Veröffentlichung nicht neu geprüft.

Lizenz und Herkunft: [LICENSE](../LICENSE), [Vendor-Lizenz](../vendor/racehubos/LICENSE), [PROVENANCE.json](../PROVENANCE.json).


[Raumkontur und Einstieg über den Raumplaner](ROOM-FOOTPRINT.de.md)


[CU, Start/Ziel und Tankschienen](UNIT-APPEARANCE.md)


[Automatische Anbauteile und zentrale Werkzeugleiste](AUTOMATIC-ACCESSORIES.de.md)

[3D-Ansicht im Raum](ROOM-3D.de.md) — 150 mm lichte Überfahrthöhe, lokale Vorschau.
