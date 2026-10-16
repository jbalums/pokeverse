# Roadmap and acceptance

The user has authorized and received a bounded town art/traversal implementation, tracked in [the town delivery report](town-corner-delivery.md). It establishes a native engine foundation and asset pipeline alongside this larger roadmap; it does not complete the catalog, battle or Silent Stream milestones. No full-game delivery dates are promised.

M1–M5 target the first playable chapter, **The Silent Stream**. The accepted [full-game story and end-game](story-and-endgame.md) establishes the longer-term destination; regional chapters, the sanctuary finale, League, and postgame require a separate expansion plan.

## M0 — Documentation

Status: **complete for this documentation request**.

- [x] Record confirmed direction and proposed scope separately.
- [x] Save the generated concept in this workspace.
- [x] Document PokéAPI ownership, cached import plan, version policy, and limitations.
- [x] Cache seven live research responses with timestamps and hashes.
- [x] Define architecture, save/failure behavior, milestone acceptance, and continuation.
- [x] Check local Markdown links, research JSON, and cached-response hashes.

M0 does not approve proposed defaults or verify an Unreal installation.

## M1 — Decisions and engine foundation

Status: planned. Depends on implementation authorization and O-001/O-003/O-005/O-006.

- [ ] Confirm exact Unreal version, compiler/SDK, profile, scope, and asset sourcing plan.
- [ ] Freeze mechanics specification: formulas, rounding, RNG, action/effect order, capture, rewards, and supported conditions.
- [ ] Create the project, Graphify exclusions/graph, source control rules, and documented build commands.
- [ ] Build a graybox trainer/camera/world transition and an empty battle arena.
- [ ] Produce a Windows development build and a packaged launchable build.

Acceptance: reproducible build instructions with exact versions; recorded engine launch and camera/input checks when authorized. A successful compile alone does not prove camera quality or playable movement.

## M2 — Catalog pipeline

Status: planned. Depends on selected profile and roster.

- [ ] Implement cached bounded importer, dependency traversal, normalization, and manifests.
- [ ] Resolve the proposed roster and required move/ability/item/growth/evolution dependencies.
- [ ] Complete the per-ID executable support matrix and version filtering rules.
- [ ] Validate IDs, required fields, type composition, growth bounds, evolution branches, and localized fallback.
- [ ] Add Unreal import/cook bindings and catalog diff review.
- [ ] Prove repeat normalization is deterministic; failed refresh preserves the accepted catalog.

Acceptance: a complete accepted snapshot plus passing fixtures for malformed/null responses, pagination, missing dependencies, offline cache misses, and unsupported content. Seven research responses do not satisfy this milestone.

## M3 — Battle and persistence core

Status: planned. Depends on M1/M2 contracts.

- [ ] Implement legal commands, turn ordering, damage/effects, PP, statuses, fainting, replacements, and terminal outcomes.
- [ ] Implement capture, capacity checks, inventory transactions, rewards, and duplicate-result protection.
- [ ] Implement individual Pokémon, party/storage, experience, move learning, and supported evolution.
- [ ] Implement versioned saves, pre-battle checkpoints, safe result commits, backups, and migration rejection.
- [ ] Write worked deterministic fixtures for every enabled effect family and consequential failure path.

Acceptance: deterministic replays; immunities and dual types; no-PP recovery; simultaneous fainting; failed/successful capture; full storage; repeated callbacks; loss recovery; save round-trip; corrupt backup recovery; disk/write failure; incompatible catalog/schema handling. No silent no-op move, ability, or evolution is accepted.

## M4 — Complete playable loop

Status: planned. Depends on M3.

- [ ] Implement town/route/clearing, starter choice, grass encounters, healing, shop, storage, professor investigation, ranger challenge, signal-device shutdown, restoration, and report-back.
- [ ] Complete battle UI, party/summary, bag, Pokédex, dialogue, settings, and save feedback.
- [ ] Complete input ownership, keyboard/controller navigation, remapping, and reduced-motion/text-speed settings.
- [ ] Finish end-to-end new game through objective completion and continue-from-save.

Acceptance: complete the documented loop in a packaged build with network disabled; close/reopen and retain progress; starter/pickup/reward cannot repeat; no blocking battle/menu state; controller focus and disconnect recovery work. Verify ranger-loss retry, device shutdown and visible/audible stream restoration, save/load between shutdown and report, and the wider-network story hook after the report. Record actual observed behavior after authorized checks.

## M5 — Visual production and release candidate

Status: planned. Depends on M4 and approved asset path.

- [ ] Replace graybox assets with consistent models, animations, environments, effects, and audio.
- [ ] Validate the concept's camera framing, roof/tree occlusion, navigation, and UI legibility in engine.
- [ ] Check 16:9, 16:10, ultrawide, minimum supported resolution, readable scaling, and non-color status cues.
- [ ] Choose minimum hardware, rendering settings, and measured budgets; proposed target is 60 FPS at 1080p, pending hardware confirmation.
- [ ] Verify packaged asset completeness, clean-machine prerequisites, saves, offline launch, and error recovery.

Acceptance: actual screenshots/video, hardware/build/settings details, frame-time measurements, and explicit remaining defects. Screenshots do not establish performance; editor play does not establish packaged acceptance. Publishing is a separate decision.

## Evidence ledger

| Category | Current evidence |
| --- | --- |
| Documentation | Design/data/architecture/roadmap files and local references created |
| Source research | Seven successful live PokéAPI GET responses; manifest records exact metadata |
| Documentation checks | See continuation for recorded link/JSON/hash verification |
| Code/importer/simulation | Town corner and asset pipeline implemented; four source-kit and three Unreal tests passed. Full catalog and battle simulation remain planned. |
| Unreal build/cook/launch | Unreal 5.8.3 editor/game builds, Windows cook/archive, and packaged rendered errand passed. See town-corner-delivery.md. |
| Visual/input/device/performance | Packaged 1600x900 frames inspected; automated movement/physics/interaction route passed. Physical controller, manual keyboard, measured FPS and minimum hardware remain open. |
| Packaged offline acceptance | Local packaged route and verified save passed. Network-disabled and clean-machine acceptance not performed. |
| Publication | Not requested or performed |
