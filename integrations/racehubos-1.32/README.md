# Direct planner updates in RaceHubOS 1.32.0

This bridge is for RaceHubOS **1.32.0 with the local `carrera-local` extension** and its existing update-guard tools. It is not a universal upstream RaceHubOS add-on manager. Other hosts retain manual planner downloads.

1. End the active or paused session, save edits, and stop RaceHubOS.
2. Extract `RaceHubOS-Planer-Direktupdate-1.5.1.zip`.
3. With Node >=22.13, run from the extracted folder:

   `node integrations/racehubos-1.32/install.mjs /path/to/RaceHubOS-1.32`

4. The installer backs up the existing bridge files, planner, host build, approval and SQLite database; installs the bundled planner and host route; runs the extension's existing regression gate; and restores program files if checks fail. Saved plans are never restored over newer data. Chromium and the host's existing build dependencies must be available for that gate.
5. Restart RaceHubOS. In the embedded planner select **Updates → Nach Updates suchen → Direkt in RaceHubOS installieren** when a newer stable planner is available.

Only owned files in `carrera-local` are registered/replaced; no RaceHubOS core source files are patched. Future planner updates verify official GitHub/SHA256SUMS digests, back up application files and the database, run the existing host checks, and reload the planner. Unsaved planner edits and active sessions block installation. Direct installation is local-only (`localhost` / `127.0.0.1`).

Backups: `RaceHubOS-1.32/addons/.data/carrera-local/planner-bridge-backups/` (initial bridge install) and `planner-update-backups/` (later planner updates).

Corresponding source: https://github.com/WillibaldSoft/Carrera-Track-Planner — AGPL-3.0-only; retain LICENSE and NOTICE.
