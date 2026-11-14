# Version 1.4.0 – Separate gradient inputs and direct RaceHubOS updates

- Set ascent and descent percentages independently. Preview calculated lengths, actual peak gradients and affected rails; apply separately or together. The 3D geometry reflects applied values, space limitations are shown and height joints remain continuous.
- Install updates directly in the embedded RaceHubOS planner with official package/file checksums, application/database backup and the host's existing compatibility gate. Unsaved edits and active sessions block installation.
- Standalone: install downloaded `Carrera-Track-Planner-update.json` files through “Install update file”, retaining official release verification, backup, restart and rollback. Files larger than 4 MB are supported.

**RaceHubOS requirement:** Direct host installation requires the local `carrera-local` extension for RaceHubOS **1.32.0** and its update-guard tools. **RaceHubOS-Planer-Direktupdate-1.4.0.zip** includes the bridge, planner and installer. Install once with RaceHubOS stopped; subsequent planner updates use the embedded install button. Other hosts retain manual downloads. [Instructions](https://github.com/WillibaldSoft/Carrera-Track-Planner/blob/v1.4.0/integrations/racehubos-1.32/README.md).

Packages: portable Linux x64, portable Windows x64, Debian amd64, RaceHubOS add-on JSON, standalone update bundle and RaceHubOS 1.32 integration package. Existing plans are not modified by the release. Windows package contents verified; native Windows execution unavailable here. No new setup EXE or macOS package.
