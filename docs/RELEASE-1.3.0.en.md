# Version 1.3.0 – Continuous 3D ramps and gradient suggestions

- Center the view while preserving zoom and camera angles.
- Smooth height transitions are enabled by default, including existing plans.
- Ramp calculations use the editor's connection tolerance, so small imported joint offsets no longer split connected ramps.
- In “3D → Gradient suggestions”, choose a maximum gradient and preview actual ramp lengths, gradients and affected rails. Apply ascent and descent separately or together. Space limitations are shown; custom height points are preserved.
- Count separately placed pitlane entries and exits correctly as pairs without duplicating carrier representations.

Verified on a saved Fröhlichring plan: a 160 mm descent over 2,000 mm spans seven rails, averaging 8 % with a 15 % maximum, continuous height joints and 150 mm clearance at all three crossings. This is a tested planning example; the release does not modify existing user plans. Apply and save ramp lengths within each plan.

Packages: portable Linux x64, Debian amd64, portable Windows x64, RaceHubOS add-on and integrated update bundle. Existing plans are preserved. Windows package contents verified; native Windows execution unavailable in this environment. No new setup EXE or macOS package.
