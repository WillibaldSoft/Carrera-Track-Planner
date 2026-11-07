# Screenshot galleries · Bildergalerien · Galeries

| Language | Gallery | Screenshots |
| --- | --- | --- |
| Deutsch | [Deutsche Galerie](TRACK-PLANNER-GALLERY.de.md) | 24 |
| English | [English gallery](TRACK-PLANNER-GALLERY.en.md) | 24 |
| Français | [Galerie française](TRACK-PLANNER-GALLERY.fr.md) | 24 |

72 real screenshots of the independent planner, captured on 7 November 2026 at 1600 × 1400 pixels. Localized SHA-256 manifests accompany all three sets. Rail artwork is preserved. Only synthetic demo plans and an empty demo inventory are used; diagnostic scenes intentionally contain open connections or overlaps.

Scenes 20–24 show CU-preserving curve edits, individual pit parts, parallel multilane preview and application, and parallel docking of a single pit rail. Earlier scenes cover start/finish, two fuel bays, readable CU labels, optional AKS, pit assistance, templates, checks, repeat placement, fixed sidebars, replacement, cut points, joining and dark appearance.

Reproduce from this repository: `npm ci`, `npx playwright install chromium`, `npm run screenshots`. The included generator is [track-planner.spec.mjs](../scripts/screenshots/track-planner.spec.mjs). All three capture scenarios passed. `npm test` covers 48 unit cases; `npm run test:browser` covers 48 browser cases. See the [review guide](REVIEW.md).

## Room footprint · Raumkontur · Contour de la pièce

12 additional screenshots (four per language) document the room-first workflow, unusable corners/chimneys, extensions/alcoves, the track background and template reuse. Together with the track gallery there are 84 PNGs.

[Deutsch](ROOM-FOOTPRINT.de.md) · [English](ROOM-FOOTPRINT.en.md) · [Français](ROOM-FOOTPRINT.fr.md)

`npm run screenshots` runs all six capture scenarios. Room-only: `npm run screenshots -- room-footprint`.
