"""Render the imported kit using Unreal, independently of C++ compilation."""
from pathlib import Path
import time
import unreal as u

ROOT=Path(u.Paths.project_dir()).resolve().parent
OUT=ROOT/'output/screenshots'
OUT.mkdir(parents=True,exist_ok=True)
u.EditorPythonScripting.set_keep_python_script_alive(True)
level=u.get_editor_subsystem(u.LevelEditorSubsystem)
actors=u.get_editor_subsystem(u.EditorActorSubsystem)
world=u.EditorLoadingAndSavingUtils.new_blank_map(False)
if world is None: raise RuntimeError('Could not create clean kit gallery')


def piece(mesh,mat,p,s=(1,1,1)):
    a=actors.spawn_actor_from_class(u.StaticMeshActor,u.Vector(*p))
    c=a.static_mesh_component
    c.set_static_mesh(u.load_asset(mesh))
    c.set_material(0,u.load_asset('/Game/Art/Materials/M_'+mat))
    a.set_actor_scale3d(u.Vector(*s))
    return a


piece('/Engine/BasicShapes/Cube','Plaster',(0,0,-20),(11,9,.3))
names=['Roof','Trunk','Canopy','Rock','GrassTuft','Flower','Leaf']
mats=['Roof','Wood','Leaves','Stone','LeavesLight','FlowerPink','Mint']
for i,(name,mat) in enumerate(zip(names,mats)):
    x=-350+(i%4)*230
    y=120 if i<4 else -190
    piece('/Engine/BasicShapes/Cube','Cream',(x,y,4),(1.8,1.8,.1))
    piece('/Game/Art/Meshes/'+name,mat,(x,y,60 if name in {'Canopy','Rock'} else 10),(1.4,1.4,1.4))
sun=actors.spawn_actor_from_class(u.DirectionalLight,u.Vector(0,0,600),u.Rotator(-48,-28,0))
sun.light_component.set_mobility(u.ComponentMobility.MOVABLE)
sun.light_component.set_editor_property('intensity',4.)
sky=actors.spawn_actor_from_class(u.SkyLight,u.Vector(0,0,500))
sky.light_component.set_mobility(u.ComponentMobility.MOVABLE)
sky.light_component.set_editor_property('source_type',u.SkyLightSourceType.SLS_SPECIFIED_CUBEMAP)
sky.light_component.set_editor_property('cubemap',u.load_asset('/Engine/MapTemplates/Sky/DaylightAmbientCubemap'))
sky.light_component.set_editor_property('intensity',1.3)
camera=actors.spawn_actor_from_class(u.CameraActor,u.Vector(-640,-1050,950))
camera.set_actor_rotation(u.MathLibrary.find_look_at_rotation(camera.get_actor_location(),u.Vector(0,0,40)),False)
camera.camera_component.set_editor_property('projection_mode',u.CameraProjectionMode.ORTHOGRAPHIC)
camera.camera_component.set_editor_property('ortho_width',1250.)
u.EditorLevelLibrary.set_level_viewport_camera_info(camera.get_actor_location(),camera.get_actor_rotation())
u.SystemLibrary.execute_console_command(None,'r.SetRes 1600x900w')
u.SystemLibrary.execute_console_command(None,'r.EyeAdaptationQuality 0')
u.SystemLibrary.execute_console_command(None,'viewmode lit')
u.SystemLibrary.execute_console_command(None,'ShowFlag.Lighting 1')
if not u.EditorLoadingAndSavingUtils.save_map(world,'/Game/Maps/KitGallery'):
    raise RuntimeError('Could not save kit gallery')
start=time.monotonic()
task=None


def tick(dt):
    global task
    elapsed=time.monotonic()-start
    try:
        if task is None and elapsed>20:
            task=u.AutomationLibrary.take_high_res_screenshot(1600,900,str(OUT/'kit-gallery.png'),camera=camera)
        if (task is not None and task.is_task_done()) or elapsed>100:
            u.unregister_slate_post_tick_callback(handle)
            u.EditorPythonScripting.set_keep_python_script_alive(False)
            u.SystemLibrary.quit_editor()
    except Exception:
        u.unregister_slate_post_tick_callback(handle)
        u.EditorPythonScripting.set_keep_python_script_alive(False)
        raise


handle=u.register_slate_post_tick_callback(tick)
