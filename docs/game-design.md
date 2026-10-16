# Game design

Status: proposed full-game playable scope. A bounded town environment and gardener errand are implemented separately in [the corner delivery](town-corner-delivery.md); the battle/catalog/story loop below remains planned.

## Experience

A compact Pokémon adventure viewed through a fixed isometric camera. Explore a warm, readable 3D town, travel through tall grass, meet wild Pokémon, battle, catch companions, and return to heal. The world should feel like a place the player can navigate, with the trainer and companion always easy to locate.

The first session targets approximately 20–30 minutes of authored content. This is a design target, not a measured completion time.

The accepted [story and end-game](story-and-endgame.md) follows a habitat-displacement mystery, then a regional Championship and postgame research/battle goals. The first playable covers only Chapter 1, **The Silent Stream**. Regional content remains outside the current implementation milestones.

## Core loop

1. Start a new game, name the trainer, and choose Bulbasaur, Charmander, or Squirtle.
2. Receive the professor's waterway investigation and supplies; learn movement and interaction in town.
3. Explore the route and enter encounter grass.
4. Resolve a wild battle by defeating, catching, or fleeing.
5. Manage the party, learn moves, use items, and heal in town.
6. Defeat the apprentice ranger, investigate the clearing, disable the distressing signal device, and report back to the professor.
7. Save, quit, and continue with the same party and world progress.

## First playable world

Working names are project-authored placeholders, not PokéAPI locations.

| Area | Required content |
| --- | --- |
| Verdant Town | Player spawn/home exit, starter interaction, healing interior, small shop, storage access, route exit |
| Meadow Route | Connected walking path, bridge, encounter patches, two optional NPCs, item pickup, return path |
| Woodland Clearing | Distinct visual landmark, apprentice ranger challenge on approach, signal device, restoration state |

Town interiors can be small separate maps. No open-world streaming requirement for this scope. Original map encounter tables define species, levels, weights, and prerequisites; official location data may be reference material but does not generate our map.

## Pokémon scope

Proposed **16-species catalog**, using default varieties only:

| Family | Species names | Availability |
| --- | --- | --- |
| Grass starter | Bulbasaur, Ivysaur, Venusaur | Starter and its evolution line |
| Fire starter | Charmander, Charmeleon, Charizard | Starter and its evolution line |
| Water starter | Squirtle, Wartortle, Blastoise | Starter and its evolution line |
| Route bird | Pidgey, Pidgeotto, Pidgeot | Wild base stage; later stages through progression |
| Route mammal | Rattata, Raticate | Wild base stage; evolution through progression |
| Electric companion | Pikachu, Raichu | Rare wild Pikachu; evolution when a supported stone is available |

This is a content allowlist, not permission to implement fake stats. IDs and facts must resolve through PokéAPI. Later forms need not be reachable during the introductory objective, but every enabled evolution destination must be valid. The normal first route encounter range is proposed at levels 2–6, with the final trainer near level 8; tune only local encounter content.

No regional variants, alternate battle forms, breeding, shinies, legendary Pokémon, Mega Evolution, Z-Moves, Dynamax, or Terastallization in the first playable. Import related references for provenance if needed without automatically enabling them.

## Movement and encounters

- Camera-relative free movement with collision; no jump requirement or grid lock.
- Keyboard movement and gamepad movement; click-to-move is deferred.
- Interact with the nearest eligible object in range, with a visible prompt.
- Encounter checks occur only while moving inside enabled grass volumes, using distance traveled and a post-battle grace distance. Standing still does not roll encounters.
- One encounter request at a time; dialogue, menus, transitions, and pending saves suppress encounter starts.
- The leading eligible party member can follow visually. It has no collision that can trap the player and may safely reposition if stuck.
- Ambient Pokémon in the concept are illustrative. First playable grass encounters are volume-triggered, not a promised roaming-creature system.

## Battles

Separate battle scene or arena with one active Pokémon per side. A party can contain up to six Pokémon, each with at most four moves. These are project gameplay constraints; the API is not the battle executor.

The four primary actions are **Fight, Bag, Pokémon, Run**. The battle flow must include accuracy, PP, physical/special damage, type effectiveness, priority/speed ordering, supported status effects, fainting, forced replacement, rewards, and battle completion. Trainer-owned Pokémon cannot be caught; fleeing trainer battles is disabled.

`slice-v1` is a proposed custom profile. Before battle implementation, freeze its formulas, rounding, RNG draws, effect order, status durations, experience awards, capture calculation, and fleeing in a versioned mechanics specification with worked fixtures. Do not market this profile as exact official-game behavior. A change to faithful historical rules requires revisiting the import policy.

Every enabled move, ability, item, and evolution condition needs an explicit executable handler. Imported effect text is descriptive, never executable. Missing support must fail content validation before packaging, rather than become a move that silently does nothing.

At a turn boundary, collect legal commands, commit them once, resolve deterministic actions using the recorded RNG state, then present the resulting event sequence. UI animation timing cannot change battle outcomes. Handle opposing simultaneous fainting, cancelled actions after fainting, and replacement before advancing the next turn.

## Capture, party, and storage

- Capturing consumes one legal ball once the action commits. A failed capture remains a valid battle outcome.
- Success creates exactly one persistent individual with its own identity, stats inputs, ability, nature, moves, PP, and ownership.
- Fill the party first; otherwise send the new individual to storage and say where it went.
- Proposed first storage capacity: 30 Pokémon. If party and storage are full, disable ball use with a clear capacity message before consuming anything.
- Support summary, reorder, move replacement, and deposit/withdraw. Prevent removing the last usable party member when leaving storage.
- Track Pokédex seen/caught flags separately. Inspecting a reference entry does not mark it caught.

## Progression and economy

Use imported growth tables for cumulative experience thresholds. Award experience only once per completed qualifying outcome. Level-up can queue stat recalculation, move learning, and supported evolution checks; resolve these prompts before returning to unrestricted exploration.

The starter grant and story rewards are one-time persistent transactions. Persist the ranger victory, device shutdown, stream restoration, and professor report so quest steps resume correctly after loading. Healing restores HP, PP, and relevant conditions. The shop reads supported item definitions and local stock; purchases validate funds and capacity before committing. Inventory counts and currency cannot become negative.

First item categories: standard capture balls, HP recovery, status recovery, and the supported evolution stone. Exact item identities, costs, and effects are locked through the importer and support matrix before content completion.

If all party members faint, return to the last healing location, heal, and resolve the loss once. Any currency penalty is a documented profile choice; never silently invent a penalty during implementation.

## Menus and controls

Required screens: title/new game/continue, starter selection, exploration HUD, dialogue, battle command and move selection, bag, party/summary, storage, Pokédex, shop, pause/settings, and save/load feedback.

Proposed keyboard: WASD/arrows move, E interact, Enter confirm, Escape back/pause, Tab party. Provide gamepad equivalents, remapping, persistent settings, visible focus, readable text, and a text-speed setting. Modal UI owns input and prevents unintended overworld actions.

## Deliberately deferred

Multiplayer, trading, online accounts, PvP, a full region, all-generation content, mobile/console releases, voice acting, dynamic weather gameplay, and live catalog updates during play. The accepted full-game sanctuary finale, League Championship, and postgame systems are also outside the first playable; see the story document for their direction. Keep stable data contracts so later expansion does not require replacing save identities.
