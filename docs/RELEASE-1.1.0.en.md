# Version 1.1.0 – Rooms, elevation profiles and vector PDF

This release combines the changes accumulated since version 1.0.0.

- Room outlines, alcoves and unusable areas constrain placement and automatic layout search. New tracks begin in the room planner and dropped layouts receive valid coordinates.
- More realistic CU, start/finish and fuel rails retain the established rail appearance. Automatic shoulders and accessories offer hover previews and click-to-attach controls.
- Central toolbar includes centring selected rails. Repeat placement, replacement, cut points, joining and parallel docking remain available.
- 3D room view provides approximately 150 mm clearance, smooth adjustable ramps and individual height profiles. Heights, ramp lengths and resulting gradients are saved with the layout.
- Editable, hideable 2D elevation/gradient labels adapt to zoom. Manual positions are saved, draggable and individually or globally resettable.
- Print preview and PDF/PNG/SVG retain visible label positions. PDF contains vector rails, surface patterns and embedded fonts instead of a raster capture.
- The isolated legacy adapter preserves the new scene and label data through the older RaceHubOS parser. No RaceHubOS core change; Anselme’s official plugin interface is still pending.

## Documentation and validation

[Instructions](../README.md) · [Review](REVIEW.md) · [Galleries and checksums](TRACK-PLANNER-GALLERY.md) · [Elevations, 3D and export](ROOM-3D.en.md) · [Automatic accessories](AUTOMATIC-ACCESSORIES.en.md)

Validation commands: `npm test`, `npm run test:browser`, `npm run screenshots`, `npm run build`. PDF checks additionally inspect absence of raster images, embedded fonts and enlarged renderings. Download hashes are supplied in the release `SHA256SUMS` file.

## Packages and limits

Linux: DEB and portable TAR.GZ with a Node runtime. Windows: portable ZIP with the Windows-x64 runtime; not executed on Windows from this Linux machine. No new EXE or macOS installer is claimed for this release. Older installers are not version 1.1.0. User layouts and inventory are separate from application files; the previous local add-on is backed up before updating.

Complete Autorennbahnplaner 2.0 compatibility remains unconfirmed, and automatic closing-part suggestions remain a proposal. The 3D view is a planning preview. The existing Vite large-chunk warning remains.
