# Sources and research

Checked: 2026-10-15. Online documentation can change. Sources establish API/engine capabilities; project architecture and scope are proposed design decisions.

## Official references

| Source | Used for |
| --- | --- |
| [PokéAPI root](https://pokeapi.co/api/v2/) | User-selected API base and resource discovery |
| [PokéAPI v2 documentation](https://pokeapi.co/docs/v2/) | GET/authentication/caching policy, resource definitions, pagination, historical-field references |
| [Unreal orthographic camera](https://dev.epicgames.com/documentation/en-us/unreal-engine/orthographic-camera-in-unreal-engine) | Camera capability and parameters; installed-version behavior still needs verification |
| [Unreal data-driven gameplay](https://dev.epicgames.com/documentation/en-us/unreal-engine/data-driven-gameplay-elements-in-unreal-engine) | Candidate typed data asset/table integration |
| [Unreal saving and loading](https://dev.epicgames.com/documentation/en-us/unreal-engine/saving-and-loading-your-game-in-unreal-engine) | Candidate SaveGame integration; project recovery guarantees must be implemented |

## Live cached API samples

| Resource | Local raw response | Observed use |
| --- | --- | --- |
| [Bulbasaur Pokémon](https://pokeapi.co/api/v2/pokemon/bulbasaur/) | [JSON](research/pokeapi/pokemon-bulbasaur.json) | Variety/species distinction, stats, learnset version entries, sprites/cries, historical fields |
| [Bulbasaur species](https://pokeapi.co/api/v2/pokemon-species/bulbasaur/) | [JSON](research/pokeapi/pokemon-species-bulbasaur.json) | Growth/evolution references, capture data, names, text, varieties |
| [Tackle](https://pokeapi.co/api/v2/move/tackle/) | [JSON](research/pokeapi/move-tackle.json) | Current power 40 and separate historical value entries; version filtering matters |
| [Grass type](https://pokeapi.co/api/v2/type/grass/) | [JSON](research/pokeapi/type-grass.json) | Effectiveness relationship structure |
| [Medium-slow growth](https://pokeapi.co/api/v2/growth-rate/medium-slow/) | [JSON](research/pokeapi/growth-rate-medium-slow.json) | Experience thresholds |
| [USUM version group](https://pokeapi.co/api/v2/version-group/ultra-sun-ultra-moon/) | [JSON](research/pokeapi/version-group-ultra-sun-ultra-moon.json) | Verified version-group ID 18 and metadata |
| [Evolution chain 1](https://pokeapi.co/api/v2/evolution-chain/1/) | [JSON](research/pokeapi/evolution-chain-1.json) | Nested evolution branch and conditions |

See [manifest](research/pokeapi/manifest.json) for exact fetch metadata. All seven requests succeeded. No full-catalog completeness, full historical fidelity, executable effect correctness, or asset readiness was verified.

## Concept reference

[Isometric town concept](references/isometric-town-concept.png) was generated in this chat using the built-in image generation tool. Prompt direction: stylized fully 3D Pokémon exploration, fixed orthographic isometric view, cozy town, tall grass, trainer with Pikachu, stream/bridge, and minimal gameplay HUD. It is a design reference rather than engine output or production art assets.
