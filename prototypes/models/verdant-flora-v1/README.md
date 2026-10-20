# Verdant Town flora v1

26 original, low-poly 3D models plus 8 lower-detail tree GLBs. Created from the approved layered-leaf screenshot concept. These are real meshes; the preview PNGs render those meshes in Blender studio lighting.

## Contents

- 9 tree variants: layered, spreading and upright oaks; broadleaf sapling; layered, slender and young firs; two pink blossom crowns.
- 4 grass variants: meadow, fan, tall encounter grass and golden field grass.
- Clover, white daisies, pink cosmos, yellow wildflowers, blue wildflowers and lavender.
- Layered, berry and flowering bushes; fern; mushroom cluster; reeds; cattails.
- `*.glb`: metre units, +Y up, ground pivot, vertex colours, one opaque material per mesh, no external textures. Grass/reeds use double-sided ribbons.
- `*-lod.glb`: separate lower-detail tree variants.
- `verdant-flora-v1.blend`: editable native geometry with three preview scenes. Blender converts the GLBs' +Y up to +Z up.
- `approved-vegetation-reference.png`: approved AI concept image, used only for art direction. The models are original procedural geometry, not extracted from that image or from third-party model assets.
- `manifest.json`: per-model triangle counts, bounds, source digest and GLB hashes.
- `glb-import-check.json` and `world-construction-check.json`: validation evidence and its limits.

## Game integration

The single model source is `buildFloraModels()` inside `../../verdant-town-3d.html`, between `FLORA_MODEL_SOURCE_BEGIN` and `FLORA_MODEL_SOURCE_END`. The game constructs the same geometry synchronously from its local Three.js library, so there are no new asynchronous model downloads or missing-file dependencies. The GLBs are reusable exports, rather than a second game implementation.

Town trees retain their existing positions, collision radii and placement hashes. Chunk instancing and distance meshes remain active. Battle backdrop aliases use the new trees. Grass and flower meshes retain wind sway and player interaction. Beds now group complete flower clusters; clover, ferns, mushrooms and cattails use a separate placement stream. No Pokemon model assets were replaced.

Press **G** in the game or use its existing `?map=test` option to visit Test Grounds. All nine trees and representative groundcover specimens are in the east wing.

## Rebuild

Requires Node.js and the project's existing vendored Three.js; no package installation or provider account is needed. From any directory:

```powershell
node '<project>/prototypes/models/verdant-flora-v1/rebuild-models.mjs'
```

This regenerates the GLBs and manifest from the HTML source, validates all geometry and checks JavaScript syntax. It overwrites this v1 pack's generated GLBs/manifest, leaving the game and approved reference untouched.

To also rebuild the native Blender library and render the three PNGs:

```powershell
node '<project>/prototypes/models/verdant-flora-v1/rebuild-models.mjs' --render 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
```

Blender runs in the background. That command overwrites this pack's native library and previews. To independently verify all exported GLBs:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python '<project>/prototypes/models/verdant-flora-v1/verify-models.py'
```

## Validation boundary

Code/geometry checks cover deterministic output, finite attributes, unit normals, valid indices, nondegenerate triangles, upright grass, authored triangle budgets, world construction, shader hook expansion and unchanged existing tree/non-flora prop placements. Blender imported all 34 GLBs and checked hashes, triangle counts, vertex colours and dimensions. Native model renders were inspected and refined.

The world construction check stubs DOM/canvas/WebGL; it is not a browser test. Browser appearance, shader compilation on the user's GPU, frame rate and a pixel-exact match to the concept image remain unverified. Studio renders show the actual shapes, not an in-game acceptance screenshot. The game's lighting/postprocessing will affect their final appearance.
