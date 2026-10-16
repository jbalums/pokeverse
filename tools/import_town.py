"""Run with UnrealEditor-Cmd -run=pythonscript -script=<this file>.

Creates real Unreal textures, editable node materials, mesh assets and a map.
Safe to repeat: only replaces the generated /Game/Art and VerdantCorner outputs.
"""
from pathlib import Path
import json
import unreal as u

ROOT = Path(u.Paths.project_dir()).resolve().parent
KIT = ROOT / "assets/town-kit"
ART = "/Game/Art"
TOOLS = u.AssetToolsHelpers.get_asset_tools()
MEL = u.MaterialEditingLibrary
EAL = u.EditorAssetLibrary


def load_or_create(name, folder, cls, factory):
    obj = EAL.load_asset(folder+"/"+name)
    return obj or TOOLS.create_asset(name,folder,cls,factory)


def expr(mat, cls, **props):
    e = MEL.create_material_expression(mat,cls)
    for k,v in props.items():
        e.set_editor_property(k,v)
    return e


def connect(a, b, pin="", output=""):
    if not MEL.connect_material_expressions(a,output,b,pin):
        raise RuntimeError(f"Cannot connect {a.get_class().get_name()} -> {b.get_class().get_name()}.{pin}")


def property_link(a,mat,prop):
    if not MEL.connect_material_property(a,"",prop):
        raise RuntimeError(f"Cannot connect material property {prop}")


def import_files():
    tasks = []
    for path in sorted((KIT/"meshes").glob("*.obj")):
        task = u.AssetImportTask()
        task.filename=str(path)
        task.destination_path=ART+"/Meshes"
        task.destination_name=path.stem
        task.automated=True
        task.replace_existing=True
        task.save=True
        opts=u.FbxImportUI()
        opts.set_editor_property("import_mesh",True)
        opts.set_editor_property("import_materials",False)
        opts.set_editor_property("import_textures",False)
        opts.set_editor_property("import_as_skeletal",False)
        opts.set_editor_property("automated_import_should_detect_type",False)
        opts.set_editor_property("mesh_type_to_import",u.FBXImportType.FBXIT_STATIC_MESH)
        opts.static_mesh_import_data.set_editor_property("combine_meshes",True)
        opts.static_mesh_import_data.set_editor_property("auto_generate_collision",False)
        opts.static_mesh_import_data.set_editor_property("normal_import_method",u.FBXNormalImportMethod.FBXNIM_COMPUTE_NORMALS)
        task.options=opts
        task.factory=u.FbxFactory()
        tasks.append(task)
    texture_task=u.AssetImportTask()
    texture_task.filename=str(KIT/"textures/town-material-atlas.png")
    texture_task.destination_path=ART+"/Textures"
    texture_task.destination_name="T_TownAtlas"
    texture_task.automated=True
    texture_task.replace_existing=True
    texture_task.save=True
    tasks.append(texture_task)
    TOOLS.import_asset_tasks(tasks)
    for task in tasks:
        if not task.imported_object_paths:
            raise RuntimeError("Import produced no asset: "+task.filename)
    mesh_sub=u.get_editor_subsystem(u.StaticMeshEditorSubsystem)
    trunk=EAL.load_asset(ART+"/Meshes/Trunk")
    mesh_sub.remove_collisions(trunk)
    mesh_sub.add_simple_collisions(trunk,u.ScriptingCollisionShapeType.BOX)
    texture=EAL.load_asset(ART+"/Textures/T_TownAtlas")
    texture.set_editor_property("srgb",True)
    texture.set_editor_property("never_stream",True)
    # Generated atlas is NPOT. Clamp and disable mip generation; inset each cell
    # so sampling cannot bleed between material families.
    texture.set_editor_property("mip_gen_settings",u.TextureMipGenSettings.TMGS_NO_MIPMAPS)
    texture.set_editor_property("address_x",u.TextureAddress.TA_CLAMP)
    texture.set_editor_property("address_y",u.TextureAddress.TA_CLAMP)
    return texture


def collection():
    mpc=load_or_create("MPC_Town",ART+"/Materials",u.MaterialParameterCollection,u.MaterialParameterCollectionFactoryNew())
    scalar=u.CollectionScalarParameter()
    scalar.set_editor_property("parameter_name","Motion")
    scalar.set_editor_property("default_value",1.)
    vector=u.CollectionVectorParameter()
    vector.set_editor_property("parameter_name","Player")
    vector.set_editor_property("default_value",u.LinearColor(-850,-650,0,1))
    mpc.set_editor_property("scalar_parameters",[scalar])
    mpc.set_editor_property("vector_parameters",[vector])
    return mpc


COLORS={
    "Grass":(.39,.52,.14),"Paving":(.68,.58,.39),"Wood":(.32,.15,.055),"Roof":(.66,.17,.075),
    "Leaves":(.16,.34,.065),"LeavesLight":(.32,.47,.08),"LeavesDark":(.055,.20,.10),
    "Stone":(.43,.46,.38),"Plaster":(.85,.77,.57),"WoodLight":(.55,.34,.15),
    "Dirt":(.64,.45,.23),"Soil":(.19,.16,.085),"Water":(.035,.35,.46),
    "Foam":(.66,.89,.83),"FlowerCream":(.94,.90,.67),"FlowerPink":(.76,.23,.45),
    "FlowerBlue":(.25,.45,.81),"Gold":(.96,.60,.12),"Iron":(.055,.075,.08),
    "Glow":(1.,.66,.24),"Glass":(.17,.43,.49),"Rope":(.75,.68,.48),
    "Skin":(.88,.58,.36),"Straw":(.76,.58,.23),"Denim":(.045,.16,.25),
    "Jacket":(.075,.30,.49),"Cream":(.92,.88,.71),"Red":(.72,.075,.055),
    "Mint":(.18,.60,.43),"Invisible":(0,0,0),
}


def material(name,color,texture,mpc):
    mat=load_or_create("M_"+name,ART+"/Materials",u.Material,u.MaterialFactoryNew())
    MEL.delete_all_material_expressions(mat)
    masked=name in {"Leaves","LeavesLight","LeavesDark","Roof","Invisible","FlowerCream","FlowerPink","FlowerBlue","Mint","Foam"}
    mat.set_editor_property("two_sided",True)
    mat.set_editor_property("blend_mode",u.BlendMode.BLEND_MASKED if masked else u.BlendMode.BLEND_OPAQUE)
    base=expr(mat,u.MaterialExpressionVectorParameter,parameter_name="Tint",default_value=u.LinearColor(*color,1))
    if name in {"Grass","Paving","Wood","Roof"}:
        cell={"Grass":(0,0),"Paving":(.5,0),"Wood":(0,.5),"Roof":(.5,.5)}[name]
        # World-space triplanar sampling preserves material scale across differently
        # sized kit pieces and avoids stretching the entire atlas over a house.
        sample=expr(mat,u.MaterialExpressionCustom,output_type=u.CustomMaterialOutputType.CMOT_FLOAT3)
        inputs=[]
        for n in ["Tex","P","N","Tile"]:
            pin=u.CustomInput(); pin.set_editor_property("input_name",n); inputs.append(pin)
        sample.set_editor_property("inputs",inputs)
        sample.set_editor_property("code",f"""
float3 w = pow(abs(N),8); w /= max(dot(w,1.0),0.0001);
float2 o = float2({cell[0]+.012},{cell[1]+.012});
float3 a = Texture2DSample(Tex,TexSampler,frac(P.yz/Tile)*0.476+o).rgb;
float3 b = Texture2DSample(Tex,TexSampler,frac(P.xz/Tile)*0.476+o).rgb;
float3 c = Texture2DSample(Tex,TexSampler,frac(P.xy/Tile)*0.476+o).rgb;
return a*w.x+b*w.y+c*w.z;
""")
        texobj=expr(mat,u.MaterialExpressionTextureObject,texture=texture)
        worldpos=expr(mat,u.MaterialExpressionWorldPosition)
        normal=expr(mat,u.MaterialExpressionPixelNormalWS)
        tile=expr(mat,u.MaterialExpressionScalarParameter,parameter_name="TileSizeCm",default_value={"Grass":240.,"Paving":220.,"Wood":160.,"Roof":200.}[name])
        connect(texobj,sample,"Tex"); connect(worldpos,sample,"P")
        connect(normal,sample,"N"); connect(tile,sample,"Tile")
        property_link(sample,mat,u.MaterialProperty.MP_BASE_COLOR)
    else:
        property_link(base,mat,u.MaterialProperty.MP_BASE_COLOR)
    rough=expr(mat,u.MaterialExpressionScalarParameter,parameter_name="Roughness",default_value=.22 if name in {"Water","Glass"} else .82)
    property_link(rough,mat,u.MaterialProperty.MP_ROUGHNESS)
    motion=expr(mat,u.MaterialExpressionCollectionParameter,collection=mpc,parameter_name="Motion")
    time=expr(mat,u.MaterialExpressionTime)
    pos=expr(mat,u.MaterialExpressionWorldPosition)
    player=expr(mat,u.MaterialExpressionCollectionParameter,collection=mpc,parameter_name="Player")
    if name in {"Leaves","LeavesLight","LeavesDark","Water","Foam"}:
        custom=expr(mat,u.MaterialExpressionCustom,output_type=u.CustomMaterialOutputType.CMOT_FLOAT3)
        inputs=[]
        for n in ["P","T","M"]:
            pin=u.CustomInput(); pin.set_editor_property("input_name",n); inputs.append(pin)
        custom.set_editor_property("inputs",inputs)
        if name in {"Water","Foam"}:
            code="return float3(0,0,(sin(P.y*0.018+T*2.5)+sin(P.x*0.025+T*1.4))*2.0*M);"
        else:
            code="return float3(sin(P.x*0.009+P.y*0.012+T*1.6)*3.0,sin(P.y*0.01+T)*1.8,0)*M;"
        custom.set_editor_property("code",code)
        connect(pos,custom,"P"); connect(time,custom,"T"); connect(motion,custom,"M")
        property_link(custom,mat,u.MaterialProperty.MP_WORLD_POSITION_OFFSET)
    if name in {"Leaves","LeavesLight","LeavesDark","Roof"}:
        cut=expr(mat,u.MaterialExpressionCustom,output_type=u.CustomMaterialOutputType.CMOT_FLOAT1)
        inputs=[]
        for n in ["P","Player"]:
            pin=u.CustomInput(); pin.set_editor_property("input_name",n); inputs.append(pin)
        cut.set_editor_property("inputs",inputs)
        cut.set_editor_property("code","return P.z>Player.z+190 ? smoothstep(140.0,210.0,distance(P.xy,Player.xy)) : 1.0;")
        connect(pos,cut,"P"); connect(player,cut,"Player")
        property_link(cut,mat,u.MaterialProperty.MP_OPACITY_MASK)
    elif name=="Invisible":
        zero=expr(mat,u.MaterialExpressionConstant,r=0.)
        property_link(zero,mat,u.MaterialProperty.MP_OPACITY_MASK)
    elif name=="Foam":
        shimmer=expr(mat,u.MaterialExpressionCustom,output_type=u.CustomMaterialOutputType.CMOT_FLOAT1)
        inputs=[]
        for n in ["P","T","M"]:
            pin=u.CustomInput(); pin.set_editor_property("input_name",n); inputs.append(pin)
        shimmer.set_editor_property("inputs",inputs)
        shimmer.set_editor_property("code","return saturate((sin(P.y*0.075+T*2.0*M)+sin(P.x*0.13+T*0.8*M))*0.6);")
        connect(pos,shimmer,"P"); connect(time,shimmer,"T"); connect(motion,shimmer,"M")
        property_link(shimmer,mat,u.MaterialProperty.MP_OPACITY_MASK)
    if name in {"Water","Foam","Glow"}:
        mul=expr(mat,u.MaterialExpressionMultiply,const_b=1.7 if name=="Glow" else .25)
        connect(base,mul,"A")
        property_link(mul,mat,u.MaterialProperty.MP_EMISSIVE_COLOR)
    MEL.set_material_usage(mat,u.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES)
    MEL.recompile_material(mat)
    EAL.save_loaded_asset(mat)
    return mat


def main():
    texture=import_files()
    mpc=collection()
    for name,color in COLORS.items():
        material(name,color,texture,mpc)
    EAL.save_directory(ART,only_if_is_dirty=False,recursive=True)
    level_sub=u.get_editor_subsystem(u.LevelEditorSubsystem)
    EAL.make_directory("/Game/Maps")
    world=u.EditorLoadingAndSavingUtils.new_blank_map(False)
    if world is None:
        raise RuntimeError("Could not create clean generated map")
    actor_sub=u.get_editor_subsystem(u.EditorActorSubsystem)
    for actor in actor_sub.get_all_level_actors():
        if actor.get_class().get_name()=="PlayerStart":
            actor_sub.destroy_actor(actor)
    start=actor_sub.spawn_actor_from_class(u.PlayerStart,u.Vector(-850,-260,110))
    start.set_actor_label("Town entrance")
    if not u.EditorLoadingAndSavingUtils.save_map(world,"/Game/Maps/VerdantCorner"):
        raise RuntimeError("Could not save clean generated map")
    records=[]
    for path in EAL.list_assets(ART,recursive=True,include_folder=False):
        obj=EAL.load_asset(path)
        if obj is None:
            raise RuntimeError("Unreadable generated asset: "+path)
        record={"path":path,"class":obj.get_class().get_name()}
        if isinstance(obj,u.StaticMesh):
            bounds=obj.get_bounds()
            record["bounds"]=str(bounds)
            if obj.get_num_lods()<1:
                raise RuntimeError("Mesh has no LOD: "+path)
            if obj.get_name()=="Trunk" and (abs(bounds.origin.z-50)>1 or abs(bounds.box_extent.z-50)>1):
                raise RuntimeError("Trunk is not upright: "+str(bounds))
            if obj.get_name()=="Roof" and (abs(bounds.origin.z-25)>1 or abs(bounds.box_extent.z-25)>1):
                raise RuntimeError("Roof is not upright: "+str(bounds))
        records.append(record)
    evidence=ROOT/"output"
    evidence.mkdir(exist_ok=True)
    (evidence/"unreal-import.json").write_text(json.dumps({"engine":u.SystemLibrary.get_engine_version(),"assets":records,"map":"/Game/Maps/VerdantCorner","visual_acceptance":"not performed"},indent=2),encoding="utf-8")
    u.log("VERDANT_IMPORT_SUCCESS: %d assets, saved map"%len(records))


if __name__=="__main__":
    main()
