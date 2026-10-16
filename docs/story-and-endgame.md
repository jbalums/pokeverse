# Story and end-game

Status: narrative direction accepted by the user on 2026-10-15. Detailed quests, dialogue, regional content, and balance remain to be designed. No story systems are implemented.

Working title: **Pokémon: Verdant Trails**. The title remains provisional.

## Premise

Wild Pokémon are abandoning their habitats. Some crowd into towns; others defend places they would normally leave alone. The player begins in Verdant Town as a new trainer and field assistant, investigating behavior that stronger Pokémon alone cannot explain.

The journey has two connected ambitions: become the regional Champion and understand what is happening to the region's Pokémon. Battling builds the ability to face dangerous situations; research reveals which problems need a different solution.

The tone is warm adventure with an escalating mystery. Pokémon are companions and living inhabitants of the region, rather than enemies responsible for the disruption. The original setting, characters, network, and quests are project-authored; imported Pokémon facts remain sourced from PokéAPI.

## Main relationships

| Character | Role and development |
| --- | --- |
| Player | New trainer and field assistant who grows into both a capable battler and an attentive researcher. |
| Local professor | Starts the investigation and gives field assignments; supports the player without solving every discovery for them. |
| Rival | A childhood friend from town aiming for the League. Initially believes strength can solve any problem; gradually learns why observation and cooperation matter. |
| Apprentice ranger | Introduces field safety and accompanies the first investigation after a training battle. |
| Company lead trainer | Defends the network project and becomes the final major battle of the central-station investigation. |

Character names, company name, and final team compositions are open. The company claims its network will make settlements safer by redirecting Pokémon. Its actions displace the problem into neighboring habitats, giving the conflict a concrete cause rather than an unexplained evil plan.

## Chapter 1 — The Silent Stream

This is the narrative for the first playable town, route, and clearing. It has a local resolution and a clear hook into the larger game.

1. **An interrupted beginning.** On the day the player is to receive a starter, frightened wild Pokémon enter town. Residents report that the nearby stream has gone quiet and a normally gentle Pokémon is guarding the woodland clearing.
2. **First assignment.** Choose Bulbasaur, Charmander, or Squirtle. The professor provides supplies and asks the player to investigate the waterway.
3. **Clues on Meadow Route.** Speak with residents, observe unusual behavior, and inspect the stream. Wild encounters introduce battling and catching; no specific capture is required to understand the clues.
4. **The ranger's challenge.** Battle the apprentice ranger to demonstrate basic readiness. This is the introductory trainer encounter already planned for the clearing approach, not an additional boss requirement. On defeat, heal and retry without repeating one-time grants.
5. **The clearing.** With the ranger, discover an old survey device emitting a signal that distresses nearby Pokémon. The guarding Pokémon is reacting to the signal, not acting as the story's villain. Its species and exact encounter presentation remain open within the supported roster.
6. **Restore the stream.** Disable the device through a short authored interaction. The stream's normal sounds and local Pokémon behavior return. Device shutdown and local restoration persist together.
7. **A wider mystery.** Report to the professor. The device was recently repaired, and similar signals have been reported elsewhere. Receive the next field assignment and a chapter-complete save point.

The first playable ends here. It does not include the regional League, the central station, or postgame facilities. Finishing the ranger battle alone does not complete the chapter; the player must resolve the device and report back.

## Full-game arc

| Act | Story progression | Player progression |
| --- | --- | --- |
| I — First signs | Restore the stream and discover the repeated signal. | Learn exploration, battling, catching, and field observation. |
| II — Following the trails | Investigate displaced populations across the region and connect them to reactivated survey stations. | Build a team, complete field assignments, and pursue the League challenge. |
| III — The promise of safety | Discover the company is redirecting Pokémon away from settlements through an abandoned network. Each protected settlement is shifting pressure elsewhere. | Revisit places and Pokémon helped earlier; assemble evidence and allies. |
| IV — The sanctuary | Reach the central station beneath the original Pokémon sanctuary, where the signals are drawing displaced Pokémon into one unstable habitat. | Apply battle strength, research knowledge, and relationships to reach and shut down the network. |
| V — The Championship | With migration routes recovering, return to the League and face the rival as the final Championship opponent. | Fulfill the trainer ambition after resolving the regional crisis. |

The rival faces a choice between a career-making tournament opportunity and helping stop the network, and chooses to help. Their later Championship battle remains competitive and personal; cooperation does not erase either trainer's ambition.

Exact region size, Gym structure, locations, species expansion, League qualification rules, and chapter count are not yet scoped. These beats describe the accepted destination, not additional first playable deliverables.

## Story finale

The player and rival enter the sanctuary together. Pokémon and communities helped earlier assist with reaching the central station, so the investigation has consequences beyond a quest checklist. Design these assists around recorded story progress, with alternatives where necessary; do not require a specific Pokémon still to occupy the player's party.

Battle the company's lead trainer, reach the controls, and shut down the signal network. Restore migration routes and show recognizable changes in previously affected places. The crisis resolution is its own saved milestone, followed by the League finale rather than an immediate cut to credits.

The final Championship match is against the rival. Winning completes the main story and recognizes the player as Champion. Losing allows a rematch without repeating the sanctuary climax or rolling back habitat restoration.

The narrative does not require a mandatory legendary capture or a specific final team. Those additions would need separate design decisions and supported data/assets.

## After the credits

The long-term goals are **Champion** and **Master Field Researcher**. Players may pursue battle challenges, field work, or both; total Pokédex completion is not required to finish the story.

| Activity | Repeatable or lasting goal | Design requirements |
| --- | --- | --- |
| Habitat restoration | Return to affected locations, complete field assignments, and unlock encounters as Pokémon return. | Persistent restoration stages and explicit encounter-table changes; no claim of simulated ecology. |
| Master League | Rematch stronger Gym Leaders, specialist trainers, and the rival with revised teams. | Authored legal teams, clear unlocks, and rewards that do not duplicate story grants. |
| Pokédex completion | Find rare species, complete supported evolution lines, and investigate elusive Pokémon. | Completion targets tied to the obtainable released catalog, not every upstream API entry. |
| Battle facility | Repeat challenges with level limits and team restrictions. | Published rules, legal team validation, distinct challenge state, and recoverable results. |

Postgame rewards emphasize cosmetics and trainer distinctions. Exact reward tables, challenge formats, mastery criteria, and catalog expansion are open. Every activity needs authored content and implementation; none is provided automatically by PokéAPI.

## Quest and save requirements

Persist chapter progress with stable quest/objective IDs rather than dialogue line numbers. First chapter milestones include starter received, investigation accepted, clues recorded, ranger defeated, device disabled, local habitat restored, report delivered, and chapter reward granted.

Interactable devices, map appearance, NPC dialogue, objectives, and encounter-table selection must derive from the same persisted story state. Returning to the area or loading a save must not reactivate a disabled device, replay rewards, or strand the player between objectives. If device shutdown saves before the report, resume at the report objective.

Keep larger milestones distinct: network shutdown, League qualification, Championship victory, credits seen, postgame unlocked, and research mastery. A Champion save must not restart the crisis; a pre-Championship save must retain the restored region.

## Narrative acceptance

For the first playable, verify the entire clue-to-device-to-report sequence, recovery after the ranger battle, persistence after device shutdown, and one-time reward behavior. Show the stream's restoration through observable world/audio changes, not only a success message.

For the full game, verify the sanctuary and Championship as separate milestones, the rival's story continuity, postgame unlocks, and world-state persistence. These checks belong to future expanded scope and are not satisfied by the first playable.
