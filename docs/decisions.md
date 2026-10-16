# Decisions

Planning baseline: 2026-10-15, Asia/Manila.

## Confirmed direction

| ID | Decision | Evidence |
| --- | --- | --- |
| D-001 | Plan an isometric Pokémon game using Unreal Engine. | User asked about this game and stated Unreal is installed. Exact installation/version is unverified. |
| D-002 | Use the generated stylized 3D town concept as the initial visual reference. | User accepted the sample and requested documentation. |
| D-003 | Use `https://pokeapi.co/api/v2/` as the source of Pokémon reference data. | Explicit user instruction. |
| D-004 | Create documentation now; defer game implementation. | Explicit user instruction: create DOCS for now. |
| D-005 | Follow the habitat-displacement mystery: field assistant, rival, reactivated signal network, sanctuary shutdown, then a Championship battle against the rival. | User accepted the storyline and end-game proposal. See story-and-endgame.md for the narrative baseline. |
| D-006 | Full-game postgame direction: habitat restoration, Master League rematches, Pokédex completion, and a battle facility; long-term goals are Champion and Master Field Researcher. | User accepted the end-game idea. Detailed formats and expansion scope remain open. |
| D-007 | Implement one playable town corner and reusable asset kit as an art/traversal slice. | User explicitly requested this deliverable on 2026-10-15, superseding D-004 for this bounded implementation. This does not authorize the full game roadmap. |
| D-008 | Install compatible C++ tools and run rendered Unreal/gameplay checks for this corner. | User explicitly approved both during the implementation run. |
| D-009 | Require the supplied town image's same look and design, with a user-requested 100% visual match goal. Preserve the exact attachment as references/town-visual-target.png and use the asset brief's scene breakdown and actual-engine comparison/user-review gate. The current preview has not achieved this target. | Explicit user request on 2026-10-16 to update the design brief. This raises the art target; it does not authorize additional implementation, purchases or publishing. Literal pixel identity in motion is not a verified guarantee. |

## Proposed defaults

| ID | Default | Reason / implication |
| --- | --- | --- |
| P-001 | Windows desktop, single-player, offline gameplay. | Keeps the first complete loop manageable. No accounts or game server required. |
| P-002 | Fully 3D environments and characters; orthographic camera. | Matches the concept. Pixel-art hybrid remains a possible later change. |
| P-003 | C++ for simulation/data/persistence; Blueprints for presentation and authored interactions. | Separates testable rules from scene work. Requires a compatible local C++ toolchain. |
| P-004 | Import PokéAPI during development; package a pinned catalog. | Reproducible builds, caching, and no mid-battle network dependency. |
| P-005 | One small original town, one route, one woodland clearing. | Provides a contained exploration and battle loop without promising a region remake. |
| P-006 | First supported catalog: 16 default Pokémon varieties, listed in game design. | Small content and asset workload, including evolution destinations. |
| P-007 | `slice-v1` project battle profile, with `ultra-sun-ultra-moon` level-up learnsets and snapshot-current reference values. | Explicit custom profile, not a claim of exact Ultra Sun/Ultra Moon simulation. See the data plan. |
| P-008 | English interface first, with language-aware imported text. | Avoids coupling identifiers to display strings. |
| P-009 | Three manual save slots and one separate autosave per playthrough. | Provides recovery without overwriting the only valid save. |

## Open before dependent implementation

| ID | Question / evidence needed | Blocks |
| --- | --- | --- |
| O-001 | Resolved for the corner: Unreal 5.8.3, MSVC 14.44.35229, Windows SDK 10.0.22621.0; editor/game builds and Windows packaging passed. | Exact build commands are in town-corner-delivery.md. |
| O-002 | Observed development PC: Ryzen 7 5700X, RTX 3060 Ti, 32 GB RAM. Minimum supported hardware and measured performance target remain open. | Render settings and measured performance acceptance. |
| O-003 | Confirm `slice-v1`, or choose faithful rules for a specific official version. | Final battle formulas, historical data resolution, move/ability support contract. |
| O-004 | Source and availability of consistent animated Pokémon models. | Final visual production and roster readiness. |
| O-005 | Confirm first playable scope and initial roster. | Content lock and effort estimate. |
| O-006 | Confirm C++/Blueprint split after checking the local toolchain. | Core module structure. |

The original documentation task did not authorize implementation. D-007 and D-008 now authorize the bounded town-corner implementation, compatible C++ tooling, and its validation. Paid asset purchases and publishing remain outside scope.

## Data ownership decision

PokéAPI owns imported Pokémon facts. Local files own gameplay instances, original world content, and executable behavior. Missing upstream facts remain missing or block import; do not fill them with invented Pokémon values. Any intentional balance override must identify the original value, reason, profile, and affected tests.
