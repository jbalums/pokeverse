# Graph Report - Pokemon  (2026-10-21)

## Corpus Check
- 81 files · ~507,931 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 40 file(s) not represented in the graph (top: .glb 34, (none) 3, .cmd 1)

## Summary
- 1573 nodes · 5128 edges · 59 communities (49 shown, 10 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 110 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0e0ef29d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- verify_release.py
- main.rs
- tauri.conf.json
- verdant-town
- json
- rebuild-models.mjs
- build_assets.py
- import_town.py
- manifest.json
- build_environment.py
- build_characters.py
- 16-fleurville-world.js
- build_pikachu_v002.py
- blender/build_characters.py
- buildFloraModels
- compose_trainer_battle.mjs
- tone
- glb
- battle-rules.test.mjs
- Build-Proofs.ps1
- CharacterProofTests
- EnvironmentSourceTests
- render-models.py
- KitTests
- 09-terrain.js
- 05-paths-raised-plaza-stairs-tall-grass.js
- 34-battle-tweens-effects-arena.js
- 24-fleurville-hud-travel.js
- 40-battle-flow.js
- 26-key-bindings.js
- 44-game-menu.js
- 41-loop.js
- 21-side-quests.js
- 29-save.js
- 19-characters.js
- 30-backpack.js
- 13-flora.js
- 45-onboarding.js
- 38-battle-moves.js
- 28-evolution-data.js
- 06-renderer-scene-post.js
- 32-pokedex.js
- 20-story-chapter-1.js
- 15-hand-placement.js
- 14-buildings.js
- 08-blender-assets.js
- questChanged
- 35-battle-hud-messages-menus.js
- 37-battle-sound-effects.js
- makeHuman
- 27-pokemon-data.js
- dexArtwork
- Character
- glb_bytes

## God Nodes (most connected - your core abstractions)
1. `clamp()` - 39 edges
2. `terrainH()` - 39 edges
3. `rnd()` - 38 edges
4. `rr()` - 36 edges
5. `update()` - 36 edges
6. `V()` - 31 edges
7. `Mesh` - 30 edges
8. `add()` - 29 edges
9. `walkH()` - 27 edges
10. `useMove()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `f()` --indirect_call--> `rr()`  [INFERRED]
  tools/production/build_pikachu_v002.py → prototypes/blender/build_assets.py
- `Game integration` --references--> `buildFloraModels()`  [INFERRED]
  prototypes/models/verdant-flora-v1/README.md → prototypes/src/13-flora.js
- `ambientTick()` --indirect_call--> `OUT`  [INFERRED]
  prototypes/src/21-side-quests.js → tools/compose_trainer_battle.mjs
- `cottage_window()` --indirect_call--> `base()`  [INFERRED]
  prototypes/blender/build_assets.py → prototypes/models/verdant-flora-v1/render-models.py
- `play()` --indirect_call--> `OUT`  [INFERRED]
  prototypes/src/37-battle-sound-effects.js → tools/compose_trainer_battle.mjs

## Import Cycles
- 3-file cycle: `prototypes/src/19-characters.js -> prototypes/src/28-evolution-data.js -> prototypes/src/29-save.js -> prototypes/src/19-characters.js`
- 3-file cycle: `prototypes/src/21-side-quests.js -> prototypes/src/28-evolution-data.js -> prototypes/src/29-save.js -> prototypes/src/21-side-quests.js`
- 3-file cycle: `prototypes/src/20-story-chapter-1.js -> prototypes/src/29-save.js -> prototypes/src/24-fleurville-hud-travel.js -> prototypes/src/20-story-chapter-1.js`
- 3-file cycle: `prototypes/src/26-key-bindings.js -> prototypes/src/35-battle-hud-messages-menus.js -> prototypes/src/29-save.js -> prototypes/src/26-key-bindings.js`
- 4-file cycle: `prototypes/src/08-blender-assets.js -> prototypes/src/19-characters.js -> prototypes/src/28-evolution-data.js -> prototypes/src/29-save.js -> prototypes/src/08-blender-assets.js`
- 4-file cycle: `prototypes/src/10-streaming.js -> prototypes/src/19-characters.js -> prototypes/src/28-evolution-data.js -> prototypes/src/29-save.js -> prototypes/src/10-streaming.js`
- 4-file cycle: `prototypes/src/10-streaming.js -> prototypes/src/41-loop.js -> prototypes/src/28-evolution-data.js -> prototypes/src/29-save.js -> prototypes/src/10-streaming.js`
- 4-file cycle: `prototypes/src/10-streaming.js -> prototypes/src/41-loop.js -> prototypes/src/45-onboarding.js -> prototypes/src/29-save.js -> prototypes/src/10-streaming.js`
- 4-file cycle: `prototypes/src/19-characters.js -> prototypes/src/24-fleurville-hud-travel.js -> prototypes/src/20-story-chapter-1.js -> prototypes/src/29-save.js -> prototypes/src/19-characters.js`
- 4-file cycle: `prototypes/src/19-characters.js -> prototypes/src/40-battle-flow.js -> prototypes/src/28-evolution-data.js -> prototypes/src/29-save.js -> prototypes/src/19-characters.js`
- 4-file cycle: `prototypes/src/19-characters.js -> prototypes/src/40-battle-flow.js -> prototypes/src/35-battle-hud-messages-menus.js -> prototypes/src/29-save.js -> prototypes/src/19-characters.js`
- 4-file cycle: `prototypes/src/19-characters.js -> prototypes/src/28-evolution-data.js -> prototypes/src/29-save.js -> prototypes/src/21-side-quests.js -> prototypes/src/19-characters.js`
- 4-file cycle: `prototypes/src/21-side-quests.js -> prototypes/src/26-key-bindings.js -> prototypes/src/35-battle-hud-messages-menus.js -> prototypes/src/29-save.js -> prototypes/src/21-side-quests.js`
- 4-file cycle: `prototypes/src/21-side-quests.js -> prototypes/src/26-key-bindings.js -> prototypes/src/45-onboarding.js -> prototypes/src/29-save.js -> prototypes/src/21-side-quests.js`
- 4-file cycle: `prototypes/src/21-side-quests.js -> prototypes/src/40-battle-flow.js -> prototypes/src/28-evolution-data.js -> prototypes/src/29-save.js -> prototypes/src/21-side-quests.js`
- 4-file cycle: `prototypes/src/21-side-quests.js -> prototypes/src/40-battle-flow.js -> prototypes/src/35-battle-hud-messages-menus.js -> prototypes/src/29-save.js -> prototypes/src/21-side-quests.js`
- 4-file cycle: `prototypes/src/16-fleurville-world.js -> prototypes/src/28-evolution-data.js -> prototypes/src/29-save.js -> prototypes/src/22-collision.js -> prototypes/src/16-fleurville-world.js`
- 4-file cycle: `prototypes/src/19-characters.js -> prototypes/src/28-evolution-data.js -> prototypes/src/29-save.js -> prototypes/src/22-collision.js -> prototypes/src/19-characters.js`
- 4-file cycle: `prototypes/src/21-side-quests.js -> prototypes/src/28-evolution-data.js -> prototypes/src/29-save.js -> prototypes/src/22-collision.js -> prototypes/src/21-side-quests.js`
- 4-file cycle: `prototypes/src/19-characters.js -> prototypes/src/28-evolution-data.js -> prototypes/src/29-save.js -> prototypes/src/23-hud-minimap.js -> prototypes/src/19-characters.js`

## Communities (59 total, 10 thin omitted)

### Community 0 - "verify_release.py"
Cohesion: 0.06
Nodes (32): _animation_record(), _bounds(), _import_mesh(), main(), _materials(), _native_assets(), _resolve_source(), _safe_name() (+24 more)

### Community 1 - "main.rs"
Cohesion: 0.18
Nodes (7): game_root(), main(), mime(), PAGE, reply(), serve(), START_URL

### Community 2 - "tauri.conf.json"
Cohesion: 0.14
Nodes (13): app, security, windows, build, frontendDist, bundle, active, icon (+5 more)

### Community 5 - "json"
Cohesion: 0.18
Nodes (3): decode(), decode_glb(), read_accessor()

### Community 6 - "rebuild-models.mjs"
Cohesion: 0.08
Nodes (16): build, geometryJSON, here, html, manifest, models, output, renderArg (+8 more)

### Community 7 - "build_assets.py"
Cohesion: 0.11
Nodes (43): add_bm(), add_quad(), Asset, b64(), barrel_tile(), bevel(), bm_box(), bm_cyl() (+35 more)

### Community 8 - "import_town.py"
Cohesion: 0.25
Nodes (8): collection(), connect(), expr(), import_files(), load_or_create(), main(), material(), property_link()

### Community 9 - "manifest.json"
Cohesion: 0.09
Nodes (21): created, material, models, provenance, approvedReference, design, license, provider (+13 more)

### Community 12 - "build_environment.py"
Cohesion: 0.08
Nodes (57): build(), ellipsoid(), flower(), grass(), leaf(), Mesh, roof(), trunk() (+49 more)

### Community 13 - "build_characters.py"
Cohesion: 0.11
Nodes (28): add(), build(), creature_clips(), rot(), cross(), dot(), ellipsoid(), face_oval() (+20 more)

### Community 14 - "16-fleurville-world.js"
Cohesion: 0.07
Nodes (59): pick(), rnd(), rr(), setSeed(), canvasTex(), cobbleTex, detailTex, houseTex (+51 more)

### Community 15 - "build_pikachu_v002.py"
Cohesion: 0.09
Nodes (31): activate(), axes(), bake(), bake_actions(), bones(), build_rig(), cover(), decimate() (+23 more)

### Community 16 - "blender/build_characters.py"
Cohesion: 0.06
Nodes (76): b64(), bangs(), bench(), _bounds(), build(), bulbasaur(), bush(), caterpie() (+68 more)

### Community 17 - "buildFloraModels"
Cohesion: 0.21
Nodes (22): Contents, Game integration, Rebuild, Validation boundary, Verdant Town flora v1, noise(), buildFloraModels(), clover() (+14 more)

### Community 18 - "compose_trainer_battle.mjs"
Cohesion: 0.08
Nodes (17): dir, DRUM, dryL, dryR, echo, L, LEN, R (+9 more)

### Community 19 - "tone"
Cohesion: 0.20
Nodes (11): arpNote(), bassNote(), blep(), brass(), compNote(), lead(), noiseHit(), padNote() (+3 more)

### Community 21 - "battle-rules.test.mjs"
Cohesion: 0.14
Nodes (26): accMul(), accuracyHits(), ailOf(), AILS, catchRoll(), clampStage(), damage(), EFF (+18 more)

### Community 22 - "Build-Proofs.ps1"
Cohesion: 0.46
Nodes (7): Author-Proofs(), Build-Editor(), Build-Sources(), Capture-Proofs(), Import-Proofs(), Invoke-ProofTool(), Test-Proofs()

### Community 26 - "EnvironmentSourceTests"
Cohesion: 0.17
Nodes (3): EnvironmentSourceTests, ray_y_hits(), signed_volume()

### Community 27 - "render-models.py"
Cohesion: 0.29
Nodes (4): base(), caption(), color(), material()

### Community 29 - "09-terrain.js"
Cohesion: 0.05
Nodes (52): CLEAR, EDGE, OLD_FILL, ROUTE_GRASS, STA, bed, cellKey(), cellOf() (+44 more)

### Community 30 - "05-paths-raised-plaza-stairs-tall-grass.js"
Cohesion: 0.08
Nodes (54): inPoly(), segD(), smooth(), BU, inKField(), inRect(), K_WALK, kPaved() (+46 more)

### Community 31 - "34-battle-tweens-effects-arena.js"
Cohesion: 0.09
Nodes (54): addFx(), at(), B_LOOK, beam(), blobTex, bolt(), CAST, charge() (+46 more)

### Community 32 - "24-fleurville-hud-travel.js"
Cohesion: 0.06
Nodes (43): FPV_FOG, _ndc, _ray, VS(), FOLK, inKalos(), K(), K_DIRT (+35 more)

### Community 33 - "40-battle-flow.js"
Cohesion: 0.13
Nodes (39): MOVES, renderPass, rangerTalk(), renderObjective(), noteWild(), scrapsTalk(), SPECIES, healParty() (+31 more)

### Community 34 - "26-key-bindings.js"
Cohesion: 0.09
Nodes (35): clamp(), KAL, roomAt(), profTalk(), fadeTo(), kalosTick(), placePlayer(), portalKey() (+27 more)

### Community 35 - "44-game-menu.js"
Cohesion: 0.12
Nodes (37): galleryD(), swing(), tickXYMixers(), chapterSave(), ambientTick(), flashHint(), setCurSlot(), setPlayTime() (+29 more)

### Community 36 - "41-loop.js"
Cohesion: 0.09
Nodes (30): approach(), squash(), wrapAngle(), viewFog(), lodTick(), animWalk(), bend(), P (+22 more)

### Community 37 - "21-side-quests.js"
Cohesion: 0.10
Nodes (25): chapterCard(), AMB, clemontTalk(), distLabel(), GUIDE_EDGE, guideTick(), MAIN_TEXT, MARK_COL (+17 more)

### Community 38 - "29-save.js"
Cohesion: 0.08
Nodes (19): setTrainerProfile(), DEV_AT, syncKeyItems(), GUIDE, RIVAL_AT, setTracked(), SIDE, STREAM (+11 more)

### Community 39 - "19-characters.js"
Cohesion: 0.08
Nodes (26): _blackCache, bodyBounds(), bulba, CH, CH0, charm, CHARS, CMAT (+18 more)

### Community 40 - "30-backpack.js"
Cohesion: 0.16
Nodes (25): aOr(), bag, evoFor(), setMoney(), saveGame(), bagApply(), bagPocket(), bagToast() (+17 more)

### Community 41 - "13-flora.js"
Cohesion: 0.12
Nodes (23): hash2(), hash3(), batches, blobGeo(), BOX, _c, circles, CYL (+15 more)

### Community 42 - "45-onboarding.js"
Cohesion: 0.12
Nodes (19): START, pika, player, keys, ui, act(), say(), showLine() (+11 more)

### Community 43 - "38-battle-moves.js"
Cohesion: 0.24
Nodes (23): cure(), sideEffectLands(), TYPE_COL, typesOf(), burst(), modelOf(), MOVE_FX, who() (+15 more)

### Community 44 - "28-evolution-data.js"
Cohesion: 0.12
Nodes (22): expAt(), XY, parseLearn(), bagAt, calcStats(), CHARM_H, EVO_CHECK, EVO_SPECIES (+14 more)

### Community 45 - "06-renderer-scene-post.js"
Cohesion: 0.12
Nodes (19): bloom, camera, canvas, composer, DPR, FOG, HAZE, renderer (+11 more)

### Community 46 - "32-pokedex.js"
Cohesion: 0.15
Nodes (21): cleanClip(), mostlyBlack(), cacheDexModel(), DEX_DISPLAY, DEX_GAME_SPECIES, DEX_MODELS, DEX_TEXTURE_FIXES, dexReducedMotion (+13 more)

### Community 47 - "20-story-chapter-1.js"
Cohesion: 0.10
Nodes (18): interactables, clueOpen(), CLUES, DEV, GUARD, GUARD_AT, GUARD_REST, GUARD_STREAM (+10 more)

### Community 48 - "15-hand-placement.js"
Cohesion: 0.14
Nodes (18): catmull(), heroCam, I(), RI, RIVER_PX, RV, RV_BOX, RV_S (+10 more)

### Community 49 - "14-buildings.js"
Cohesion: 0.15
Nodes (15): add(), mat(), SPH, assetGroup(), wallSeg(), BENCH, CF, COT (+7 more)

### Community 50 - "08-blender-assets.js"
Cohesion: 0.15
Nodes (13): scene, AMAT, decodeAssets(), FAR_GEO, farLod(), flushInstances(), instanceInto(), instQueue (+5 more)

### Community 51 - "questChanged"
Cohesion: 0.20
Nodes (14): fightGuardian(), lines(), placeStoryNpcs(), questChanged(), reached(), restored(), shutDevice(), spawnGuardian() (+6 more)

### Community 52 - "35-battle-hud-messages-menus.js"
Cohesion: 0.22
Nodes (13): hpClass(), BT, battleKey(), bconfirm(), drawBoxes(), menuHighlight(), menuPick(), MN (+5 more)

### Community 53 - "37-battle-sound-effects.js"
Cohesion: 0.29
Nodes (12): bell(), bubble(), DRIVE(), DRIVES, noiseBuf(), noiseV(), oscV(), play() (+4 more)

### Community 54 - "makeHuman"
Cohesion: 0.27
Nodes (12): humanBody(), humanJoint(), makeHuman(), npc(), setTrainer(), spawnProf(), spawnRanger(), spawnRival() (+4 more)

### Community 55 - "27-pokemon-data.js"
Cohesion: 0.36
Nodes (10): makeBulbasaur(), makeCharmander(), makePikachu(), rig(), STATUS, makeCaterpie(), makeOddish(), makePidgey() (+2 more)

### Community 56 - "dexArtwork"
Cohesion: 0.20
Nodes (11): dexPlane(), portrait(), closePokedex(), dexArtwork(), dexKey(), dexNormalize(), dexNumber(), dexShow() (+3 more)

### Community 58 - "glb_bytes"
Cohesion: 0.50
Nodes (3): glb_bytes(), GlbWriter, gltf_normal()

## Knowledge Gaps
- **1 isolated node(s):** `verdant-town`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 379 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `OUT` connect `37-battle-sound-effects.js` to `compose_trainer_battle.mjs`, `44-game-menu.js`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `rnd()` (e.g. with `canAct()` and `damage()`) actually correct?**
  _`rnd()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `verdant-town` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify_release.py` be split into smaller, more focused modules?**
  _Cohesion score 0.06456908344733242 - nodes in this community are weakly interconnected._
- **Why does `ambientTick()` connect `44-game-menu.js` to `26-key-bindings.js`, `21-side-quests.js`, `questChanged`, `37-battle-sound-effects.js`, `05-paths-raised-plaza-stairs-tall-grass.js`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Why does `buildFloraModels()` connect `buildFloraModels` to `13-flora.js`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._