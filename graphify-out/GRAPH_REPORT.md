# Graph Report - Pokemon  (2026-10-21)

## Corpus Check
- 32 files · ~484,589 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 40 file(s) not represented in the graph (top: .glb 34, (none) 3, .cmd 1)

## Summary
- 616 nodes · 1619 edges · 21 communities (15 shown, 6 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 72 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9e8f65ec`
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
- build_kit.py
- build_pikachu_v002.py
- blender/build_characters.py
- Verdant Town flora v1
- Build-Proofs.ps1

## God Nodes (most connected - your core abstractions)
1. `V()` - 31 edges
2. `Mesh` - 30 edges
3. `cone()` - 26 edges
4. `cottage()` - 23 edges
5. `ellipsoid()` - 22 edges
6. `tube()` - 22 edges
7. `verify_release()` - 22 edges
8. `pokecenter()` - 21 edges
9. `Model` - 20 edges
10. `bridge()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `f()` --indirect_call--> `rr()`  [INFERRED]
  tools/production/build_pikachu_v002.py → prototypes/blender/build_assets.py
- `cottage_window()` --indirect_call--> `base()`  [INFERRED]
  prototypes/blender/build_assets.py → prototypes/models/verdant-flora-v1/render-models.py
- `f()` --indirect_call--> `rr()`  [INFERRED]
  prototypes/blender/build_characters.py → prototypes/blender/build_assets.py
- `_resolve_source()` --calls--> `contained_file()`  [EXTRACTED]
  tools/production/import_proofs.py → tools/production/verify_release.py
- `_import_mesh()` --calls--> `finite_list()`  [EXTRACTED]
  tools/production/import_proofs.py → tools/production/verify_release.py

## Import Cycles
- None detected.

## Communities (21 total, 6 thin omitted)

### Community 0 - "verify_release.py"
Cohesion: 0.07
Nodes (32): _animation_record(), _bounds(), _import_mesh(), main(), _materials(), _native_assets(), _resolve_source(), _safe_name() (+24 more)

### Community 1 - "main.rs"
Cohesion: 0.18
Nodes (7): game_root(), main(), mime(), PAGE, reply(), serve(), START_URL

### Community 2 - "tauri.conf.json"
Cohesion: 0.14
Nodes (13): app, security, windows, build, frontendDist, bundle, active, icon (+5 more)

### Community 5 - "json"
Cohesion: 0.06
Nodes (12): base(), caption(), color(), material(), accessor(), CharacterProofTests, decode(), decode_glb() (+4 more)

### Community 6 - "rebuild-models.mjs"
Cohesion: 0.07
Nodes (17): build, geometryJSON, glb(), here, html, manifest, models, output (+9 more)

### Community 7 - "build_assets.py"
Cohesion: 0.11
Nodes (43): add_bm(), add_quad(), Asset, b64(), barrel_tile(), bevel(), bm_box(), bm_cyl() (+35 more)

### Community 8 - "import_town.py"
Cohesion: 0.21
Nodes (8): collection(), connect(), expr(), import_files(), load_or_create(), main(), material(), property_link()

### Community 9 - "manifest.json"
Cohesion: 0.09
Nodes (21): created, material, models, provenance, approvedReference, design, license, provider (+13 more)

### Community 12 - "build_environment.py"
Cohesion: 0.11
Nodes (48): add(), arch_ring(), beveled_box(), bridge_anchor(), bridge_deck(), bridge_post(), bridge_rope(), broadleaf() (+40 more)

### Community 13 - "build_characters.py"
Cohesion: 0.08
Nodes (32): add(), build(), Character, creature_clips(), rot(), cross(), dot(), ellipsoid() (+24 more)

### Community 14 - "build_kit.py"
Cohesion: 0.20
Nodes (10): build(), ellipsoid(), flower(), grass(), leaf(), Mesh, roof(), trunk() (+2 more)

### Community 15 - "build_pikachu_v002.py"
Cohesion: 0.09
Nodes (31): activate(), axes(), bake(), bake_actions(), bones(), build_rig(), cover(), decimate() (+23 more)

### Community 16 - "blender/build_characters.py"
Cohesion: 0.06
Nodes (76): b64(), bangs(), bench(), _bounds(), build(), bulbasaur(), bush(), caterpie() (+68 more)

### Community 17 - "Verdant Town flora v1"
Cohesion: 0.33
Nodes (5): Contents, Game integration, Rebuild, Validation boundary, Verdant Town flora v1

### Community 22 - "Build-Proofs.ps1"
Cohesion: 0.46
Nodes (7): Author-Proofs(), Build-Editor(), Build-Sources(), Capture-Proofs(), Import-Proofs(), Invoke-ProofTool(), Test-Proofs()

## Knowledge Gaps
- **1 isolated node(s):** `verdant-town`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 186 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `inspect_glb()` connect `verify_release.py` to `build_environment.py`, `json`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **What connects `verdant-town` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify_release.py` be split into smaller, more focused modules?**
  _Cohesion score 0.06882716049382716 - nodes in this community are weakly interconnected._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `json` be split into smaller, more focused modules?**
  _Cohesion score 0.05786090005844535 - nodes in this community are weakly interconnected._
- **Should `rebuild-models.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `build_assets.py` be split into smaller, more focused modules?**
  _Cohesion score 0.11092896174863388 - nodes in this community are weakly interconnected._