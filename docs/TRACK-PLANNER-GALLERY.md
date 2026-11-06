# Screenshot galleries · Bildergalerien · Galeries

| Language | Documentation                                    | Screenshots |
| -------- | ------------------------------------------------ | ----------- |
| Deutsch  | [Deutsche Galerie](TRACK-PLANNER-GALLERY.de.md)  | 19          |
| English  | [English gallery](TRACK-PLANNER-GALLERY.en.md)   | 19          |
| Français | [Galerie française](TRACK-PLANNER-GALLERY.fr.md) | 19          |

57 real screenshots of the independent planner, captured on 6 November 2026 at 1600 × 1400 pixels. Each gallery contains localized UI and explanations for the same 19 scenes. SHA-256 manifests accompany each language under `screenshots/track-planner/{de,en,fr}/manifest.json`.

The scenes cover start/finish, CU, two fuel bays, readable CU labels, optional AKS markers, pit assistance, connection guidance, templates, context actions, build checks, missing parts, repeat placement, fixed sidebars, catalogue replacement with following geometry, cut-point selection, joining sections, and dark appearance. Rail artwork was retained.

Only synthetic demo plans and an explicitly empty demo inventory were used. Diagnostic scenes deliberately contain an overlap or an open pit connection. They are not a statement of physical buildability or electrical operation.

The three capture scenarios passed against the independently installed and built planner. The capture harness remains in the original preparation checkout: [pinned screenshot generator](https://github.com/WillibaldSoft/RaceHubOS/blob/fa038fff3327b7796ea0c14d2797714c35359335/scripts/screenshots/track-planner.spec.mjs). It is not included as an executable command in this repository. Here, `npm test` runs the four included unit test files; see [review notes](REVIEW.md) for the exact validation scope.
