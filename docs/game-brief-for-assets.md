# Pokémon: Verdant Trails — game brief for asset planning

Planning brief based on the existing game design, accepted story, visual direction, and delivered town corner. On 2026-10-16 the user required the supplied image to be the exact visual target ("100% it must look like that"). This updates the art acceptance goal; it does not authorize additional implementation, purchases, or publishing. Asset quantities and technical budgets remain to be locked.

## Game overview

**Working title:** Pokémon: Verdant Trails  
**Genre:** Single-player exploration and creature-collecting RPG with turn-based battles.  
**Initial platform:** Windows PC, using Unreal Engine 5.8.  
**Presentation:** Stylized 3D environments and characters, viewed through a fixed elevated orthographic camera.  
**Tone:** Warm, inviting adventure with a growing ecological mystery.  
**First chapter target:** Approximately 20–30 minutes of authored content; this is a design target, not measured playtime.

The player is a new trainer and field assistant from Verdant Town. Wild Pokémon are abandoning their habitats and entering settlements. With a starter companion, the player investigates a disturbed waterway while learning to explore, battle, catch Pokémon, and care for a team. The larger story connects these disturbances to a signal network that redirects Pokémon and damages neighboring habitats.

The intended feeling is a small, believable place full of life: warm cottages, layered vegetation, readable paths, flowing water, friendly residents, and recognizable companions. Pokémon are inhabitants reacting to disruption, not the cause of the crisis.

## Player experience and asset implications

| Activity | Assets it requires |
| --- | --- |
| Explore town and routes with a following companion | Traversable modular environments, collision, character locomotion, occlusion-friendly roofs and foliage |
| Talk, investigate, collect, and use services | NPCs, interaction gestures, dialogue UI, readable signs, pickups, shop/healing/storage props |
| Meet wild Pokémon in tall grass | Distinct encounter grass, encounter transitions, supported creature models and animations |
| Fight, catch, flee, heal, and manage a party | Battle arena, combat animation cues, effects, capture props, item icons, party/bag/storage UI |
| Resolve a habitat mystery | Signal device, inspection clues, unrestored/restored world and sound states |
| Save and continue | Title/continue, settings, journal and save feedback states |

## Visual direction

**Mandatory target: reproduce the supplied image's look and design, with a user-requested 100% visual match goal.** It is the production target, rather than a loose mood reference. Do not substitute a generic stylized town or reduce detail and character quality while describing it as a match. The current playable corner has not met this target.

The exact newly supplied reference is preserved at [town-visual-target.png](references/town-visual-target.png). It is concept art; usable geometry, hidden surfaces, rigs and materials must be produced. Literal pixel identity in a moving 3D game is not established or guaranteed by this brief. Acceptance requires actual engine comparisons and user review; documentation, a similarity score, and a working graybox cannot establish completion.

![Required town appearance](references/town-visual-target.png)

- **Architecture:** Cream plaster, warm terracotta roof tiles, timber details, rounded stone foundations, welcoming doors and windows.
- **Nature:** Layered greens, rounded tree masses, varied grass heights, flower accents, mossy rocks, clear blue water.
- **Shapes:** Soft, stylized forms with broad readable masses. Small detail supports the composition without hiding paths or characters.
- **Lighting:** Soft daylight, controlled roughness, contact shadows, restrained bloom. Keep water and foliage motion gentle, with reduced-motion support.
- **Camera:** Fixed rotation and smooth follow. The current preview uses pitch -38 degrees, yaw -45 degrees; final asset readability must be judged at gameplay zoom.
- **Interface:** Compact location/objective, minimap, party information, bag/menu access; readable dialogue and battle commands. Type and status cues need labels or icons as well as color.

Build real 3D assets with sensible hidden surfaces and pivots. Foreground trees and roofs need a consistent player-visibility treatment. Keep walkable surfaces and collision simple and explicit.

### Required reference scene

Build a dedicated matching view before expanding into new areas. Preserve the reference's relative landmark placement, screen coverage, scale, visual density and warm lighting. Camera values from the existing prototype are starting points, not locked values if they prevent matching the image.

| Reference element | Required design and asset treatment |
| --- | --- |
| Upper-left healing building | Large curved terracotta/red tiled roof, cream stone facade, red entrance arch and circular emblem, blue glass entrance, warm lamps, flower planters, paved forecourt and entrance attendant. A simple gabled cottage cannot substitute for this landmark |
| Upper-middle cottage and plaza | Cream masonry cottage with individually readable orange roof tiles, timber trim, green shutters, warm windows, stone steps/paving, bench and seated/standing residents |
| Central walking route | Broad warm ochre dirt path, soft irregular grass edges, clear trainer/companion silhouette and connecting steps to the plaza |
| Lower-left meadow | Dense tall pointed grass, layered green shades, recognizable Bulbasaur partly within the grass, timber fence and flower borders |
| Right-side waterway | Blue/turquoise stream running from upper-right toward the bottom, rocky banks with grassy tops, visible cascades/waterfall, white foam, ripples and scattered river rocks. The prototype's flat stream alone does not satisfy this view |
| Lower-right bridge | Broad timber plank bridge crossing the stream diagonally in the view, substantial rounded posts, pale rope rails, visible board variation and supported banks |
| Vegetation and dressing | Layered broadleaf trees and conifers, foreground canopy framing, irregular shrubs, reeds, daisies and purple/yellow flowers, mossy rocks, wood fences, black warm-glow lamps, planters and timber direction signs |
| Characters | Recognizable finished trainer and Pikachu near the center, trainer with Charmander on the right path, Bulbasaur in the meadow, town residents and attendant; match the rounded proportions, clothing palette, expressive faces and scale relationships |
| Screen interface | Rounded translucent dark location badge at top-left; circular white-bordered illustrated minimap with north indicator, player arrow and landmark markers at top-right; three circular creature portraits with green bars at bottom-left; circular bag and menu controls at bottom-right |
| Surface and light quality | Painterly stylized texture detail, shaped roof tiles and planks, rounded rock facets, fine leaf/grass silhouettes, warm highlights, cool green shaded foliage, soft contact shadows and readable blue water. Avoid visibly primitive character bodies, flat placeholder foliage and plastic-looking materials in approved output |

Reference characters and HUD appearances are visual staging requirements. They do not automatically grant party members, change starter choice, add roaming encounter mechanics, or expand the supported gameplay roster. Reproduce the pictured three-portrait HUD for the comparison view; retain a clear route to the planned six-member party in normal play. Decorative sign lettering should be authored legibly rather than copying malformed generated text.

### Visual approval gate

1. Use a 16:9 reference camera and capture an actual Unreal frame with the same composition and HUD state. Match framing and projection before comparing asset detail. Keep a repeatable camera, lighting setup and scene state.
2. Compare the full frame side by side and with an aligned overlay. Check landmark positions, trainer scale, roof/bridge silhouettes, foliage density, palette, shadows, water/foam and HUD geometry. Inspect close crops of architecture, grass/trees, characters, water/bridge and UI.
3. Record differences and correct them. A playable scene, packaged executable or approved individual asset does not itself establish a matching finished scene. Do not label the result "100% matched" while visible differences remain unresolved.
4. Obtain user review of the engine comparison before marking the visual target accepted or multiplying the library. Record any agreed deviation explicitly. This review is the planned completion gate; it does not require asking again before preparing reviewable assets within an authorized task.
5. Then check the same art while moving: occlusion, animation, repeated textures, reduced motion and other aspect ratios must retain the approved style. The reference-frame composition applies to the matching view; additional areas extend its visual language.

## Production boundaries

### A. Current town corner: establish the quality standard

Already playable: cottage exterior, paved plaza, garden/meadow, stream, timber bridge, fences, trees, rocks, flowers, bench, lamps, signs, trainer, gardener, following Bulbasaur study, and a short herb errand with saving.

The reusable kit contains eight source meshes, one generated four-material atlas, and thirty editable Unreal materials. These establish assembly and interaction foundations. The trainer, gardener, and Bulbasaur are constructed studies, not finished skinned characters. Audio, the concept's waterfall, and cottage interiors are not implemented.

The first art-production batch should prove representative assets: a detailed healing-building facade/roof section, cottage section, tree/grass cluster, rocky cascade, bridge section, trainer and one companion, plus the matching HUD treatment. These are intermediate production checks. The final matching scene must include all landmarks, character appearances and dressing listed above; the smaller prototype's asset count is not a cap. Final character topology, rigs, textures and production texture sampling remain work to do.

### B. First story chapter: The Silent Stream

| Location | Required production content |
| --- | --- |
| Verdant Town | Home exit, starter/professor interaction, healing interior, small shop, storage access, route exit; reusable cottage and street dressing |
| Meadow Route | Connected path, bridge and banks, encounter grass, clue locations, two optional NPCs, item pickup, return route |
| Woodland Clearing | Distinct landmark, apprentice-ranger challenge approach, guarding Pokémon presentation, survey/signal device, restored state |
| Battle scene | One readable outdoor arena with creature placement, camera framing, trainer presentation, command UI, hit/status/capture effects |

Chapter sequence: choose a starter → receive supplies → investigate stream clues → encounter and catch Pokémon → battle the apprentice ranger → find and disable the distressing device → show the habitat recovering → report to the professor.

Plan the device as one asset with inactive/active states, supported by lighting, effects, and sound. Plan restoration through observable environment, creature behavior, and audio changes; it need not require two complete copies of the environment.

### C. Later game: reserve categories, defer production

The accepted larger arc includes regional investigations, a company redirecting Pokémon, a central station beneath a sanctuary, a Championship battle against the rival, and postgame restoration/research/battle goals. Region size, additional biomes, Gym structure, teams, and expanded roster are unresolved. Do not use these open categories to inflate the first chapter asset list.

## Asset work packages

| Package | Breakdown for the asset plan |
| --- | --- |
| Modular architecture | Walls, corners, foundations, roof sections, doors/windows, steps, fences/gates, bridge deck/posts/rails; cottage, healing, shop and research/service variants |
| Landscape and nature | Grass/dirt/paving surfaces and transitions, bank/cliff pieces, rocks, broadleaf/conifer trees, shrubs, decorative grass, encounter grass, flowers, river surface and shoreline details |
| Props and interactions | Bench, lamp, sign, planters, crates/service furniture as needed, herb/item pickup, starter presentation, healing/storage props, signal device and clue props |
| Human characters | Player trainer, professor, apprentice ranger, town/route residents, service staff; shared body/rig/clothing variants where suitable. Rival production depends on confirmed chapter appearances |
| Pokémon | Final models, textures, rigs, locomotion and battle presentation; presentation scale recorded per species |
| Effects | Water/shore foam, restrained foliage motion, interaction/pickup feedback, encounter/scene transitions, release/capture, attack/hit/status/faint/evolution cues required by enabled content |
| UI | Panels, buttons/focus/disabled states, fonts, input glyphs, creature portraits, item/type/status icons, minimap markers, dialogue, starter selection, battle, party, bag, storage, Pokédex, shop, settings, save/load |
| Audio | Town/route/battle music, ambience, stream before/after restoration, footsteps, interactions, UI, supported creature calls, battle/capture/healing/device effects; voice acting is deferred |

## Characters and animation scope

The proposed catalog contains **16 species**: Bulbasaur, Ivysaur, Venusaur; Charmander, Charmeleon, Charizard; Squirtle, Wartortle, Blastoise; Pidgey, Pidgeotto, Pidgeot; Rattata, Raticate; Pikachu, Raichu.

Separate the proposed catalog from the first art batch; the sixteen-species scope still requires content lock. Start by proving the trainer and one companion pipeline. Then schedule the starter trio and enabled chapter encounters. Later forms need not be reachable in Chapter 1; do not enable a form without its required assets and gameplay support.

Minimum trainer set: idle, walk, run, interaction, battle-command gesture. Minimum Pokémon set: idle, locomotion, attack cue, hit reaction, faint, release/capture presentation where applicable. Add species-specific movement and supported move effects according to actual content. A shared attack cue does not promise a bespoke animation for every move.

## Handoff and completion criteria

Every asset-list entry should record: ID/name, package/location, gameplay role, priority, quantity/variants, source and usage status, owner, dependencies, model/rig/animation needs, material/texture needs, collision/pivot/scale, Unreal destination, completion status, and in-engine acceptance evidence.

Use centimetres consistently. Deliver editable source files alongside Unreal-ready meshes, materials, textures and animations. Agree on interchange formats, skeletons, material packing, naming, texture sizes, LODs, collision and measured budgets before batch production. The existing small atlas is a prototype; production textures need validated repetition, mipmaps and distance readability. PokéAPI provides reference facts and selected media references, not a finished animated 3D asset library.

Approve each representative asset in the playable corner: correct silhouette at game camera, consistent material/light response, good player visibility, valid collision, required animation/state behavior, and reusable assembly. Expand the library only after that quality bar is established. Numerical performance targets and minimum hardware remain open.

## Source documents

- [Game-ready asset package plan](asset-package-plan.md) and [proposed inventory](asset-package-inventory.json)
- [Game design](game-design.md)
- [Story and end-game](story-and-endgame.md)
- [Visual direction](visual-direction.md)
- [Town corner delivery](town-corner-delivery.md)
- [Existing kit](../assets/town-kit/README.md)
