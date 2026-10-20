import bpy, pathlib, json, hashlib, math
out=pathlib.Path(__file__).resolve().parent
manifest=json.loads((out/'manifest.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
checked=[]
for entry in manifest['models']:
    for item in [entry]+([entry['lod']] if 'lod' in entry else []):
        file=out/item['file']; data=file.read_bytes()
        assert hashlib.sha256(data).hexdigest()==item['sha256'],file.name+' hash'
        result=bpy.ops.import_scene.gltf(filepath=str(file),import_pack_images=False)
        assert 'FINISHED' in result,file.name+' import'
        objs=[o for o in bpy.context.scene.objects if o.type=='MESH']
        assert len(objs)==1,file.name+' mesh count'
        obj=objs[0]; mesh=obj.data; mesh.calc_loop_triangles()
        assert len(mesh.loop_triangles)==item['triangles'],file.name+' triangles'
        assert len(mesh.color_attributes)>0,file.name+' vertex colors'
        assert len(mesh.materials)==1,file.name+' single material'
        assert all(math.isfinite(c) for v in mesh.vertices for c in v.co),file.name+' non-finite'
        # Blender's importer converts +Y-up glTF to +Z-up.
        size=[item['max'][i]-item['min'][i] for i in range(3)]
        for a,b in zip(obj.dimensions,[size[0],size[2],size[1]]): assert abs(a-b)<.0001,(file.name,'dimensions',a,b)
        checked.append({'file':file.name,'triangles':len(mesh.loop_triangles),'vertices':len(mesh.vertices),'imported':True})
        for o in list(bpy.context.scene.objects): bpy.data.objects.remove(o,do_unlink=True)
        bpy.data.meshes.remove(mesh)
report={'blender':bpy.app.version_string,'files':len(checked),'checks':['SHA256','GLB import','triangle counts','vertex colors','single material','finite positions','dimensions'],'results':checked,
    'boundary':'Static Blender GLB import; does not establish browser rendering or runtime frame rate.'}
(out/'glb-import-check.json').write_text(json.dumps(report,indent=2)+'\n')
print('GLB_IMPORT_CHECK_PASS',len(checked))
