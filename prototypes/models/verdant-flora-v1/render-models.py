import bpy, json, math, pathlib, sys
from mathutils import Vector

root = pathlib.Path(__file__).resolve().parents[3]
scratch = pathlib.Path(__file__).parent
out = root / 'prototypes/models/verdant-flora-v1'
if '--' not in sys.argv:
    raise RuntimeError('Use node rebuild-models.mjs --render <Blender executable>')
models = json.loads(pathlib.Path(sys.argv[sys.argv.index('--') + 1]).read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)

def color(hex):
    vals = [int(hex[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(v/12.92 if v<=0.04045 else ((v+0.055)/1.055)**2.4 for v in vals)

def material(name, col):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color(col),1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color(col),1); bs.inputs['Roughness'].default_value=.95
    return m

flora=bpy.data.materials.new('Authored Flora Vertex Colours'); flora.use_nodes=True
bs=flora.node_tree.nodes.get('Principled BSDF'); bs.inputs['Roughness'].default_value=.95
vc=flora.node_tree.nodes.new('ShaderNodeVertexColor'); vc.layer_name='Col'; flora.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color'])
floor=material('Warm ivory studio','#e8e5d8'); turf=material('Meadow display bases','#90b762'); ink=material('Forest green captions','#274a35')
library={}
for name,data in models.items():
    p=data['position']; verts=[(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)]
    ids=data['index']; faces=[ids[i:i+3] for i in range(0,len(ids),3)]
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    colors=mesh.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT'); c=data['color']
    for i,x in enumerate(colors.data): x.color=(c[i*3],c[i*3+1],c[i*3+2],1)
    for f in mesh.polygons: f.use_smooth=True
    n=data['normal']; mesh.normals_split_custom_set_from_vertices([(n[i],-n[i+2],n[i+1]) for i in range(0,len(n),3)])
    mesh.materials.append(flora); library[name]=mesh

def setup(name,camera_position,target,ortho,width,height):
    scene=bpy.data.scenes.new(name); bpy.context.window.scene=scene
    scene.render.engine='CYCLES'; scene.cycles.samples=24; scene.cycles.use_denoising=True
    scene.cycles.max_bounces=4; scene.render.resolution_x=width; scene.render.resolution_y=height; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=False
    scene.view_settings.view_transform='Standard'; scene.view_settings.look='None'; scene.view_settings.exposure=0; scene.view_settings.gamma=1
    world=bpy.data.worlds.new(name+' World'); world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.7,.77,.8,1); world.node_tree.nodes['Background'].inputs[1].default_value=.65; scene.world=world
    data=bpy.data.cameras.new(name+' Camera'); camera=bpy.data.objects.new(name+' Camera',data); scene.collection.objects.link(camera)
    camera.location=camera_position; camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler(); data.type='ORTHO'; data.ortho_scale=ortho; scene.camera=camera
    sun=bpy.data.lights.new(name+' Sun','SUN'); sun.energy=2.2; sun.angle=.18; obj=bpy.data.objects.new(name+' Sun',sun); scene.collection.objects.link(obj); obj.rotation_euler=(.45,-.4,-.6)
    data=bpy.data.lights.new(name+' Softbox','AREA'); data.energy=500; data.shape='DISK'; data.size=10
    obj=bpy.data.objects.new(name+' Softbox',data); scene.collection.objects.link(obj); obj.location=(-4,-6,11); obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.08)); bpy.context.object.name='Studio floor'; bpy.context.object.data.materials.append(floor)
    return scene

def specimen(scene,name,x,y,scale=1):
    obj=bpy.data.objects.new(name,library[name]); scene.collection.objects.link(obj); obj.location=(x,y,0); obj.scale=(scale,scale,scale)
    obj['model_id']=name; obj['label']=models[name]['label']; obj['source']='verdant-town-3d.html:buildFloraModels'; obj['units']='metres'
    return obj

def caption(text,x,y,size=.22,z=.025):
    curve=bpy.data.curves.new(text,'FONT'); curve.body=text; curve.align_x='CENTER'; curve.size=size; curve.extrude=0
    obj=bpy.data.objects.new(text,curve); bpy.context.scene.collection.objects.link(obj); obj.location=(x,y,z); obj.rotation_euler=(math.radians(48),0,0); curve.materials.append(ink)

def base(x,y,r):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=r,depth=.055,location=(x,y,-.035)); o=bpy.context.object; o.name='Specimen meadow'; o.data.materials.append(turf)

trees=setup('01 Tree Variants',(0,-16,20),(0,0,.8),19.0,1800,1500)
tree_ids=[k for k,v in models.items() if v['category']=='tree']
for i,name in enumerate(tree_ids):
    x=(i%3-1)*4.5; y=(1-i//3)*4.7
    base(x,y,1.75); specimen(trees,name,x,y)
    caption(models[name]['label'],x,y-1.85,.26)
caption('VERDANT TOWN  /  ACTUAL 3D TREE MODELS',0,6.7,.34,z=3.7)
caption('Layered leaves  /  Original geometry  /  1,660 - 2,860 triangles per tree',0,-7.4,.23)
trees.render.filepath=str(out/'tree-variants-preview.png')
bpy.ops.render.render(write_still=True)

plants=setup('02 Groundcover Library',(0,-10,14),(0,0,.25),13.4,1800,1500)
plant_ids=[k for k,v in models.items() if v['category']!='tree']
for i,name in enumerate(plant_ids):
    x=(i%4-1.5)*2.4; y=(1.5-i//4)*2.2
    s=.95 if name in ['grass_tall','grass_meadow','grass_fan','reeds','cattails','wheat'] else 1.1 if name in ['bush','berry_bush','flower_bush'] else 1.6
    base(x,y,.95); specimen(plants,name,x,y,s)
    caption(models[name]['label'],x,y-.93,.19)
caption('VERDANT TOWN  /  ACTUAL 3D GROUNDCOVER',0,5.45,.30)
caption('Curved blades  /  Folded leaves  /  Cupped petals  /  Opaque vertex colours',0,-6.7,.18)
plants.render.filepath=str(out/'groundcover-preview.png')
bpy.ops.render.render(write_still=True)

# A close group at actual in-game scale makes silhouette / material consistency visible without a browser.
garden=setup('03 Model Garden',(7,-11,8),(0,0,1),9,1600,1200)
for name,x,y in [('oak',-1.8,1.0),('fir',1.6,1.8),('sapling',2.5,-.3),('bush',-1.4,-.5),('berry_bush',-2.8,-.4)]: specimen(garden,name,x,y)
for i in range(28):
    a=i*2.39996; r=.7+(i%6)*.35; x=math.sin(a)*r; y=math.cos(a)*r-.6
    specimen(garden,['grass_meadow','daisy','cosmos','clover','grass_fan','buttercup','lavender'][i%7],x,y,.4 if i%7 in [0,4] else .85)
specimen(garden,'fern',-2.4,-1.3); specimen(garden,'mushrooms',-1.4,-1.3)
caption('VERDANT TOWN  /  MODELED FLORA',0,-3.15,.25)
caption('Actual exported meshes - studio lighting, not an in-game screenshot',0,-3.55,.16)
garden.render.filepath=str(out/'model-garden-preview.png')
bpy.ops.render.render(write_still=True)
bpy.context.window.scene=trees
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'verdant-flora-v1.blend'))
print('FLORA_RENDER_COMPLETE',len(models),out)
