# Documentation index

The original documents establish the full-game plan. The user has now authorized a bounded playable town-corner and reusable asset kit; the delivery report tracks that implementation separately from the larger roadmap.

| Document | Purpose |
| --- | --- |
| [Decisions](decisions.md) | Confirmed direction, proposed defaults, unresolved choices |
| [Game design](game-design.md) | Exploration, encounters, battles, progression, first playable scope |
| [Story and end-game](story-and-endgame.md) | Accepted narrative, first chapter, regional finale, and postgame goals |
| [Visual direction](visual-direction.md) | Concept reference, camera, environments, characters, interface |
| [Game brief for asset planning](game-brief-for-assets.md) | Required reference appearance, scene breakdown, asset packages and visual approval gate |
| [Game-ready asset package plan](asset-package-plan.md) | Eight proof bundles, full matching scene, chapter production contracts, package handoff and acceptance gates |
| [Proposed asset inventory](asset-package-inventory.json) | Stable work-package IDs, quantities, dependencies, owner roles, technical profiles and pending evidence |
| [PokéAPI data plan](pokeapi-data.md) | Source ownership, endpoint mapping, imports, versioning, validation |
| [Technical architecture](technical-architecture.md) | Unreal systems, data contracts, battle state, saves, failure paths |
| [Roadmap and acceptance](roadmap.md) | Sequenced milestones and evidence required to complete them |
| [Continuation](continuation.md) | Current state and the next development handoff |
| [Town corner delivery](town-corner-delivery.md) | Implemented art/traversal slice, controls, build steps, evidence and limits |
| [Sources](sources.md) | Official references and live research evidence |

## How to read status

- **Confirmed:** directly requested or accepted by the user.
- **Proposed:** a planning default; not an additional user decision.
- **Open:** requires a decision or local verification before dependent implementation.
- **Planned:** documented work, not implemented or tested.
- **Verified:** supported by the specific evidence recorded alongside the claim.

Full-game systems remain **Planned** unless a specific delivery report records implementation and evidence. Research checks only verify the sampled API responses, not the complete catalog or a working integration.

## Updating this plan

Record consequential scope changes in `decisions.md`; update dependent documents and acceptance criteria together. Record test results only after execution. Keep imported Pokémon facts separate from project-authored rules and content.
