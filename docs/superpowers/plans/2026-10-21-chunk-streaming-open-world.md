# Chunk Streaming Open World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Verdant Town into the core of an open world: a long, seamless Route 1 (in-game "Meadow Route") that ends at the Woodland Clearing. Terrain and nature are built in 16 m cells, only near the camera. Fog distance and the far plane follow the zoom level, so the edge of the loaded world is never visible.

**Architecture:** The existing cell grid (`CHUNK = 16`, keys `"cx,cz"`) becomes the streaming unit. Cells that overlap today's terrain rectangle are "core". Core cells are built once at startup, with today's random placement stream left unchanged. All other Verdant cells are "streamed": `streamTick()` builds them deterministically from their own coordinates when they come into the camera's fog radius, and disposes of them when they leave it. The walkable area, tall grass and the route are analytic functions of (x, z), so collision and encounters never wait for a cell to load.

**Tech Stack:** three.js (vendored), one ES module in `prototypes/verdant-town-3d.html`, static preview server `verdant-demo` from `.claude/launch.json`.

**Spec:** No separate spec document. The requirements come from the user's request of 2026-10-21: "chunk streaming: town plus a seamless Route 1 and the clearing, with fog-linked max zoom out". They are restated below as Global Constraints.

## Global Constraints

- Change only `prototypes/verdant-town-3d.html` (AGENTS.md). Game logic stays in that file. Do not change models, Blender sources or `src-tauri/`.
- Before Task 1, the owner must commit or stash the working tree. At planning time, `prototypes/verdant-town-3d.html` had 556 uncommitted lines from other work. Line numbers in this plan are approximate, so find code by the function and constant names given.
- Cell size stays `CHUNK = 16`. Cell keys stay in the existing format: `Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK)`.
- At zoom 1, the frame must look the same as today: fog 34 → 70, and the hero framing unchanged.
- The zoom range stays 0.6 – 2.2.
- The core world must not reshuffle. The global `rnd()` stream must produce exactly the same draws, and `trees`, `circles` and `boxes` must be unchanged for core content. Streamed cells use their own seeded generator and never call `rnd()`.
- Streamed cells stay inside the Verdant band: x ∈ [-192, 192). Fleurville (x > 240), the Test Grounds (x < -240) and the rooms (x > 560) are not streamed.
- After each task that changes code, run `graphify update .` (AGENTS.md).
- All checks run in the preview: `preview_start {name: "verdant-demo"}`, then `javascript_tool` calling `debug.check()`. Run the checks with a save loaded, not during onboarding: the wheel listener ignores input while `ui.onboard` is set, and `blockedSaveFallsBackToStart` calls `loadGame()`. The hidden Browser pane throttles rAF, so click the canvas to wake it.

## Review Focus

1. **Fast camera turns:** a fast yaw drag, or looking around in first person, must not show holes in the ground in front of the fog. Any wanted cell that is closer than `fog.near` is built in the same frame (Task 3 test `nearCellsAlwaysLoaded`).
2. **Teleports:** G, T, portal pads, `?map=`, loading a save and `debug.warp` must not show an empty world after the fade. A snap frame builds every wanted cell synchronously (Task 3 test `snapLoadsAll`).
3. **Leaks:** walking or warping back and forth must not grow memory. `renderer.info.memory.geometries` must return to its earlier value (Task 3 test `noLeakAfterRoundTrips`).
4. **Old saves:** a save made where the walk area changed must not leave the player stuck inside trees or outside the world. A blocked loaded position falls back to `START` (Task 4 test `blockedSaveFallsBackToStart`).
5. **Core reshuffle:** moving the clearing or adding the route must not move a single core tree, grass tuft or NPC. `debug.coreHash()` must equal the baseline recorded in Task 1 (checked in Tasks 1, 4 and 5).

---

### Task 1: Core world split into cells (no visual change)

Today the Verdant ground is one 426k-triangle mesh, and each `scatter()` call creates one world-sized InstancedMesh, so neither can ever be culled. This task splits both into cells.

**Files:**
- Modify: `prototypes/verdant-town-3d.html`: the terrain block after `groundMat()`, `scatter()`, the flower-bed block, the click raycast in `pointerup` (`ray.intersectObjects([terrain, kGround, tGround])`), and `window.debug`.

**Interfaces:**
- Produces:
  - `const cellOf = v => Math.floor(v / CHUNK)`
  - `const cellKey = (cx, cz) => cx + ',' + cz`
  - `const CORE_RECT = [TX0, TZ0, TX1, TZ1]`
  - `isCoreCell(cx, cz) → boolean`: true when the cell's rectangle overlaps `CORE_RECT`.
  - `terrainCell(cx, cz, res) → THREE.Mesh`: covers exactly `[cx*CHUNK, (cx+1)*CHUNK] × [cz*CHUNK, (cz+1)*CHUNK]`. It uses the shared `groundMat(cobbleTex)` material and has `receiveShadow = true` and `userData.owned = true` on its geometry.
  - `GROUND: THREE.Mesh[]`: every walkable ground mesh. The click-to-walk raycast uses it in place of `terrain`.
  - `debug.stats() → { calls, triangles, geometries }` from `renderer.info`.
  - `debug.coreHash() → string`: `trees.length`, `circles.length`, `boxes.length`, and the sum of all their numbers rounded to 3 decimals.
  - `debug.check() → string[]`: the names of failing assertions. An empty array means pass. Later tasks add cases to it.

- [ ] **Step 1: Add `debug.stats()`, `debug.coreHash()` and an empty `debug.check()`. Record the baseline**

Recorded: `BASELINE_HASH = "421/487/50/159510.682"`, `BASELINE_STATS = { calls: 615, triangles: 4083393, geometries: 213 }` (START, zoom 1, 1024x768 preview).

Reload the preview. Stand at `START` with the default zoom and wait 2 s. Run `debug.stats()` and `debug.coreHash()`. Write the values into this plan, and also into the code as `const BASELINE_HASH = '…', BASELINE_STATS = {…}` next to `window.debug`. Commit this step on its own.

- [ ] **Step 2: Add the failing checks to `debug.check()`**

```js
['coreHashUnchanged', () => debug.coreHash() === BASELINE_HASH],
['groundIsCells', () => GROUND.length >= 20 && GROUND.every(m => m.userData.cell)],
['seamHeights', () => { // a vertex on a shared edge has the same height in both cells
  const a = GROUND.find(m => m.userData.cell + '' === '0,0'), b = GROUND.find(m => m.userData.cell + '' === '1,0');
  const ys = (m, x) => [...Array(m.geometry.attributes.position.count).keys()].filter(i => Math.abs(m.geometry.attributes.position.getX(i) - x) < 1e-4).map(i => m.geometry.attributes.position.getY(i).toFixed(4)).sort() + '';
  return ys(a, 16) === ys(b, 16); }],
['grassIsCells', () => scene.children.filter(o => o.isInstancedMesh && GRASS_GEOMETRIES.has(o.geometry)).length > 4],
```

Run `debug.check()`. Expected: it lists `groundIsCells`, `seamHeights` and `grassIsCells` (`GROUND` is not defined yet).

- [ ] **Step 3: Implement `terrainCell(cx, cz, res)`**

Move the body of today's terrain block into this function. Keep the colour rules unchanged. Sample a height grid with one extra sample beyond each edge. Use it for the slope and for normals by central differences. Do not use `computeVertexNormals()`: per-cell normals show lighting seams. Add a skirt: one ring of vertices 0.4 m below each edge, with the edge colour and edge normal. The skirt hides cracks where cells of different resolution meet (core 0.13 m, streamed 0.25 m in Task 3). Build every core cell at `TRES`, add it to the scene and push it to `GROUND`. Remove `terrain`. Change the raycast to `ray.intersectObjects([...GROUND, kGround, tGround])`.

- [ ] **Step 4: Split `scatter()` and the flower beds by cell**

Generate placements exactly as today: same `accept` / `place` calls and same `rnd()` draws. Then apply `GRASS_DENSITY` to the first `round(n * GRASS_DENSITY)` placements in stream order. Then put each placement into the bucket of its cell, and create one InstancedMesh per bucket. `scatter()` returns an array of meshes; first confirm with a search that no caller uses the return value. Apply the same bucketing to the flower beds.

- [ ] **Step 5: Verify**

Run `debug.check()`. Expected: `[]`. Run `debug.stats()` at `START` and compare it with `BASELINE_STATS`: `triangles` must be lower and `calls` must be no more than baseline + 60. Take a screenshot at `START`, compare it with a baseline screenshot, and look for a lighting seam at x = 0 and x = 16.

- [ ] **Step 6: Commit**

```bash
git add prototypes/verdant-town-3d.html docs/superpowers/plans/2026-10-21-chunk-streaming-open-world.md
git commit -m "Split Verdant terrain and ground cover into 16 m cells"
```

---

### Task 2: Fog-linked view distance and max zoom out

**Files:**
- Modify: `prototypes/verdant-town-3d.html`: constants next to `CAM_DIST`, the `wheel` listener, the camera block in `update()`.

**Interfaces:**
- Produces:
  - `const ZOOM_MIN = 0.6, ZOOM_MAX = 2.2`
  - `const FOG_NEAR_PAST = 14.7, FOG_FAR_PAST = 50.7`: metres past the focus point. At zoom 1 this gives fog 34 → 70, as today. `FOG_FAR_PAST` is the single performance knob: a smaller value means fewer cells and more haze.
  - `const FPV_FOG = [34, 70]`
  - `viewFog(d, fpv) → [near, far]`: returns `FPV_FOG` in first person, else `[d + FOG_NEAR_PAST, d + FOG_FAR_PAST]`.
  - `const STREAM_R = CAM_DIST * ZOOM_MAX + FOG_FAR_PAST + CHUNK`: the largest load radius. Task 3 uses it.

- [ ] **Step 1: Add the failing checks**

```js
['fogAtZoom1', () => viewFog(CAM_DIST, false).map(v => v.toFixed(1)) + '' === '34.0,70.0'],
['fogFpv', () => viewFog(99, true) + '' === '34,70'],
['farFollowsFog', () => Math.abs(camera.far - (scene.fog.far + 1)) < 1e-6],
['zoomClamped', () => { for (let i = 0; i < 60; i++) dispatchEvent(new WheelEvent('wheel', { deltaY: 1 })); return zoom === ZOOM_MAX; }],
```

Run them. Expected: all four fail.

- [ ] **Step 2: Implement**

Clamp the wheel zoom with `ZOOM_MIN` / `ZOOM_MAX`. In `update()`, after the camera position is set, compute `d = fpv ? 0 : CAM_DIST * zoom`. Set `scene.fog.near` and `scene.fog.far` from `viewFog(d, fpv)`. Set `camera.far = scene.fog.far + 1`, and call `updateProjectionMatrix()` only when the value changed. Outdoors in third person, set `scene.background` to the fog colour (`FOG`) instead of `BG`. Then the area beyond the far plane, and any unloaded area, blends into the fog. Rooms (`KAL.dark`) keep their dark colour.

- [ ] **Step 3: Verify**

Run `debug.check()`. Expected: `[]`. Take screenshots at zoom 1 (must look the same as the Task 1 baseline) and at zoom 2.2 (the player is clear, and the haze hides the world edge with no visible line).

- [ ] **Step 4: Commit**

```bash
git add prototypes/verdant-town-3d.html
git commit -m "Link fog and far plane to zoom so the world edge stays hidden"
```

---

### Task 3: Cell streaming lifecycle (terrain only)

**Files:**
- Modify: `prototypes/verdant-town-3d.html`: a new `// === streaming` section after the terrain block, a call in `update()` after the fog lines, and `window.debug`.

**Interfaces:**
- Consumes: `terrainCell`, `cellKey`, `isCoreCell`, `GROUND` (Task 1). `STREAM_R`, `viewFog` (Task 2).
- Produces:
  - `const STREAM_RES = 0.25`
  - `const VERDANT_CELLS = { cx0: -12, cx1: 11, cz0: -14, cz1: 3 }` (inclusive).
  - `streamable(cx, cz) → boolean`: true inside `VERDANT_CELLS` and `!isCoreCell`.
  - `const STREAM = { cells: Map<key, Cell>, built: 0, disposed: 0 }`, where `Cell = { cx, cz, group: THREE.Group, ground: THREE.Mesh, lod: [hi, lo][] }`.
  - `buildCell(cx, cz) → Cell`: builds a cell, adds its group to the scene and its ground to `GROUND`. Task 5 adds the content.
  - `disposeCell(c)`: removes the group and the `GROUND` entry, and disposes every geometry with `userData.owned`. It never disposes shared kit or flora geometries or shared materials.
  - `streamTick(snap: boolean)`:
    - Wanted cells: streamable cells whose rectangle is within `scene.fog.far` of the camera's ground point, and whose box (y from -2 to 8, grown by `CHUNK / 2`) meets the camera frustum.
    - Build order: nearest to `camLook` first, one cell per frame. When `snap` is true, build every wanted cell. Always build at once any wanted cell closer than `scene.fog.near`.
    - Disposal: cells farther than `scene.fog.far + 2 * CHUNK` from the camera's ground point.
    - `update()` calls it with `snap` = the value of `firstFrame` at the start of that frame. Boot, `fadeTo` and the loading of a save already set `firstFrame`.
  - `debug.stream() → { loaded: string[], built, disposed }`
  - `debug.go(x, z)`: `debug.warp(x, z)` plus `firstFrame = true`. Returns a Promise that resolves after 2 frames.

- [ ] **Step 1: Add the failing checks**

Mark these checks `async`. `debug.check()` awaits all checks and returns the names that failed.

```js
['snapLoadsAll', async () => { await debug.go(40, -60); const w = wantedCells(); return w.every(k => STREAM.cells.has(k)); }],
['farCellsDisposed', async () => { await debug.go(40, -60); await debug.go(...START); return [...STREAM.cells.values()].every(c => distToCamGround(c) <= scene.fog.far + 2 * CHUNK); }],
['nearCellsAlwaysLoaded', async () => { await debug.go(40, -60); VIEW.yaw += Math.PI; await frames(1); return wantedCells().filter(k => cellDist(k) < scene.fog.near).every(k => STREAM.cells.has(k)); }],
['noLeakAfterRoundTrips', async () => { await debug.go(...START); const g0 = renderer.info.memory.geometries; for (let i = 0; i < 5; i++) { await debug.go(40, -60); await debug.go(...START); } return renderer.info.memory.geometries === g0; }],
['coreNeverStreamed', () => [...STREAM.cells.values()].every(c => !isCoreCell(c.cx, c.cz))],
```

`wantedCells()`, `cellDist(key)`, `distToCamGround(cell)` and `frames(n)` are small helpers that live next to `streamTick` and are shared with it. Expected: all five fail.

- [ ] **Step 2: Implement the streaming section and the `update()` call**

- [ ] **Step 3: Verify**

Run `debug.check()`. Expected: `[]`. Use `debug.go(40, -60)`, zoom out to 2.2 and turn the camera 360° with a drag. Expected: no holes and no black or green background showing through, only fog. Also check frame pacing in `debug.stats()` while walking: building one cell must not take more than about 12 ms. Measure it with `performance.now()` around `buildCell`. If it is slower, keep the sampling cost down by giving `riverInfo` an early exit outside the river's bounding box plus 3 m.

- [ ] **Step 4: Commit**

```bash
git add prototypes/verdant-town-3d.html
git commit -m "Stream Verdant terrain cells around the camera"
```

---

### Task 4: Route 1 corridor, relocated clearing, walk rules

**Files:**
- Modify: `prototypes/verdant-town-3d.html`: next to `CLEAR` / `PATHS`, `terrainH()`, `freeSpot()`, `RAISE`, `inTallGrass`, `blockedAt()`, the `loc` line in `update()`, `loadGame()`, and the debug `quest` hook (it already reports `CLEAR`).

**Interfaces:**
- Produces:
  - `const OLD_CLEAR = { x: 19, z: 3, r: 5.5 }`: the old glade stays open. `PATHS[2]` and `freeSpot()` switch to it, so the core forest fill draws the same numbers.
  - `const ROUTE1_CTRL`: starts with the last point of `PATHS[1]`, then that point plus the offsets `[4,-20]`, `[-3,-45]`, `[6,-70]`, `[2,-95]`, `[10,-115]`. These are the default values, and you may adjust them until the checks below pass.
  - `const ROUTE1 = catmull(ROUTE1_CTRL, 6)`
  - `routeD(x, z) → number`: distance to `ROUTE1`. Returns `1e9` outside its bounding box plus `ROUTE_HALF + 2`.
  - `const ROUTE_HALF = 5`
  - `CLEAR` is redefined as `{ x: ROUTE1.at(-1)[0], z: ROUTE1.at(-1)[1] - 7, r: 6.5 }`, with a trail from the route end into it. `RANGER_CLEAR`, `DEV_AT`, `GUARD_AT` and the `loc` line keep reading `CLEAR`, so the story moves with it.
  - `const ROUTE_GRASS = [[x, z, r], ...]`: three tall-grass patches. Place them at 25 %, 50 % and 75 % of the route length, beside the path, with r from 3 to 4.
  - `verdantWalkable(x, z) → boolean`: inside today's rectangle `[-24, -20, 26, 14]`, or `routeD < ROUTE_HALF`, or inside `CLEAR`.
  - `debug.reach(ax, az, bx, bz) → boolean`: a breadth-first search over a 0.5 m grid using `blockedAt`, limited to 200 000 nodes.

- [ ] **Step 1: Add the failing checks**

```js
['routeReachable', () => debug.reach(...START, CLEAR.x, CLEAR.z)],
['routeClearOfRiver', () => ROUTE1.every(([x, z]) => { const r = riverInfo(x, z); return r.d > r.hw + 3; })],
['routeInVerdantBand', () => ROUTE1.every(([x, z]) => streamable(cellOf(x), cellOf(z)) || isCoreCell(cellOf(x), cellOf(z)))],
['routeGrassEncounters', () => ROUTE_GRASS.every(([x, z]) => inTallGrass(x + 1.5, z) || inTallGrass(x - 1.5, z))],
['offRouteBlocked', () => { const [x, z] = ROUTE1[ROUTE1.length >> 1], ox = x + ROUTE_HALF + 2; return blockedAt(ox, z, walkH(ox, z)); }],
['blockedSaveFallsBackToStart', () => { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s, pos: [150, -150, 0] })); loadGame(); const ok = Math.hypot(P.pos.x - START[0], P.pos.z - START[1]) < 0.01; localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return ok; }],
['coreHashUnchanged', () => debug.coreHash() === BASELINE_HASH], // already exists; it must still pass
```

Expected: all of them fail except `coreHashUnchanged`.

- [ ] **Step 2: Implement**

- In `terrainH()`, change the non-raised branch to use `pd = Math.min(pathD(x, z), routeD(x, z))`. Use the same minimum in the path-colour rule of `terrainCell`.
- Move the two `-80` corners of `RAISE` to `-400`. Points with z > -80 keep the same `inPoly` result, and this removes the 1 m cliff at z = -80 that would be visible from the route.
- In `blockedAt()`, replace the Verdant rectangle test with `!verdantWalkable(x, z)`.
- Extend `inTallGrass` with `ROUTE_GRASS`, and keep the patches off the path (`routeD > PATH_W + 0.3`).
- `loc`: outside today's rectangle, the name is `'Woodland Clearing'` inside `CLEAR`, else `'Meadow Route'`.
- `loadGame()`: if `blockedAt(x, z, walkH(x, z))` for the saved position, use `START`.

- [ ] **Step 3: Verify**

Run `debug.check()`. Expected: `[]`. Walk from `START` to the clearing with Shift held. Check:
- The path is continuous, with no cliff and no visible end of the river.
- The location name changes to "Woodland Clearing" at the end.
- `debug.quest()` shows `DEV_AT` at the new clearing.
- At story step `investigate-clearing` (`debug.quest()`, then set `story.step`), the ranger and the device are in the new clearing.

- [ ] **Step 4: Commit**

```bash
git add prototypes/verdant-town-3d.html
git commit -m "Extend Meadow Route into a long Route 1 ending at the Woodland Clearing"
```

---

### Task 5: Cell content: forest, ground cover, minimap tiles

**Files:**
- Modify: `prototypes/verdant-town-3d.html`: `flushInstances()` (extract a helper), `buildCell()`, the core startup (fill the band outside the old forest rectangle), `drawMinimap()`, `lodTick()`.

**Interfaces:**
- Consumes: `buildCell`, `disposeCell`, `STREAM` (Task 3). `routeD`, `ROUTE_HALF`, `ROUTE_GRASS`, `CLEAR`, `inTallGrass` (Task 4).
- Produces:
  - `cellRand(cx, cz) → () => number`: mulberry32 seeded with `(cx * 73856093) ^ (cz * 19349663)`. It never touches the global `seed`.
  - `instanceInto(name, matrices, parent) → [hi, lo][]`: the InstancedMesh code that `flushInstances()` uses today, including LOD creation and per-instance tint. `flushInstances()` now calls it.
  - `const OLD_FILL = [-34, -28, 34, 18]`: the rectangle the core forest fill already covers.
  - `fillCell(cx, cz, rand, parent) → { trees: [x, z, r][] }`. Placement rules:
    - Trees on a jittered 2.4 m grid, with ±0.8 m jitter, kept with probability 0.85.
    - Trees skip spots inside `OLD_FILL`, where `routeD < ROUTE_HALF + 1`, inside `CLEAR` + 1, or where `river.d < hw + 1`.
    - Species: `fir` / `fir_slender` when the hash is below 0.45, else `oak` / `oak_tall`. Scale from 0.95 to 1.5.
    - Short tufts: 120 tries per cell on open, non-forest ground, thinned by `GRASS_DENSITY`.
    - Tall grass: about 6 per m² inside `ROUTE_GRASS`.
    - All of it uses one shared `swayMaterial(true)` instance.
  - `miniTile(cx, cz, trees) → HTMLCanvasElement`: 96 × 96 px (`MPU = 6`), drawn with the same colour rules as `mapCanvas`.
  - `const MINI_TILES = new Map()`: kept after a cell is disposed (about 37 KB per tile).
  - A streamed cell's `lod` pairs switch detail by the distance from the player to the cell's rectangle, compared with `LOD_R`.

- [ ] **Step 1: Add the failing checks**

```js
['cellDeterministic', () => { const a = fillCell(2, -4, cellRand(2, -4), new THREE.Group()), b = fillCell(2, -4, cellRand(2, -4), new THREE.Group()); return JSON.stringify(a.trees) === JSON.stringify(b.trees); }],
['forestDensity', () => { const n = fillCell(-8, -8, cellRand(-8, -8), new THREE.Group()).trees.length; return n >= 30 && n <= 70; }],
['corridorFree', () => [...STREAM.cells.values()].every(c => c.trees.every(([x, z]) => routeD(x, z) >= ROUTE_HALF + 1))],
['miniTilesForLoaded', () => [...STREAM.cells.keys()].every(k => MINI_TILES.has(k))],
['coreHashUnchanged', () => debug.coreHash() === BASELINE_HASH],
```

Expected: the first four fail.

- [ ] **Step 2: Implement**

- `buildCell` calls `fillCell` and `miniTile`, and stores `trees` and `lod` on the `Cell`.
- At startup, run `fillCell` for every core cell. Its `OLD_FILL` rule leaves the existing forest alone and fills the bare band between the old fill edge and the cell edge.
- In `drawMinimap()`, outside Fleurville, draw `mapCanvas` first, then every tile in `MINI_TILES` within 2 cells of the player.

- [ ] **Step 3: Verify**

Run `debug.check()`. Expected: `[]`. Walk the full route.
- The route has forest walls, grass and three tall-grass patches.
- The patches start wild battles.
- The minimap continues past the town.
- No bald band at the old forest edge.

Record `debug.stats()` at three points:
- `START`, zoom 1: must not exceed `BASELINE_STATS.triangles`.
- The midpoint of the route, zoom 1.
- The midpoint of the route, zoom 2.2.

Report all three numbers to the user.

- [ ] **Step 4: Commit**

```bash
git add prototypes/verdant-town-3d.html
git commit -m "Fill streamed cells with forest, ground cover and minimap tiles"
```

---

### Task 6: Regression pass

**Files:**
- No new code unless a regression is found. Then fix it in `prototypes/verdant-town-3d.html` and add a check to `debug.check()`.

- [ ] **Step 1: Run `debug.check()`.** Expected: `[]`.
- [ ] **Step 2: Check the paths that touch the camera or the world in the preview:**
  - First person (V) on the route.
  - A room interior (dark fog unchanged).
  - T to Fleurville and back.
  - G to the Test Grounds and back.
  - A portal pad.
  - A wild battle on the route and the return to the field.
  - Save on the route, reload, and spawn on the route with the cells loaded.
- [ ] **Step 3: Run `graphify update .`**
- [ ] **Step 4: Commit any fixes:** `git commit -m "Fix regressions found in the streaming pass"`

---

## Decisions taken by default (confirm before execution)

1. **The clearing moves to the end of Route 1.** This gives the route a purpose in Chapter 1. The old glade at (19, 3) stays an empty glade, so the core layout does not reshuffle. Alternative: keep the clearing where it is and let Route 1 continue past it to an empty end for now.
2. **Route 1 runs north, east of the river, about 120 m long.** The in-game name stays "Meadow Route", and the music stays on the existing `route` track.
3. **Max zoom out stays at 2.2**, and the fog moves with the zoom instead. At max zoom the player is no longer in the haze. `FOG_FAR_PAST` is the one tuning knob for performance.
