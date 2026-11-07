# Screenshot galleries · Bildergalerien · Galeries

| Language | Gallery | Screenshots |
| --- | --- | --- |
| Deutsch | [Deutsche Galerie](TRACK-PLANNER-GALLERY.de.md) | 24 |
| English | [English gallery](TRACK-PLANNER-GALLERY.en.md) | 24 |
| Français | [Galerie française](TRACK-PLANNER-GALLERY.fr.md) | 24 |

72 real screenshots of the independent planner, captured on 7 November 2026 at 1600 × 1400 pixels. Localized SHA-256 manifests accompany all three sets. Rail artwork is preserved. Only synthetic demo plans and an empty demo inventory are used; diagnostic scenes intentionally contain open connections or overlaps.

Scenes 20–24 show CU-preserving curve edits, individual pit parts, parallel multilane preview and application, and parallel docking of a single pit rail. Earlier scenes cover start/finish, two fuel bays, readable CU labels, optional AKS, pit assistance, templates, checks, repeat placement, fixed sidebars, replacement, cut points, joining and dark appearance.

Reproduce from this repository: `npm ci`, `npx playwright install chromium`, `npm run screenshots`. The included generator is [track-planner.spec.mjs](../scripts/screenshots/track-planner.spec.mjs). All three capture scenarios passed. `npm test` covers 114 unit cases; `npm run test:browser` includes 89 browser cases. See the [review guide](REVIEW.md).

## Room footprint · Raumkontur · Contour de la pièce

18 additional screenshots (six per language) document the room-first workflow, unusable corners/chimneys, extensions/alcoves, the track background and template reuse. Together with the track gallery there are 90 PNGs.

[Deutsch](ROOM-FOOTPRINT.de.md) · [English](ROOM-FOOTPRINT.en.md) · [Français](ROOM-FOOTPRINT.fr.md)

`npm run screenshots` runs all six capture scenarios. Room-only: `npm run screenshots -- room-footprint`.

## CU and fuel artwork

[Nine localized detail views](UNIT-APPEARANCE.md) cover the CU housing, start/finish printing and two fuel rails. All galleries together contain 99 PNGs, captured by nine scenarios. `npm run screenshots -- unit-appearance` regenerates these details.

## Automatic accessories and central toolbar

[Deutsch](AUTOMATIC-ACCESSORIES.de.md) · [English](AUTOMATIC-ACCESSORIES.en.md) · [Français](AUTOMATIC-ACCESSORIES.fr.md)

Nine new screenshots show hover offers, accessory preview and zooming to the selected rail. All galleries together contain 108 PNGs from twelve scenarios. `npm run screenshots -- automatic-attachments` regenerates these views.

## 3D room and bridge clearance

[Deutsch](ROOM-3D.de.md) · [English](ROOM-3D.en.md) · [Français](ROOM-3D.fr.md)

Fifteen additional screenshots show the room, bridge clearance, top view, ramp lengths, gradients and individual rail heights. Total at the 3D milestone: 123 PNGs from fifteen capture scenarios. Regenerate with `npm run screenshots -- room-3d`.

## Heights and gradients in 2D

Twenty-seven localized screenshots show clickable height/gradient labels, direct editing, hidden labels, individual bridge clearance, separated overview cards mobile density reduction, manual dragging, automatic reset and the current-view print/PDF preview. All galleries now contain 156 PNGs from eighteen capture scenarios. `npm run screenshots -- two-dimensional-heights` regenerates these views.

[Deutsch](ROOM-3D.de.md#höhen-und-steigungen-in-2d) · [English](ROOM-3D.en.md#heights-and-gradients-in-2d) · [Français](ROOM-3D.fr.md#hauteurs-et-pentes-en-2d)

[Left-side diodes on active switches](UNIT-APPEARANCE.md#weichendioden--switch-diodes--diodes-des-aiguillages) are shown in three additional localized screenshots.

The refreshed automatic-accessory gallery shows persistent side selection and per-piece curved shoulder artwork.
