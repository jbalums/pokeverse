# Verdant corner asset kit v1

An editable stylized environment kit for the town reference in this repository.

## Contents

- `meshes/`: eight deterministic OBJ source meshes: gabled roof, flared trunk, leaf canopy, rock, grass tuft, flower head, pointed leaf and subdivided water surface. These are geometry, not pictures of geometry.
- `textures/town-material-atlas.png`: generated material artwork with four equal quadrants: meadow, paving, timber, roof. No downloaded third-party asset pack is used.
- `manifest.json`: source hashes, triangle counts, units, generation seed, provenance and known limits.
- `../../Game/Content/Art/`: imported Unreal static meshes, texture, material parameter collection and thirty editable materials.
- `../../Game/Source/VerdantTrails/TownKit.cpp`: deterministic reusable assemblies for the cottage, trees, bridge, fence, bench, lamp, garden and river.

## Conventions

Source models use centimetres and right-handed OBJ Z-up. The OBJ writer exports `(x,-y,z)` and reverses triangle winding from the Unreal design coordinates; the installed legacy Unreal OBJ importer mirrors Y on import. Imported bounds are checked so a sideways roof or trunk cannot pass unnoticed. Roof footprint is 100 × 100 cm and height 50 cm; the trunk is 100 cm high with its pivot at the bottom. Canopy and rock pivots are at their centres. Grass and flower pivots are at ground height.

Place the imported meshes in any level and assign the corresponding `M_` material. The atlas materials use world-space triplanar sampling, with editable `TileSizeCm`, so changing object dimensions does not stretch one texture across a whole building. The non-power-of-two source atlas uses clamped sampling, an inset within each quadrant, and no generated mipmaps. This first small kit deliberately favours consistent sampling over texture streaming; a full library should receive production-sized individually validated textures and mip chains after visual approval.

Decorative meshes have no collision. The trunk has simple box collision. The town assembly owns ground, building, fence-post, bridge-deck, bridge-rail, river-bank and boundary collision separately. Foliage is instanced by shared mesh/material. Leaves and water animate through their material; `MPC_Town.Motion` supports reduced motion. `MPC_Town.Player` opens a small visibility aperture through nearby overhead leaves and roofs.

## Regeneration

From the project root:

```powershell
py -3 tools/build_kit.py
powershell -File tools/Build-Town.ps1 -Stage assets
```

The generator is dependency-free and deterministic. The generated artwork is retained rather than regenerated, and its hash is recorded. The Unreal importer updates only the kit's generated assets and town map; keep hand-authored additions in a separate directory/map. `ArtPipeline.uproject` is the content-only import host and is not the playable project.

## Scope and provenance

Geometry and assembly scripts are project-authored. The atlas was generated with OpenAI image generation for this project; the original concept is retained under `docs/references`. Unreal Basic Shapes and its daylight cubemap are engine content used by the runtime assemblies and characters. The trainer, gardener and Bulbasaur are constructed character studies with procedural limb motion; they are not final skinned/rigged character assets or a finished roster pipeline. No Pokémon facts are invented or loaded from the research cache by this scene.

Visual similarity, seamless repetition, performance and character quality need actual engine evidence. See the delivery evidence document for completed checks and remaining limits.
