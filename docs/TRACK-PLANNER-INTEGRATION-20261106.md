# Integrationsvorbereitung · Integration preparation · Préparation

## Deutsch

Der Streckenplaner besitzt ein eigenes Repository: [WillibaldSoft/Carrera-Track-Planner](https://github.com/WillibaldSoft/Carrera-Track-Planner). Er lässt sich ohne RaceHubOS-Backend oder Eltern-Checkout installieren, testen, bauen und starten. Benötigte UI- und Geometriequellen sind mit Lizenz und Herkunftsnachweisen enthalten. [Anleitung](../README.de.md) · [Galerie](TRACK-PLANNER-GALLERY.de.md).

Anselme entwirft die offizielle Plugin-Schnittstelle und implementiert Download, Start und Add-on-Unterstützung im RaceHubOS-Kern. Diese Anwendung erfordert dafür keine neuen Core-Patches. Die offizielle Schnittstelle ist noch nicht bekannt. Der vorhandene Legacy-Adapter ist austauschbar gekapselt und nur experimentelle Kompatibilität. Das Layout-/Sektorenformat ist ein Vorschlag zur Abstimmung; eine automatische CU-/Hardware-Zuordnung ist nicht implementiert.

Die Oberfläche verwendet RaceHubOS-Designvariablen, Inter und shadcn/ui-Buttons. Eigenständig gibt es System/Hell/Dunkel mit gespeicherter Wahl; eingebettet übernimmt der Host Sprache und Darstellung. Schienenzeichnung und bestehende Editorfunktionen bleiben erhalten. [Prüfstand und Review-Einstieg](REVIEW.de.md).

## English

[The independent repository](https://github.com/WillibaldSoft/Carrera-Track-Planner) installs, tests, builds and starts without a parent RaceHubOS checkout or backend. Required UI/geometry sources are included with licenses and provenance. [Instructions](../README.md) · [Gallery](TRACK-PLANNER-GALLERY.en.md).

Anselme owns the future official plugin interface and the host's download/start/add-on support. The experimental legacy adapter is isolated and replaceable. The finished-layout/sector handoff is explicitly a proposal, without automatic CU/hardware mapping or a claim of official integration. The UI uses the RaceHubOS design tokens and shadcn/ui Buttons, with independent theme selection or host-controlled appearance. [Review scope](REVIEW.md).

## Français

[Le dépôt indépendant](https://github.com/WillibaldSoft/Carrera-Track-Planner) s’installe, se teste, se compile et démarre sans checkout parent ni backend RaceHubOS. Les sources UI/géométriques nécessaires sont fournies avec licences et provenance. [Instructions](../README.fr.md) · [Galerie](TRACK-PLANNER-GALLERY.fr.md).

Anselme définit la future interface officielle et le téléchargement, le lancement et les modules côté hôte. L’ancien adaptateur expérimental est isolé et remplaçable. Le transfert du circuit et des secteurs reste une proposition, sans association automatique CU/matériel ni compatibilité officielle annoncée. L’interface reprend les variables de thème RaceHubOS et les boutons shadcn/ui : choix autonome du thème ou apparence pilotée par l’hôte. [Périmètre des vérifications](REVIEW.fr.md).
