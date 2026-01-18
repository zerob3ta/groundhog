"""
Blender script - Target just the lower chin/jaw for subtle mouth movement
Phil's mouth is already open - we just move the chin down slightly
"""

import bpy

INPUT_FILE = "/Users/justinpaterno/groundhog/public/models/Meshy_AI_biped/Meshy_AI_Animation_Idle_11_withSkin.glb"
OUTPUT_FILE = "/Users/justinpaterno/groundhog/public/models/Meshy_AI_biped/Phil_with_mouthshape.glb"

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

def import_glb(filepath):
    bpy.ops.import_scene.gltf(filepath=filepath)

def find_mesh_object():
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            return obj
    return None

def add_jaw_shapekey(mesh_obj):
    bpy.context.view_layer.objects.active = mesh_obj
    mesh_obj.select_set(True)

    if mesh_obj.data.shape_keys is None:
        bpy.ops.object.shape_key_add(from_mix=False)
        mesh_obj.data.shape_keys.key_blocks[0].name = "Basis"

    bpy.ops.object.shape_key_add(from_mix=False)
    shape_key = mesh_obj.data.shape_keys.key_blocks[-1]
    shape_key.name = "MouthOpen"

    mesh = mesh_obj.data
    vertices = mesh.vertices
    shape_key_data = shape_key.data

    min_x = min(v.co.x for v in vertices)
    max_x = max(v.co.x for v in vertices)
    width = max_x - min_x
    center_x = (min_x + max_x) / 2

    # Mouth region is Z 100-118
    # Lower chin/jaw is the BOTTOM of that - Z 100-108
    chin_min_z = 100.0
    chin_max_z = 110.0

    # Front of face (negative Y)
    front_y_threshold = -15

    print(f"Targeting CHIN: Z {chin_min_z} to {chin_max_z}, Y < {front_y_threshold}")

    modified = 0

    for i, vert in enumerate(vertices):
        # In chin region (bottom of mouth area)
        if chin_min_z < vert.co.z < chin_max_z:
            # Front of face
            if vert.co.y < front_y_threshold:
                # Center area (narrow)
                if abs(vert.co.x - center_x) < (width * 0.12):
                    # Calculate how much to move based on position
                    # Bottom of chin moves more, top moves less (gradient)
                    z_ratio = (vert.co.z - chin_min_z) / (chin_max_z - chin_min_z)
                    move_amount = 2.5 * (1.0 - z_ratio)  # More at bottom, less at top

                    shape_key_data[i].co.z = vert.co.z - move_amount
                    shape_key_data[i].co.y = vert.co.y - 0.3  # Slight forward
                    modified += 1

    print(f"Modified {modified} chin vertices")

def export_glb(filepath):
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        export_animations=True,
        export_skins=True,
        export_morph=True,
        export_morph_normal=True,
    )
    print(f"Exported: {filepath}")

def main():
    print("="*50)
    print("Creating subtle chin movement morph")
    print("="*50)
    clear_scene()
    import_glb(INPUT_FILE)
    mesh_obj = find_mesh_object()
    if mesh_obj:
        add_jaw_shapekey(mesh_obj)
        export_glb(OUTPUT_FILE)
    print("Done!")

if __name__ == "__main__":
    main()
