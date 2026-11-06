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

## Verified preparation baseline

- Fresh dependency installation from the committed lockfile, independent UI build and startup.
- Four included unit test files, containing 22 focused geometry, viewport, joining, replacement, adapter and handoff cases.
- 33 browser cases passed against the independent build using the external preparation harness. They cover DE/EN/FR, responsive layout, theme persistence and host-inherited appearance, plus the existing editor features.
- Three external capture scenarios passed and produced the 57 checked-in PNGs and their manifests.
- Linux DEB and portable TAR were built during preparation; their UI contents matched this build. Four theme/legacy cases passed against the extracted DEB. These binaries are not attached as a new GitHub Release by this publication.
- The revised UI was also checked in the existing race-PC host through its previous experimental adapter. No track was saved by that check.

The browser harness and preparation records are in the [pinned source checkout](https://github.com/WillibaldSoft/RaceHubOS/tree/fa038fff3327b7796ea0c14d2797714c35359335). They are not all part of `npm test` in this repository. Publication adds documentation and screenshots; runtime sources and locked dependencies remain the tested baseline.

## Current limits

The official plugin contract is pending. Native JSON preserves the complete plan; legacy TRK export cannot represent free placement. Full Autorennbahnplaner 2.0 compatibility is not claimed. AKS records installation metadata and can display a marker; it does not simulate electronics. Geometric joining does not guarantee that another remaining gap closes or that a physical layout is buildable. Automatic closing-part recommendations remain a proposal. A Vite large-chunk warning remains. Windows/macOS execution and installers are not newly verified by this publication.

License and upstream attribution are retained in [LICENSE](../LICENSE), [vendor license](../vendor/racehubos/LICENSE) and [PROVENANCE.json](../PROVENANCE.json).
