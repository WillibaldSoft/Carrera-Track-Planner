# Updates and recovery

Open **Updates** on the start screen or in the fullscreen editor header. **Check for updates** compares the installed version against the newest stable release in the planner repository. Prereleases and older versions are never offered for installation. Release changes are selected for the current language when available.

**Check for updates at startup** defaults to off and is saved in the browser, separately for standalone and add-on use. Enabling it authorizes checks when opening the app, never automatic downloads or installation. The planner remains usable offline; network failures and GitHub request limits are reported.

## Standalone updates

Install **1.2.0**, the first updater-enabled version, once using the normal installation procedure. Subsequently, writable portable Linux/Windows and managed per-user installations support direct application updates. Source checkouts and Debian system packages are not silently overwritten.

1. Save open changes or close the editor.
2. Check for updates and read the changes.
3. Click **Install and restart**. Only this click starts downloading.
4. SHA-256 must match both GitHub's asset digest and the published SHA256SUMS. Every packaged file is checked as well. Unsafe paths, missing files, incompatible runtimes and invalid scripts are rejected.
5. The old application and `plans.json` are backed up. Backup checksums are verified before application changes.
6. The application is replaced and restarted with the same Node runtime. An independent supervisor checks the version and process ID. Failed startup restores the verified old application and launches it.

The data directory stays unchanged. Application rollback never overwrites newer saved layouts. Node itself is not updated; newer runtime requirements need a full installer/package. Portable folder names can retain their original version; the displayed installed version is authoritative.

## System packages and RaceHubOS add-on

Debian system installations remain managed by the package manager. The update panel links to the matching package and release checksums. Manual installation outside the planner must be verified separately.

The RaceHubOS add-on offers checks, changes and the add-on download. Installation remains with the available host procedure or future add-on manager. The planner does not patch or restart the RaceHubOS core. Downloading alone does not install anything.

## Recovery

The update panel provides status, backup location and this guide. Backups remain in `update-backups/<time-ID>` under the standalone data directory and are not automatically deleted. They include `job.json`, `backup-manifest.json`, the previous `application/` and, if present, `plans.json`.

Startup failures normally roll back automatically. For an interrupted update, stop all affected planner processes, then run the preserved recovery helper with the unchanged Node runtime:

```text
<application>/node <backup>/application/updater/restart.mjs --restore <backup>/job.json
```

Use `node.exe` on Windows and quote paths containing spaces. Start the planner normally afterwards. The helper verifies the backup before changing files and restores only the application. Damaged backups are rejected; install the official full package while retaining the data directory instead.

An interruption before a complete backup leaves no `job.json` and has not replaced the application yet. Once all planner processes are stopped, remove a remaining `.planner-update.lock` from the application directory and retry. Do not delete personal layouts or inventory files.

Windows packages are built but native Windows execution cannot be tested in this Linux environment. Linux installation, real restarts and automatic rollback are tested in isolated installations.

An offline copy of this guide is in `dist/update-guides/en.txt` in the application folder. Unless overridden, data is stored in `~/.local/share/racehubos-track-planner` on Linux or `%LOCALAPPDATA%\racehubos-track-planner` on Windows. `RACEHUBOS_PLANNER_DATA_DIR` overrides that location.
