# Maintainer review

[Deutsch](REVIEW.de.md) · **English** · [Français](REVIEW.fr.md)

This repository has its own history and builds without a parent RaceHubOS checkout, backend, database or migrations. `vendor/racehubos` contains the required Apache-2.0 UI and geometry snapshots; `PROVENANCE.json` records their original locations and SHA-256 hashes. The dependency lockfile is committed.

## Suggested review order

1. Run `npm ci`, `npm test`, `npm run build`, then `npm start` using Node 22.13+.
2. Inspect the independent planner and the [three localized galleries](TRACK-PLANNER-GALLERY.md).
3. Review [the proposed capabilities](../addons/track-planner/integration/proposal.json).
4. Review [the isolated legacy transport](../addons/track-planner/src/host/legacyBridge.js) and [its replaceable editor connection](../addons/track-planner/src/EmbeddedPlanner.jsx).
5. Review [the layout handoff proposal](../addons/track-planner/src/host/layoutHandoff.js) and [synthetic sector example](../addons/track-planner/integration/layout-handoff.example.json).

The future official plugin interface, download/update mechanism, permissions and RaceHubOS-side sector visualization belong to Anselme's integration design. No new host patch is required to build or run this application. The existing iframe transport is experimental compatibility code, not that future API. The layout handoff is a planner-owned proposal and has not been adopted by RaceHubOS.

## Verified state

111 unit cases in sixteen files passed. The browser suite contains 83 cases: 82 passed in the full run; the first startup case affected by the parallel build then passed with all 15 final startup, export and integration cases against the completed build. 18 successful capture scenarios provide 150 PNGs. The actual older host parser preserves heights, ramps and manual positions through the adapter. The Vite/add-on build passes; the large-chunk warning remains. Reproduce: `npm test`, `npm run test:browser`, `npm run screenshots`, `npm run build`.

[Fixed CU, individual pit parts and parallel docking](CU-PIT-PARALLEL.en.md)

## Current limits

The official plugin contract is pending. Native JSON preserves the complete plan; legacy TRK export cannot represent free placement. Full Autorennbahnplaner 2.0 compatibility is not claimed. AKS records installation metadata and can display a marker; it does not simulate electronics. Geometric joining does not guarantee that another remaining gap closes or that a physical layout is buildable. Automatic closing-part recommendations remain a proposal. A Vite large-chunk warning remains. Windows/macOS execution and installers are not newly verified by this publication.

License and upstream attribution are retained in [LICENSE](../LICENSE), [vendor license](../vendor/racehubos/LICENSE) and [PROVENANCE.json](../PROVENANCE.json).


[Room footprint and room-first workflow](ROOM-FOOTPRINT.en.md)


[CU, start/finish and fuel rails](UNIT-APPEARANCE.md)


[Automatic accessories and central toolbar](AUTOMATIC-ACCESSORIES.en.md)

[3D room view](ROOM-3D.en.md) — 150 mm bridge clearance, local preview.
