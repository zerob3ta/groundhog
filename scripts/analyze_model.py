"""
Analyze the model to understand where the mouth/jaw vertices are
"""

import bpy

INPUT_FILE = "/Users/justinpaterno/groundhog/public/models/Meshy_AI_biped/Meshy_AI_Animation_Idle_11_withSkin.glb"

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

def analyze_model(mesh_obj):
    mesh = mesh_obj.data
    vertices = mesh.vertices

    min_x = min(v.co.x for v in vertices)
    max_x = max(v.co.x for v in vertices)
    min_y = min(v.co.y for v in vertices)
    max_y = max(v.co.y for v in vertices)
    min_z = min(v.co.z for v in vertices)
    max_z = max(v.co.z for v in vertices)

    height = max_z - min_z
    width = max_x - min_x
    depth = max_y - min_y

    print("="*60)
    print("MODEL ANALYSIS")
    print("="*60)
    print(f"Total vertices: {len(vertices)}")
    print(f"X (left/right): {min_x:.1f} to {max_x:.1f} (width: {width:.1f})")
    print(f"Y (front/back): {min_y:.1f} to {max_y:.1f} (depth: {depth:.1f})")
    print(f"Z (up/down):    {min_z:.1f} to {max_z:.1f} (height: {height:.1f})")
    print()

    # Divide the model into vertical sections
    print("VERTICAL SECTIONS (Z slices from bottom to top):")
    print("-"*60)

    num_slices = 20
    slice_height = height / num_slices

    for i in range(num_slices):
        slice_bottom = min_z + (i * slice_height)
        slice_top = slice_bottom + slice_height

        verts_in_slice = [v for v in vertices if slice_bottom <= v.co.z < slice_top]
        count = len(verts_in_slice)

        # What percentage of height is this?
        pct_from_bottom = (i / num_slices) * 100
        pct_from_top = 100 - pct_from_bottom

        # Description based on position
        if pct_from_top <= 10:
            desc = "TOP OF HEAD"
        elif pct_from_top <= 15:
            desc = "UPPER HEAD"
        elif pct_from_top <= 20:
            desc = "HEAD"
        elif pct_from_top <= 25:
            desc = "NECK?"
        elif pct_from_top <= 40:
            desc = "TORSO"
        elif pct_from_top <= 60:
            desc = "BODY"
        else:
            desc = "LOWER"

        if count > 0:
            # Get Y range in this slice (to understand front/back)
            y_vals = [v.co.y for v in verts_in_slice]
            avg_y = sum(y_vals) / len(y_vals)
            print(f"Z {slice_bottom:6.1f}-{slice_top:6.1f} ({pct_from_top:4.0f}% from top): {count:5d} verts, avg Y={avg_y:6.1f} | {desc}")

    print()
    print("="*60)
    print("HEAD REGION DETAIL (top 20% of model)")
    print("="*60)

    head_bottom = max_z - (height * 0.20)
    head_verts = [v for v in vertices if v.co.z > head_bottom]

    if head_verts:
        head_min_z = min(v.co.z for v in head_verts)
        head_max_z = max(v.co.z for v in head_verts)
        head_min_y = min(v.co.y for v in head_verts)
        head_max_y = max(v.co.y for v in head_verts)

        head_height = head_max_z - head_min_z
        head_depth = head_max_y - head_min_y

        print(f"Head Z range: {head_min_z:.1f} to {head_max_z:.1f}")
        print(f"Head Y range: {head_min_y:.1f} to {head_max_y:.1f}")
        print()

        # Divide head into horizontal slices
        print("HEAD Z SLICES (from chin to top):")
        for i in range(10):
            slice_bottom = head_min_z + (i * head_height / 10)
            slice_top = slice_bottom + (head_height / 10)

            verts = [v for v in head_verts if slice_bottom <= v.co.z < slice_top]
            if verts:
                # Check Y distribution - front vs back
                front_verts = [v for v in verts if v.co.y < (head_min_y + head_depth * 0.5)]
                back_verts = [v for v in verts if v.co.y >= (head_min_y + head_depth * 0.5)]

                pct = ((i + 0.5) / 10) * 100
                print(f"  {pct:3.0f}% up head (Z {slice_bottom:.1f}-{slice_top:.1f}): {len(verts):4d} verts, front={len(front_verts)}, back={len(back_verts)}")

        print()
        print("Eyebrows are probably around 70-90% up the head")
        print("Mouth/jaw is probably around 10-30% up the head")
        print("Try targeting Z range:", head_min_z, "to", head_min_z + (head_height * 0.3))

def main():
    clear_scene()
    import_glb(INPUT_FILE)
    mesh_obj = find_mesh_object()
    if mesh_obj:
        analyze_model(mesh_obj)

if __name__ == "__main__":
    main()
