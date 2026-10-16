# Verdant corner: first environment delivery

Implementation authorized on 2026-10-15. This is a small environment/interaction study alongside the larger roadmap, not completion of Chapter 1 or the battle/catalog milestones.

## Experience

A fixed elevated orthographic camera follows the trainer through a cottage garden, paved plaza, flower meadow and timber bridge over a stream. A constructed Bulbasaur study follows the trainer's recorded route. Talk to the gardener, collect the blue herb across the bridge, then return. Signs and the closed cottage door have readable interactions. This errand is deliberately separate from the accepted Silent Stream story.

The environment is assembled from reusable imported meshes, the generated material atlas, thirty editable Unreal materials and deterministic C++ assembly functions. The game fills its window, with a location panel, objective, small position map, companion panel and journal. It uses no web service at runtime. No site has been published.

## Open and play

Use `Play Town.cmd` at the repository root after a successful build/package. It prefers the packaged Windows executable and falls back to the compiled Unreal game. For editing, open `Game/VerdantTrails.uproject` in Unreal 5.8. The small `ArtPipeline.uproject` is only an import host.

Controls:

| Action | Keyboard/mouse | Controller |
| --- | --- | --- |
| Walk | WASD or arrow keys | Left stick |
| Run | Hold Shift | Hold left-stick click |
| Interact / continue | E | Bottom face button / A |
| Journal / close dialogue | Escape | Start |
| Zoom | Mouse wheel | Not mapped in this slice |
| Reduced motion | M | Not mapped in this slice |
| Return to entrance | R while journal is open | Not mapped in this slice |

Opening the journal retries saving. Progress also saves after each errand transition and motion-setting change. Two alternating snapshots are read back and validated, preserving the previous valid slot on failure. Invalid or newer saves are retained and saving is blocked with visible feedback rather than silently replacing those files. This slice does not implement the planned three-slot full-game save menu or a restore/delete UI.

Normal save files are `VerdantCorner_A.vcs` and `VerdantCorner_B.vcs` in Unreal's local SaveGames directory. Each is a fixed 48-byte versioned record with a CRC32 over its header and payload. Size, magic, version, checksum, quest bounds and safe position are validated before reading state; no UObject/FName deserialization is used. Automated smoke runs use a separate process-specific namespace and do not load or overwrite a player's files.

## Build and verify

```powershell
powershell -File tools/Build-Town.ps1 -Stage all
```

The individual stages are `assets`, `build`, `test`, and `package`. An alternative engine location can be supplied with `-EngineRoot`. Logs, test reports, screenshots and the packaged build go under ignored `output/`. Native engine version: **5.8.3, changelist 58210709**. The authorized Visual Studio update completed to **17.14.42**; UnrealBuildTool accepted **MSVC 14.44.35229** (tool directory `14.44.35207`) and **Windows SDK 10.0.22621.0**. Builds use `-NoUBA -MaxParallelActions=2` because the accelerator stalled under this machine's commit-memory pressure; the direct compiler path completed successfully.

The source kit can be inspected and its four interchange validation tests can run with only standard Python:

```powershell
py -3 -m unittest discover -s tools/tests -v
```

## Evidence

- Source asset validation: four tests pass (manifest hashes/paths, OBJ indices/UVs/face validity, deterministic generation/triangle budget, PNG atlas format).
- Unreal import: 40 assets created and reopened successfully, including eight meshes, thirty materials, one texture and one parameter collection; town map saved. Detailed evidence: `output/unreal-import.json`. The source meshes total 1,671 triangles before instancing.
- Kit visual render: upright geometry and working texture/lighting observed in `output/screenshots/kit-gallery.png`, rendered with Unreal/D3D12 on an NVIDIA GeForce RTX 3060 Ti. This is an asset gallery, not proof of the playable town's final appearance.
- C++ editor and standalone Windows Development builds: passed. Logs: `output/editor-build.log`, `output/game-build.log`.
- Unreal automation: **3/3 passed** (`QuestTransactions`, `RouteSafety`, `SaveSerialization`), including repeat-interaction rejection, safe bridge checkpoint rules, serialization round-trip, malformed/truncated record rejection, all 48 individual byte-corruption cases, and invalid quest/position rejection. Report: `output/automation/index.json`.
- Rendered editor-game route: **passed**, quest stage 3 with a verified save, in 49.62 seconds of game time. The driver used real character movement, physics and proximity interactions, not teleportation between errand steps. Evidence: `output/gameplay-smoke.json`, `output/gameplay-render.log` and four 1600 × 900 screenshots under `output/screenshots/`.
- Visual inspection: checked the town and gardener frames; corrected source axes, removed preview-gallery contamination, fixed HUD font sizing/rounded-panel blending, extended scenery to remove exposed ground edges, adjusted the camera to pitch -38/yaw -45 and reduced exposure. The result is a stylized first environment pass, not a claim of parity with the generated reference.
- Windows cook, stage and archive: **passed**, AutomationTool exit 0 and `BUILD SUCCESSFUL`. Entry point: `output/Windows/VerdantTrails.exe`. Detailed evidence: `output/package.log`.
- Standalone packaged route: **passed**, quest stage 3 with a verified save, in 49.44 seconds of game time. The archived executable ran with its cooked assets and D3D12 rendering; it did not use the editor DLL. Evidence: `output/packaged-gameplay-smoke.json`, `output/packaged-smoke.log`, and four 1600 × 900 PNGs copied to `output/packaged-screenshots/`. This does not establish network-disabled, clean-machine, physical-controller or manual-keyboard acceptance.
- Reusable distribution: `output/verdant-town-kit-v1.zip` contains the source kit and native `Art` assets. It is approximately 5.8 MB. See the kit's `IMPORT.md` for preserving Unreal asset paths.

## Limits

This is an art and traversal slice. Cottage interiors, battles, catches, wild encounters, the catalog importer, final character rigs, a full party UI, audio production, remapping and the Silent Stream chapter remain outside this delivery. No final visual match or performance target is claimed without observed engine evidence. The reference's waterfall is not implemented; this corner uses a flowing stream. Controller mappings are supplied, but physical-controller acceptance is separate from keyboard/automated movement tests.
