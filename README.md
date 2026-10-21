# Isometric Pokémon Game

Workspace for a single-player, stylized 3D Pokémon browser adventure.

The retained game is [Verdant Town 3D](prototypes/verdant-town-3d.html), with its scripts, models, and Blender sources in `prototypes/`. The separate Unreal project in `Game/` and its older packaged build in `output/Windows/` have been removed. Existing Unreal delivery reports are historical. The concept image below is a visual reference.

Run `Verdant Town.exe` (the Tauri shell in `src-tauri/`), or serve `prototypes/` over HTTP and open `verdant-town-3d.html`: the game is ES modules (`prototypes/src/`), which browsers do not load from `file://`. Three.js is bundled in `prototypes/vendor/`, so no internet is needed. Controls: WASD to walk, Shift to run, E to talk, click to move, and scroll to zoom.

Start with the [documentation index](docs/README.md), then review the [decisions](docs/decisions.md) and [game design](docs/game-design.md).

The accepted [story and end-game](docs/story-and-endgame.md) follows a habitat-displacement mystery, a Championship rivalry, and postgame restoration and battle challenges. The first playable is Chapter 1, **The Silent Stream**.

Pokémon reference data will come from [PokéAPI v2](https://pokeapi.co/api/v2/). The game will use a validated local snapshot so ordinary play does not require API access. Project maps, encounters, battle execution, saves, and 3D assets have separate ownership.

![Isometric exploration concept](docs/references/isometric-town-concept.png)

Created: 2026-10-15, Asia/Manila.
