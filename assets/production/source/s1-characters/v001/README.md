# S1 character source proofs v001

These are original deterministic procedural studies for B6/B7, built from
`tools/production/build_characters.py`. They are not accepted final art or a
Game Development Studio canonical package. Rebuild with the project Python
interpreter and `tools/production/build_characters.py --output <directory>`.

Trainer and Pikachu GLBs contain real joint hierarchies, inverse bind matrices,
normalized skin weights, normals, material sections, UV coordinates and baked
30 Hz in-place clips. Mesh and skeleton are both in one GLB; no external buffer
or texture dependency is required. Source dimensions use centimetres. GLB uses
metres with +Y up and +X forward: `(forward,right,up) -> (forward,up,-right)/100`.
This is the project's measured Unreal glTF import route; source X/Y bounds
remain aligned in native Unreal. The transform is a proper rotation and keeps
triangle winding. Normals, joints, inverse binds and clip axes use the same
mapping. Ground root stays at zero and visible soles meet source Z=0.

OBJ/MTL derivatives use centimetres with +X forward, +Y right and +Z up.
They represent the unanimated bind pose. They cannot establish Unreal skeletal
or animation support. If an importer applies a separate axis fix, record that
fix as a derivative/import setting instead of modifying the original GLB.

PNG previews are CPU rasterizations of source triangles, not engine captures.
The body and limb surfaces use shaped ring profiles; clothing, hair, face,
ears, tail and pack use separate semantic surfaces where layering is needed.
The head/cheek/body intersections and provisional elbow/knee weight zones need
artist cleanup and deformation review. The concave tail has explicit triangles.
There are no engine primitive actors masquerading as a completed character.

Flat colors are an initial lookdev palette. Painterly textures, packed maps,
UV seam/padding review, optimized material section counts, LODs, collision,
facial/finger rigging, foot planting and polished animation remain pending.
Chapter attack/hit/faint/release/capture actions remain absent; these two clips
do not enable Pikachu as a fully supported chapter combatant. Source generation
does not grant intellectual property usage rights; usage status is unassessed.
No provider, paid service, remote model or external package generated these
sources. The native Unreal importer is checked separately by the integration
pipeline; those receipts do not establish polished deformation or final art.
The included `build_characters.py` is the editable original. A standalone copy
can rebuild into a fresh folder with `python build_characters.py --output <dir>`.
