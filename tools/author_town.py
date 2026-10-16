"""Save the native town assembly into the editor map after C++ compilation."""
from pathlib import Path
import unreal as u

level=u.get_editor_subsystem(u.LevelEditorSubsystem)
actors=u.get_editor_subsystem(u.EditorActorSubsystem)
if not level.load_level('/Game/Maps/VerdantCorner'):
    raise RuntimeError('Generate the assets and town map first.')
town_class=u.load_class(None,'/Script/VerdantTrails.TownKit')
if town_class is None:
    raise RuntimeError('Build VerdantTrailsEditor before authoring the native town.')
for actor in actors.get_all_level_actors():
    if actor.get_class()==town_class:
        actors.destroy_actor(actor)
town=actors.spawn_actor_from_class(town_class,u.Vector(0,0,0))
town.set_actor_location(u.Vector(0,0,0),False,True)
town.set_actor_label('Verdant Corner - reusable town assembly')
if not level.save_current_level():
    raise RuntimeError('Town map could not be saved.')
u.log('VERDANT_TOWN_AUTHORED: native kit saved in editor map')
