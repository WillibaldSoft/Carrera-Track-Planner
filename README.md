# Carrera Track Planner

Independent source repository prepared for Anselme’s future RaceHubOS plugin interface. The official interface is pending; no host patch is required to build or run this planner.

Node 22.13+: npm install, npm test, npm run build, npm start. Runtime is loopback-only and stores plans separately from RaceHubOS.

The existing experimental iframe adapter is isolated in addons/track-planner/src/host/legacyBridge.js. It is compatibility code, not the upcoming official plugin API. The planner-owned layout handoff proposal includes geometry, lane lengths and optional sector anchors.

UI primitives, theme tokens and rendering/geometry snapshots from RaceHubOS are owned vendor sources under Apache-2.0, with source hashes in PROVENANCE.json. There are no imports from a parent RaceHubOS checkout and no backend, database or migrations. The initial export preserves paths for straightforward review; later consolidation can move these directories without changing the contract.

This repository is prepared locally; no new public GitHub repository is created by the exporter.
