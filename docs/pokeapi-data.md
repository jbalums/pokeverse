# PokéAPI data plan

Status: proposed integration contract. Seven research responses were fetched successfully; no importer exists.

## Authority and boundaries

Use [PokéAPI v2](https://pokeapi.co/api/v2/) for Pokémon reference facts. Its [usage documentation](https://pokeapi.co/docs/v2/) describes GET access without authentication and asks clients to cache resources locally. This project will make bounded development-time requests and ship a validated snapshot.

The API is a reference catalog, not a game backend or battle simulator. Local game content owns maps, encounter weights, NPC teams, dialogue, quests, stock quantities, and presentation assets. Saves own caught individuals and player progress. None of those should be written to PokéAPI.

## Planned resource mapping

Paths below are relative to `https://pokeapi.co/api/v2/`. Follow resource references rather than assuming related resources share an ID.

| Resource | Use in the game catalog |
| --- | --- |
| `pokemon/{id-or-name}/` | Variety identity, base stats, types, ability slots, learnset references, dimensions, sprite and cry references |
| `pokemon-species/{id-or-name}/` | Species identity, localized names/descriptions, capture rate, growth reference, evolution reference, varieties |
| `move/{id-or-name}/` | Move reference values and metadata used to build explicit effect handlers |
| `type/{id-or-name}/` | Type references and effectiveness relationships |
| `ability/{id-or-name}/` | Ability identities and descriptions; implementation remains local |
| `growth-rate/{id-or-name}/` | Cumulative experience thresholds |
| `evolution-chain/{id}/` | Branches and evolution conditions |
| `item/{id-or-name}/` | Supported item identities and reference properties |
| `nature/{id-or-name}/` | Nature identity and stat relationships |
| `stat/{id-or-name}/` | Stable stat identities |
| `version-group/{id-or-name}/` | Learnset version identity and ordering |
| `version/{id-or-name}/`, `generation/{id-or-name}/` | Provenance and compatibility metadata |
| `pokemon-form/{id-or-name}/` | Form metadata when needed; first scope only enables default varieties |
| `machine/{id}/` | Later machine learnsets; excluded from the first level-up-only profile |
| `location/`, `location-area/`, encounter resources | Optional official-world reference; not the source of our original map tables |

See the [live Bulbasaur response](https://pokeapi.co/api/v2/pokemon/bulbasaur/), [species response](https://pokeapi.co/api/v2/pokemon-species/bulbasaur/), and [Tackle response](https://pokeapi.co/api/v2/move/tackle/) for sampled field structures. Endpoint presence alone does not prove every field is populated for every resource.

## Snapshot and rules profile

Do not use `latest` as a build identity. Every packaged catalog has:

| Field | Contract |
| --- | --- |
| `catalogId` | Immutable project identifier assigned when a snapshot is accepted |
| `schemaVersion` | Version of normalized game data |
| `rulesProfileId` | Versioned executable mechanics contract, proposed `slice-v1` |
| `learnsetVersionGroup` | Proposed `ultra-sun-ultra-moon`, ID verified as 18 in the research response |
| `referenceValuePolicy` | Proposed `snapshot-current`: preserve current returned base values, not historical reconstruction |
| `language` | Proposed `en`; do not use localized strings as keys |
| `sources` | URL, UTC fetch timestamp, SHA-256, response status per raw resource |
| `supportManifestHash` | Identifies allowed species/forms/moves/abilities/items/evolution handlers |
| `normalizedHash` | Digest of deterministic normalized content |

The proposed profile combines USUM level-up availability with current values from a frozen snapshot. It is deliberately a custom game ruleset. Choosing an older learnset does **not** automatically make types, stats, abilities, moves, items, or battle behavior historically accurate.

If faithful historical gameplay is chosen instead, replace this policy with a separately specified resolver using available historical records, including `past_values`, `past_types`, `past_stats`, `past_abilities`, and `past_damage_relations`. Prove ordering/boundary semantics with fixtures and report data gaps; do not silently fall back to current values. Existing samples show these fields, but do not establish complete historical coverage.

For the proposed profile, import only move learn entries matching the selected version group and enabled method (`level-up` first). Never combine learnsets across every version. New encounters get legal moves at their level; level-zero/evolution entries, duplicate entries, and ties need an explicit deterministic ordering in the mechanics contract.

## Import workflow

1. Read a checked-in roster/support configuration, profile, schema version, and language.
2. Resolve the allowed Pokémon and their referenced species, types, moves, abilities, growth, and evolution resources. Traverse only required dependencies, not the entire API.
3. Fetch missing raw resources into a local cache. Reuse existing responses unless an explicit refresh is requested.
4. Normalize identities and data into typed records; keep original responses untouched.
5. Apply version filtering and the profile policy. Validate the complete dependency graph and executable support matrix.
6. Generate deterministic catalog files and a source manifest in a staging directory.
7. Produce a readable diff: additions, removals, reference changes, balance-affecting changes, missing values, and unsupported content.
8. Promote only a fully valid snapshot. A failed refresh leaves the previously accepted catalog intact.
9. Import normalized records into Unreal assets and validate cook/package inclusion.

Proposed importer implementation: a standalone Python CLI plus an Unreal editor import step. Both are planned, not created by this documentation task. Raw API JSON must never be parsed repeatedly on the game thread during play.

If list discovery is needed, follow pagination until `next` is null, deduplicate canonical resource identities, and reject cycles or unexpected origins. Do not assume consecutive IDs, a fixed total Pokémon count, or that list counts are stable.

## Request and cache policy

Proposed limits are project choices, not claimed provider limits: two concurrent requests maximum; 20-second request timeout; up to three retries after the initial attempt for transient network/5xx/429 failures; exponential backoff with jitter and `Retry-After` when supplied. Do not retry 404 as a transient error.

Cache each successfully requested response before transformation. A normal offline rebuild uses cached inputs only and fails clearly if a required input is missing. Explicit refresh writes a new candidate snapshot and compares it to the accepted one. Never silently replace a pinned response because a TTL expired.

Allow API JSON references only under the configured HTTPS API origin and expected resource paths. Media downloads have a separate explicit host/path allowlist, bounded size, timeouts, format validation, and hashes. Do not fetch arbitrary URLs found in source text or accept HTML as a JSON resource. No credentials or API key are required for this plan.

## Normalized records

These are conceptual data contracts, not implemented classes or a finalized serialization schema.

| Record | Required fields / invariants |
| --- | --- |
| `PokemonDefinition` | Pokémon/variety ID, species ID, slug, form key, six base stats keyed by stat identity, ordered types, supported ability slots, learnset, asset key, provenance |
| `SpeciesDefinition` | Species ID, localized display name, growth key, capture rate, evolution graph key, text provenance |
| `MoveDefinition` | Move ID, type, damage class, nullable power/accuracy, PP, priority, targets, handler key and parameters, provenance |
| `AbilityDefinition` | Ability ID, display text, explicit handler key, supported trigger stages |
| `ItemDefinition` | Item ID, category, supported contexts, handler key, reference cost plus any explicit project override |
| `GrowthDefinition` | Growth ID, cumulative experience table indexed by level |
| `EvolutionDefinition` | From/to species or variety references, all conditions, handler key, source branch identity |
| `TypeDefinition` | Type ID, localized name, attack-to-defense multiplier table |
| `PresentationBinding` | Pokémon/variety ID, mesh, animation, UI image, optional cry, scale, asset source/status |

Use stable numeric resource IDs plus resource kind; retain slugs for diagnostics. Species and Pokémon/variety IDs are different namespaces. Never key an individual or a save by its translated name or an array position. Map stats and types by identity/slot, not the arrival order of a JSON array. Preserve API units and explicitly convert height/weight for display or assets.

Flavor text selection: requested language + preferred version first, then deterministic same-language fallback with its version recorded; finally show the imported slug or an honest unavailable description. Normalize control characters for display while retaining raw source. Never substitute an unrelated species description.

## Null and support handling

- Null accuracy/power is not automatically 100 accuracy/zero damage; handler semantics determine meaning.
- Missing artwork/cry uses an identified generic placeholder or silence; missing gameplay-critical data blocks publication.
- Distinguish absent, null, zero, and empty collections in normalization.
- A full evolution branch may contain several alternatives. Preserve branching and conjunctions; reject reachable unsupported conditions.
- Resolve dual-type effectiveness by composition, retaining immunities.
- An ability slot selected for spawning must be supported; hidden abilities remain disabled unless explicitly included.
- Maintain a per-ID support matrix with handler, parameters, fixtures, and profile. Similar text does not imply identical behavior.
- All obtainable level-up moves, NPC moves, evolution destinations, and usable items must pass support validation. Changing roster/level bounds cannot silently hide unsupported behavior from existing saves.

## Runtime and catalog updates

The packaged game reads its bundled accepted catalog and local presentation bindings. PokéAPI downtime cannot block new game, battle, healing, or save/load. No live refresh runs inside a playthrough.

Save files store their catalog/profile versions. A catalog upgrade requires explicit compatibility validation or migration before loading affected saves. Preserve unknown IDs and the original save for diagnostics; do not delete creatures or map them to a different species. Catalog removal is a migration decision, not a normal import side effect.

## Research evidence

Seven raw responses are cached in [research/pokeapi](research/pokeapi/manifest.json). They were fetched on 2026-10-15 UTC; exact timestamps, byte hashes, and URLs are in the manifest. This is a small research fixture set, not an accepted game catalog or full roster import.
