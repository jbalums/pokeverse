# Reuse in another Unreal project

The delivery ZIP contains a `town-kit` source folder and an `Art` folder of Unreal 5.8 assets.

1. Close the target editor and copy `Art` into the target project's `Content/Art` directory. Preserve that path so the materials, textures and parameter collection resolve their `/Game/Art/` references.
2. Open the target project in Unreal 5.8 and inspect `Art/Meshes` and `Art/Materials`. Use Unreal's Migrate command for further transfers or directory changes so references are updated safely.
3. Place the meshes and assign the matching materials. Units are centimetres. Decorative meshes have no collision; add simple collision to gameplay blockers as needed. See the source README and manifest for pivots and limits.
4. The source OBJ and PNG files in `town-kit` are portable to other tools; their materials must be recreated there. For the complete native cottage/tree/bridge/fence/lamp assemblies, see `Game/Source/VerdantTrails/TownKit.cpp` in the game repository.

The game code and the kit can also be regenerated together using the repository's `tools/Build-Town.ps1`. The archive is an environment kit, not a finished animated character roster.
