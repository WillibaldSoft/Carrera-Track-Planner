# Room footprint implementation and compatibility

The native v1 `roomPlan` gains optional `features` (up to 32 named rectangles, kind `obstacle` or `extension`, X/Y/width/depth in metres) and `backgroundOrigin` (X/Y in millimetres). Old rectangular rooms remain valid. The room footprint is a union of base and connected extensions minus obstacles, decomposed into cells; exposed cell edges form the outline without internal seams. Overlapping exclusions are counted only once.

The planner-owned shared validator addition is under `vendor/racehubos/shared/src/roomFootprint.js`. `roomConfiguration.js` is intentionally extended; PROVENANCE retains its original upstream hash and records the current export hash and reason. The planner's room preview is adapted from the attributed vendor preview; the original vendor UI and rail artwork are unchanged.

The legacy RaceHubOS host validates `roomPlan` with its older rectangular schema. The isolated legacy adapter therefore carries a validated lossless room snapshot in existing extensible pit metadata (`pit.plannerRoomV1`) and restores it on initialization, removing the envelope before editing/native export. The editor uses `roomPlan`; this envelope is only a legacy transport workaround, not the proposed official plugin API. The host's core, shared library, backend and database schema are not patched.

Room templates are local browser storage; room data in saved native track JSON is independent of that cache. Existing saved tracks provide additional room choices. Automatic room suggestions still use the base rectangle and the UI explicitly states that custom contours are not search constraints.

Verification commands: `npm test`, `npm run test:browser`, `npm run build`; room captures: `npm run screenshots -- room-footprint`. Browser tests exercise DE/EN/FR room-first flow, dimensions, background visibility/origin, saving, template reuse, dragging, keyboard nudging and invalid disconnected additions. Unit tests cover geometry, overlap subtraction, connectivity, bounds, native JSON, fixed origin and legacy preservation.
