# Graph Report - Pokemon  (2026-10-15)

## Corpus Check
- 19 files · ~5,256 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .ini 3, (none) 2, .uproject 2)

## Summary
- 263 nodes · 467 edges · 12 communities (9 shown, 3 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 50 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- VerdantTrails.Target.cs
- VerdantGame.cpp
- AVerdantCharacter
- TownKit.cpp
- build_kit.py
- TownRules.h
- TownSave.cpp
- import_town.py
- AVerdantGameMode

## God Nodes (most connected - your core abstractions)
1. `AVerdantCharacter` - 56 edges
2. `ATownKit` - 23 edges
3. `FSnapshot` - 13 edges
4. `Mesh` - 13 edges
5. `AVerdantGameMode` - 10 edges
6. `build()` - 10 edges
7. `EQuest` - 9 edges
8. `EFocus` - 9 edges
9. `AVerdantHUD` - 8 edges
10. `grass()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `ATownKit` --references--> `UStaticMeshComponent`  [EXTRACTED]
  Game/Source/VerdantTrails/TownKit.h → Game/Source/VerdantTrails/VerdantGame.h
- `FSnapshot` --references--> `EQuest`  [EXTRACTED]
  Game/Source/VerdantTrails/TownSave.h → Game/Source/VerdantTrails/TownRules.h
- `AVerdantCharacter` --references--> `EQuest`  [EXTRACTED]
  Game/Source/VerdantTrails/VerdantGame.h → Game/Source/VerdantTrails/TownRules.h
- `AVerdantGameMode::AVerdantGameMode()` --references--> `AVerdantCharacter`  [EXTRACTED]
  Game/Source/VerdantTrails/VerdantGame.cpp → Game/Source/VerdantTrails/VerdantGame.h
- `Valid()` --references--> `FSnapshot`  [EXTRACTED]
  Game/Source/VerdantTrails/TownSave.cpp → Game/Source/VerdantTrails/TownSave.h

## Import Cycles
- None detected.

## Communities (12 total, 3 thin omitted)

### Community 0 - "VerdantTrails.Target.cs"
Cohesion: 0.24
Nodes (3): VerdantTrailsTarget, VerdantTrails, VerdantTrailsEditorTarget

### Community 1 - "VerdantGame.cpp"
Cohesion: 0.06
Nodes (6): AVerdantCharacter::AVerdantCharacter(), AVerdantGameMode::AVerdantGameMode(), AVerdantHUD, UIScale, SlotName(), UStaticMeshComponent

### Community 2 - "AVerdantCharacter"
Cohesion: 0.05
Nodes (27): AVerdantCharacter, bHasSave, bLoadFailed, bMenuOpen, Boom, bReducedMotion, bSaveFailed, bSprinting (+19 more)

### Community 4 - "TownKit.cpp"
Cohesion: 0.10
Nodes (6): ATownKit, HerbMarker, Pools, Random, UInstancedStaticMeshComponent, UMaterialInterface

### Community 5 - "build_kit.py"
Cohesion: 0.18
Nodes (10): build(), ellipsoid(), flower(), grass(), leaf(), Mesh, roof(), trunk() (+2 more)

### Community 6 - "TownRules.h"
Cohesion: 0.11
Nodes (21): Advance(), EFocus, Cottage, Gardener, Herb, None, Sign, EQuest (+13 more)

### Community 7 - "TownSave.cpp"
Cohesion: 0.14
Nodes (12): Decode(), Encode(), Exists(), FSnapshot, bReducedMotion, Position, Quest, Revision (+4 more)

### Community 8 - "import_town.py"
Cohesion: 0.19
Nodes (8): collection(), connect(), expr(), import_files(), load_or_create(), main(), material(), property_link()

### Community 9 - "AVerdantGameMode"
Cohesion: 0.20
Nodes (6): AVerdantGameMode, bCapture, bSmoke, SmokeStep, SmokeStepTime, SmokeTime

## Knowledge Gaps
- **45 isolated node(s):** `Pools`, `HerbMarker`, `Random`, `MeetGardener`, `FindHerb` (+40 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 127 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AVerdantCharacter` connect `AVerdantCharacter` to `VerdantGame.cpp`, `TownRules.h`, `AVerdantGameMode`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **What connects `Pools`, `HerbMarker`, `Random` to the rest of the system?**
  _45 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `VerdantGame.cpp` be split into smaller, more focused modules?**
  _Cohesion score 0.0595959595959596 - nodes in this community are weakly interconnected._
- **Why does `ATownKit` connect `TownKit.cpp` to `VerdantGame.cpp`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Should `AVerdantCharacter` be split into smaller, more focused modules?**
  _Cohesion score 0.051418439716312055 - nodes in this community are weakly interconnected._
- **Why does `EQuest` connect `TownRules.h` to `AVerdantCharacter`, `TownSave.cpp`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Should `TownKit.cpp` be split into smaller, more focused modules?**
  _Cohesion score 0.09634551495016612 - nodes in this community are weakly interconnected._