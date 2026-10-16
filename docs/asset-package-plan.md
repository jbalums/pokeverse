# Verdant Trails — game-ready asset package plan

Prepared 2026-10-16, Asia/Manila. **Status: planning complete; production and acceptance pending.**

This plan implements the planning request in [the asset brief](game-brief-for-assets.md), using the installed Game Development Studio production and vendoring workflows. It does not generate assets, purchase content, run the game, or mark a package game-ready. Quantities, production specifications, staffing roles and budgets below are **proposals**, to be locked before their dependent batch starts.

The deliverable is a versioned asset release for Unreal, supported by editable sources, portable model packages, native integration assets, provenance and acceptance evidence. The supplied [town target](references/town-visual-target.png) remains the mandatory visual target. A complete inventory or passing file validator cannot establish that the scene matches it.

## 1. Baseline and scope

- Existing foundation: eight OBJ source meshes, a four-material prototype atlas, thirty native materials, and constructed trainer/gardener/Bulbasaur studies. A fresh file count found forty `.uasset` files under `Game/Content/Art`; prior import/render/build evidence is documented in [the delivery report](town-corner-delivery.md). Those receipts do not accept the proposed production assets.
- Replace the studies with finished meshes, rigs and textures. Reuse assembly, collision and interaction contracts where compatible. The existing NPOT/no-mipmap atlas and importer-specific OBJ axis workaround are prototype conventions, not the final export standard.
- Match the healing landmark, main cottage, upper-center background cottage, cropped lower-left cottage, raised plaza, foreground canopy, meadow, rocky cascades, rope bridge, dressing, five human appearances, three Pokémon appearances and HUD. Background/cropped architecture still needs sufficient real geometry for the matching camera and nearby movement.
- The matching view stages Pikachu, Charmander and Bulbasaur. It does not grant those party members or change encounters. The proposed sixteen-species catalog remains P-006/O-005 in [decisions](decisions.md); no asset list turns it into an approved gameplay roster.
- Chapter 1 adds town services, Meadow Route, Woodland Clearing, one outdoor battle arena, supported encounters and the signal-device restoration sequence. Reuse environments and characters across stages. Later regions, sanctuary, Championship, rival production, postgame, additional forms and voice acting remain deferred.

The current code-only Graphify graph was queried for town assembly/import/camera relationships. It locates `TownKit`, `VerdantGame`, and the source/import tools; it does not semantically index this design, art or native Unreal content. No code changes are part of this plan.

## 2. Release structure and inventory rules

The companion [asset inventory](asset-package-inventory.json) is the authoritative proposed work breakdown: **70 work-package entries**, including sixteen individually tracked creature entries. It is a project planning format, **not** a Game Development Studio request, canonical package manifest or validation receipt.

Resolve each entry by applying `entry_defaults`, its `technical_profile`, then entry-specific overrides. This supplies its owner role, source/usage status, geometry/rig/animation and material needs, collision, pivot, scale, destination, dependencies, status and evidence. Named people can replace role owners at scheduling. All new production evidence lists start empty.

`quantity` counts the named source deliverables in `variants`, using the row's declared unit. It does not count world placements, triangle totals, individual leaves, LOD derivatives, all files in a bundle, or completed packages. A prefab is an assembly recipe referencing its modules. Texture/material/animation/UI/audio sets are separately identified units; **do not sum heterogeneous rows as a mesh count**. Existing source studies are references, not completed production rows. Proof bundles below consume parts of these same entries rather than creating duplicate inventory.

Proposed locations, relative to this repository:

```text
assets/production/source/<asset-id>/v001/          editable originals, acquisition/usage evidence
assets/production/workspaces/<batch-id>/           future CLI outputs and receipts
assets/production/releases/<release-id>/           release index and verified package references
Game/SourceAssets/Verdant/<package-id>/<version>/  future vendored portable packages
Game/Content/Verdant/Production/                   native imported/assembled content
docs/asset-evidence/<release-id>/                  evidence index, reviews, decisions
output/asset-evidence/<release-id>/                large captures, logs and profiling artifacts
```

Only these planning documents are created now. Production folders above are proposals. Keep native additions separate from generated `Game/Content/Art` and generated `VerdantCorner.umap`; regeneration must not overwrite hand-authored production work. A proposed dedicated map is `/Game/Verdant/Production/Maps/L_TownReference`.

One release contains multiple verified canonical model packages, supplemental UI/audio/source bundles with their own hash rosters, and a native Unreal integration layer. Do not treat a single GLB as a whole playable town. The installed skill documents `package build` for a model GLB; UI, audio, engine shaders, maps and Blueprints need a separately verified handoff unless installed capability discovery explicitly supports them. The release index binds all these parts and their dependencies.

## 3. Production sequence and gates

| Stage | Work and boundary | Exit evidence |
| --- | --- | --- |
| S0 — content/technical lock | Freeze reference hash, matching camera/framing, sample scale, exporter/importer, initial material policy, rights/source strategy, staffing and working budgets. Resolve chapter roster only before chapter-dependent work. | Recorded choices and one calibration round trip; no production approval inferred from this plan. |
| S1 — representative proof | Produce the eight bundles below at final intended quality. Assemble a small integrated comparison area to test their light/material/scale relationship. | Static package checks plus actual-engine proof crops, locomotion/occlusion checks and user review of representative quality. This does not accept the full matching scene. |
| S2 — complete matching scene | Finish all reference-phase rows, with the required cropped/background content, appearances, dressing and screenshot HUD state. Reuse approved S1 work. | Repeatable full Unreal frame, aligned comparisons/crops, discrepancy log and explicit user visual approval before multiplying the library. |
| S3 — Chapter 1 release | Finish chapter rows and enabled creature action sets; extend approved art into three exterior zones, two small service interiors and one battle arena. | Import/cook and functional asset-state evidence for the complete authored sequence; packaged offline content coverage; independent performance and visual/input checks. |
| S4 — reserve | Ten evolved forms and later-game categories remain backlog. | Start only when enabled content actually needs them and scope is authorized. |

### Eight S1 proof bundles

| Bundle | Required sample, from inventory | Acceptance focus |
| --- | --- | --- |
| B1 — healing landmark | `VT-ARC-001`: curved tiled roof/eave, facade return, red entrance arch/emblem, blue glass and planter/light context | Distinct curved silhouette, tiles at gameplay scale, warm cream/red/blue response; not a gabled-cottage substitute. |
| B2 — cottage | `VT-ARC-002/004/005`: tiled roof corner, plaster/timber wall, green shutter/window, stone foundation and step | Modular seams, proportions, warm windows, rounded edges and believable hidden surfaces. |
| B3 — vegetation | `VT-ENV-004/005/008/009`: one broadleaf, conifer, encounter-grass cluster and mixed flowers | Layered greens, pointed tall grass, fine silhouettes, depth, instance variation and stable player visibility. |
| B4 — cascade | `VT-ENV-002/003/011`, `VT-FX-001`: grassy rock lip, vertical drop, water/foam/ripple | Real elevation/cascade, flowing blue water, shoreline contact and reduced-motion state. |
| B5 — bridge | `VT-ARC-007`: deck, varied planks, rounded post, rope span and bank anchor | Reference silhouette, thickness, rope shape, walkable deck and collision independent of decoration. |
| B6 — trainer | `VT-HUM-001`: finished trainer with idle/walk/run/interaction/command | Face/clothing/proportions, deforming rig, feet, contact shadow, silhouette beside architecture. |
| B7 — companion | `VT-PKM-PIKACHU`: finished reference companion with idle and locomotion first | Recognizable proportions, face/ears/tail, local presentation scale, follow readability and nonblocking follower collision. Chapter actions remain a separate obligation. |
| B8 — HUD | `VT-UI-001/002`: exact reference layout, actual illustrated minimap, three portraits/bars, bag/menu | Geometry, spacing, contrast, icon identity and display at the matched frame; separately demonstrate the six-party layout. |

S1 intentionally tests a demanding character and landmark early. It is not a reduced substitute for S2: Bulbasaur, Charmander, the other four human appearances and all pictured landmarks remain required in S2.

### Chapter additions and reuse

Use the three exterior zones already described in the brief; `VT-WLD-001` explicitly owns their authored layouts, traversal, dressing and state bindings, separately from the isolated matching view and clearing landmark. Limit service interiors to one healing room and one shop room; put storage in an existing service room. Home exit does not require a home interior. Stage professor/starter choice outdoors at a small research station unless content lock requires an interior. One outdoor arena reuses approved grass/rock/foliage materials without blocking creature silhouettes. `VT-PRP-005` includes the supported capture-ball model/material; capture effects depend on that prop rather than implying that particles supply it.

Add professor, ranger and shopkeeper appearances plus two optional route residents. Shared residents/clothing can cover multiple role placements; do not buy a new skeleton per NPC. A candidate gameplay asset set is the three starters, Pidgey, Rattata and Pikachu. This six-species suggestion awaits encounter, starter, ranger-team and guarding-species content lock; do not invent a seventh species for the guarding encounter. The ten evolved forms stay conditional. If any evolution becomes reachable, its destination must pass the same readiness gates before it is enabled.

The signal device is one model with active/disabled presentation states. Restoration reuses the environment with changed device light/pulse, water/foam/ambience, creature behavior cues and a clear objective response. Record a before/after state matrix; a silent flag flip is insufficient, and a duplicate map is unnecessary. Chapter state presentation must survive save/continue consistently with gameplay-owned progression.

## 4. Proposed technical contract

### Sources, interchange and axes

Deliver editable DCC files, packed or explicitly tracked textures, high/low source where used, collision source, rig controls and export presets. Preserve acquired originals; derived normalization/export receives a new path and digest. For models, use a self-contained GLB as the canonical portable package payload, plus a tested FBX derivative where the chosen Unreal pipeline requires it. Native `.uasset` files are integration outputs, with engine/build/import settings recorded. Optional USDZ is preview only.

Epic documents GLB import/export and warns that extensions vary in support. Its FBX pipeline uses FBX 2020.2. These establish format candidates, not proof that this project's chosen exporter, skeleton, materials or clips round-trip correctly. Run the representative import before locking that route. [Epic glTF support](https://dev.epicgames.com/documentation/en-us/unreal-engine/gltf-file-format-support-in-unreal-engine), [Epic FBX pipeline](https://dev.epicgames.com/documentation/unreal-engine/fbx-content-pipeline).

Author logical dimensions in centimetres; use Unreal +X forward/+Z up at the engine boundary. GLB stores metre-based dimensions under its format convention; record the conversion and perform it exactly once. [Khronos glTF units specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units). Export an asymmetric one-metre calibration object and a character with known height, named forward arrow and ground marker. Verify bounds, facing, handedness, winding, normals and contact in Unreal. Do not copy the old OBJ mirror workaround into FBX/GLB exports. Apply object transforms; no unexplained negative/nonuniform scale.

Candidate assembly grid: 50 cm base increments, 100/200 cm wall spans; 10 cm detail increments where necessary. Match image proportions before fixing building dimensions. Do not snap sculpted rock silhouettes into visible square grids. Record each asset's final bounding dimensions and placement anchor.

### Geometry, pivots, LOD and collision

| Profile | Proposed LOD0 planning band | Texture/slot starting allowance | Pivot/collision |
| --- | --- | --- | --- |
| Hero healing assembly | 50k–100k triangles for complete visible building; modules tracked separately | Shared 1k–2k surfaces; up to four visible material slots per module | Floor anchor plus named roof/facade anchors; simple wall/entrance blockers. |
| Modular architecture / bridge | 500–12k triangles per module | 1k–2k reusable maps; usually one or two slots | Floor corner or bridge deck-end center; deliberate deck/rail/wall blockers. |
| Tree | 2k–12k per tree, including canopy | 512–1k maps; up to two slots | Ground/root pivot; simple trunk collision, canopy nonblocking. |
| Shrub / grass / flowers | Shrub 300–3k; grass/flower clump 32–400 | 512–1k shared maps; one slot preferred | Ground pivot; decorative geometry has no collision; encounter volume is separate. |
| Rock / bank | 250–6k per rock; bank module 1k–12k | 1k–2k shared maps | Documented base/snap edge; authored bank/boundary collision. |
| Prop | 250–5k per ordinary prop | 512–1k; one or two slots | Placement base or hinge; only needed blockers/interaction overlaps. |
| Human | 20k–45k per dressed appearance | 2k character set; up to three slots | Ground-centered skeletal root; movement capsule independent of visible mesh. |
| Creature | 12k–35k per base-stage creature; large forms need separate review | 1k–2k; up to two slots | Species-specific grounded root; nonblocking follower presentation, battle anchors separate. |

These are scoping bands, not measured limits or permission to simplify away the target. Count complete render mesh triangles and include leaf geometry; track material sections and placed instances separately. If a representative needs more, revise its budget with visible evidence before repeating the asset. Do not derive scene cost from the prototype's 1,671 source triangles.

Start repeatable meshes with LOD0/1/2 near 100/50/20 percent, preserving silhouette, canopy fullness, roof contour, rope and character features. Small grass may instead cull or reduce density when the approved frame permits it. Record screen-size thresholds; inspect transitions through gameplay zoom under the actual orthographic camera. No dependence on Nanite, Lumen or another feature is locked by this plan.

Keep ground, river boundaries, building walls, bridge deck/rails and navigation collision explicit. Tiles, leaves, flowers, rope strands and plank grooves are visual detail. Roof/foliage visibility treatment changes appearance without changing collision. Test repeated occlusion entry/exit and restore behavior; no foreground canopy holes or flicker accepted merely because movement works.

### Materials and textures

Use a shared warm painterly family with shaped tiles/planks and rounded stone forms. Base color uses sRGB; normal and packed data use linear sampling. Proposed engine ORM packing is R=occlusion, G=roughness, B=metallic; define GLB texture bindings separately and verify reconstruction. Record the normal-map convention and any channel conversion exactly once. Most plaster, wood, foliage and rock are nonmetallic; keep shiny/plastic response out of those surfaces.

Prefer opaque surfaces and controlled masked foliage. Keep glass/water translucency bounded; inspect overlapping foliage/water and lighting together. Preserve separate painterly material source layers, mask channels and import settings. Native wind, water, foam, emissive and occlusion behavior needs engine material assets; it is not guaranteed by portable material transfer.

Production maps use power-of-two sizes, edge dilation/padding, validated UVs, repetition tests and mip chains. Start at 512–1024 for foliage/props and 1024–2048 for structures/hero assets. Justify larger maps using actual screen coverage and memory measurements. World textures must be inspected close and distant for seams, blur, shimmer and atlas bleed. UI texture/font settings are a separate policy. Unreal exposes mip generation, texture groups, streaming and color settings; save the chosen settings with the package evidence. [Epic Texture Asset Editor](https://dev.epicgames.com/documentation/unreal-engine/texture-asset-editor-in-unreal-engine).

### Characters and animation

- One versioned stylized human rig where proportions permit; record hierarchy, reference pose, skin-weight limits and attachment/effect sockets. Candidate: at most four influences per vertex, in-place locomotion and 30 fps baked interchange clips. These choices await the proof import; they do not promise generic mannequin compatibility.
- Trainer minimum: idle, walk, run, interact and battle-command. Residents add seated idle and conversation gesture; attendant/service staff add an appropriate service gesture. Validate hands, feet, clothing, shoulders and head/face at the game camera.
- Species-appropriate rigs; do not force quadrupeds, bipeds and birds onto one skeleton. Species entries must include editable rig, skinned mesh, materials, portrait and declared action coverage. Reference appearances need idle and pictured movement/pose at S2. Any enabled chapter species additionally needs idle, locomotion, attack cue, hit, faint and applicable release/capture presentation. Walk/run and release/capture can require separate clips; six action classes do not equal six files.
- Record clip names, rig version, length, loop flag, root-motion policy, foot contacts, effect sockets and event markers. Shared attack cues are acceptable only for the supported action set; they do not promise a bespoke animation for every imported move. Damage, capture outcome, rewards and saves remain gameplay-owned, never animation callbacks.
- Keep PokéAPI species facts, local presentation scale and scene instance scale separate. Record any deliberate readability adjustment. Do not enable a form while its models/actions or gameplay support are absent.

### UI, effects and audio

S2 uses the location badge, illustrated circular minimap/north/player/landmark markers, three species portraits and bars, and circular bag/menu controls seen in the reference. Author legible signs. Build a separate normal-play six-member party state and focus/hover/pressed/disabled states; include non-color type/status cues and keyboard/controller glyphs. S3 adds all screens in the brief, full-party/storage-full, no-PP, fainted, unknown-entry, save-pending/success/failure and unavailable-action feedback. Font/source usage status belongs in the inventory.

Water needs flow, falling water, foam and shoreline/ripple treatment. Battle and restoration effects are event-driven presentation assets with bounded lifetime, clear targets and reduced-motion variants. Supported move/status coverage comes from the locked gameplay support matrix; generic hit effects do not establish support for all moves.

Audio production is S3, not a prerequisite for the still reference-frame comparison. Candidate deliverables: editable sessions/stems and loop-ready 48 kHz/24-bit WAV masters; music/ambience stereo and positional effects mono where appropriate. Confirm actual Unreal import/compression/channel routing in the proof stage. Track loop points, tails, gain targets and before/after restoration mix. Creature calls need per-species source/usage records; do not infer permission from a PokéAPI media link. Voice acting is deferred.

## 5. Source strategy and Game Development Studio handoff

Prefer art directed original modeling and texture/rig work for the healing landmark, characters, bridge and reference-critical vegetation. Inspect existing bytes before sourcing alternatives. Compatible reusable rocks/props can be catalog candidates after source, usage, style and integrity checks. Generic packs, automatic rigs and generated images are candidates only; none is presumed to match the reference. Generated concept art is not geometry. No provider or purchased pack is selected in this plan.

The CLI check `game-dev --version` failed because the command is not available in the active PowerShell PATH. The installed plugin contains skills, but execution capability/schema, Blender readiness, catalog and provider credential status were **not verified**. No installation, provider substitution or credential change was attempted. This blocks CLI-backed production/verification here, not completion of this plan.

At execution, follow the installed skill references and use these read-only discovery/check commands as applicable:

```text
game-dev --version
game-dev capabilities --json
game-dev doctor --json
game-dev credentials status --json
game-dev asset inspect <resolved-model.glb> --json
game-dev asset validate <resolved-model.glb> --request <resolved-policy.json> --json
game-dev package verify <resolved-package-id-or-path> --json
```

These are unexecuted templates. Discover `capabilities.data.localOperations` before producing CLI request files. The inventory JSON is not such a request. Provider execution requires CLI 1.0.2 or newer per the installed skill, configured status checked without reading values, an exact job request and explicit spend ceiling. No provider job, retry or spend flag is authorized by this planning request.

For each model, preserve the distinct receipt chain: source/acquisition or provider result → downloaded source bytes, if applicable → inspection → optional normalization into a new destination → policy validation → canonical package build → package verification → vendor dry run → authorized admission → verification of copied bytes and project lock receipt. Bind original/derived digests, prompts and negative prompts where applicable, job IDs, transformations, policy version and license evidence. Do not invent prompts for manually authored work; mark them not applicable.

Package construction, normalization, preview generation, downloads and admission are future write actions. Resolve their exact inputs, output workspace/destination and collision behavior before executing them under the relevant authorization. Project execution, capture and performance measurement have separate scopes. Preparation of a reviewable plan does not require asking for any of those actions now.

Portable admission target: project `Game/`, destination `SourceAssets/Verdant/<package-id>/<version>/`. This is a proposed layout, not a claimed vendor result. Native imports go to the inventory's `/Game/Verdant/Production/...` namespaces and must preserve dependency paths. Package verification is required immediately before admission and again on the copied package. Never bypass unknown-license/invalid-package blockers silently. Engine import and visual approval remain distinct from copied-byte integrity.

### Release evidence required

| Gate | Required record | What it establishes |
| --- | --- | --- |
| Source/usage | Author or source URL, acquisition date, original hash, retained terms/attribution, per-file usage status, transformation history | Traceability and recorded usage decision; unknown stays unresolved. Do not assign a permissive SPDX license by assumption. |
| Static asset | Actual file type, finite geometry, indices/UVs/normals/tangents, textures/references, dimensions/axes/pivots, topology/rig/action policy, slots/LODs/collision roster | Conformance to the recorded file policy. |
| Canonical package | Closed SHA-256 roster, ID/version, dependencies, validation policy/result and receipt, verified manifest digest | Package integrity; metadata tampering or missing files fail. |
| Admission | Exact destination plan, approved invocation, copied-package verification and project lock receipt | Intended bytes copied to intended project. |
| Unreal integration | Engine build/import settings, reopen, bounds/materials/rig/clips/sockets, collision, mips/LOD and cook logs | Tested engine integration for the recorded build. |
| Runtime/state | Visibility/movement, service interactions, device before/after, reduced motion, audio loops, UI/input states, save/continue presentation | Observable behavior for exercised states only. |
| Visual | Matched capture, overlay/crops, discrepancy log, user review and agreed deviations | Approval of the reviewed appearance; no file check substitutes for it. |
| Performance | Agreed hardware, settings/resolution, repeatable route, frame-time distribution, GPU/CPU times, draw calls, resident/peak texture memory and overdraw observations | Measured cost on that hardware/scenario. |

Engine-owned content, external media, generated images and recognizable Pokémon design/branding require their own provenance/usage entries. A model author's file license or a catalog URL alone is not the complete usage record. Keep unresolved source suitability visible before sourcing or redistribution.

## 6. Matching-scene review and performance lock

Freeze the reference hash from the inventory. Its source image is 1672×941; use a documented 16:9 comparison canvas, preserving aspect rather than stretching it. Record any minimal fitting border or crop. Capture the actual Unreal matching scene at 1920×1080 with fixed scene seed/state, camera transform/projection/orthographic width, exposure, lighting, renderer/scalability, HUD scale and actor poses. The delivered corner's pitch -38/yaw -45 and the older proposed camera are starting points; select whichever final values reproduce the target and record them.

Review full-frame composition first: healing landmark upper-left, cottage/plaza upper-middle, central trainer/Pikachu, grass/Bulbasaur lower-left, right-path trainer/Charmander, cascades and stream on the right, bridge lower-right, foreground framing and HUD corners. Then compare aligned overlays and crops for architecture, vegetation, characters, water/bridge and UI. Log every unresolved difference with asset IDs and a proposed correction. No numerical similarity threshold replaces user review or permits a claim of “100% matched” while visible differences remain.

After the still view is accepted, test movement/zoom, occlusion restoration, material repetition, LODs, reduced motion, 16:10/ultrawide and UI focus/contrast. Keep visual comparison evidence separate from functional traversal evidence. Reference staging must be isolated from normal progression/save state.

Minimum hardware and numerical performance targets remain open. The documented Ryzen 7 5700X/RTX 3060 Ti/32 GB development PC is a measurement candidate, not the approved minimum. At S0 choose hardware, resolution/scalability, frame-time statistic and ceiling, texture memory limit and capture route. Measure S1's integrated samples before locking repeated module density and S2's full scene before expanding areas. Record tree/grass instance counts, shadow/translucency cost and native material sections; per-mesh triangle bands alone cannot control scene cost. If cost is excessive, preserve the reference composition while revising hidden geometry, section count, shaders, LODs and repeated-detail representation, with another visual check.

## 7. Decisions needed at the relevant gate

| Lock | Proposed default / decision | Needed before |
| --- | --- | --- |
| L0 | Accept the eight-bundle proof scope, role owners, sample scale/grid, reference view and revised per-profile budgets | S1 production |
| L1 | Select source/usage strategy and tested exporter/importer, skeleton/material/texture conventions | S1 batch/export |
| L2 | Agree target hardware, resolution, performance metrics and measured budgets | Repeated library production; final performance acceptance |
| L3 | Lock Chapter 1 content, six-species candidate or alternative, ranger/guarding teams, supported moves/items/evolutions | Dependent creature actions, effects, portraits/calls and chapter production |
| L4 | Approve full S2 engine comparison and record deviations | Multiplying the library into new areas |
| L5 | Any exact sourcing/provider spend, normalization/package/admission invocation or further execution scope | That action only |

Staff by responsibility: art lead owns reference parity; environment artist owns modules/dressing; character artist and animator own human/creature deformation/actions; technical artist owns import/material/LOD/collision integration; UI artist and audio designer own their deliverables; integrator owns release hashes/dependencies; reviewer owns recorded acceptance. These are roles, not assumed hires. Estimate elapsed time and cost after S1 records actual effort, revisions and provider costs, if any. No delivery date, free-license availability or generation success is promised.

## Completion checklist for a future asset release

- [ ] Every enabled entry has locked scope, named accountable owner, source/usage decision and complete dependencies.
- [ ] Eight representative bundles pass their technical/art review; full S2 scene separately passes its user review.
- [ ] Sources, derived model packages and supplemental UI/audio/native bundles have complete versioned hash/provenance records.
- [ ] Canonical package and copied-byte verification pass; vendor lock receipts and native import settings are retained.
- [ ] Required meshes, portraits, rigs, clips, effects, cues and UI states exist for every enabled chapter species/action/location.
- [ ] Collision, player visibility, reduced motion, aspect/focus states and restoration/save presentation pass recorded engine checks.
- [ ] Packaged content opens without missing source/asset dependencies; functional and performance gates pass their agreed scenarios.
- [ ] Release evidence index records remaining deviations and separate static, engine, runtime, performance and user-review statuses.

No production checkbox is checked by creation of this plan.
