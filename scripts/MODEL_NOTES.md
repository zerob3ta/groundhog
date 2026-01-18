# Phil 3D Model Analysis Notes

## Model File
`/public/models/Meshy_AI_biped/Meshy_AI_Animation_Idle_11_withSkin.glb`

## Coordinate System (Blender)
- **X**: Left/Right (-67.2 to 67.2), center = 0
- **Y**: Front/Back (-53.7 to 53.7), **negative Y = front of face**
- **Z**: Up/Down (0 to 170), Z=0 is feet, Z=170 is top of head

## Body Part Z Ranges
| Part | Z Range | Notes |
|------|---------|-------|
| Eyes | 136-146 | Middle of head |
| Nose | 120-136 | Below eyes |
| Mouth | 100-118 | Below nose |
| Chin | 100-110 | Bottom of mouth area |
| Neck | 127-136 | Below head |
| Torso | 102-127 | Main body |

## From Claude.AI Analysis (different scale - multiply by 100 for Blender)
- Mouth center: X=0.00, Y=1.097, Z=0.468
- Snout tip: X=0.00, Y=1.195, Z=0.537
- Lower lip: around Y=1.00

## Bones Available
- Hips, LeftUpLeg, LeftLeg, LeftFoot, LeftToeBase
- RightUpLeg, RightLeg, RightFoot, RightToeBase
- Spine, Spine01, Spine02
- LeftShoulder, LeftArm, LeftForeArm, LeftHand
- RightShoulder, RightArm, RightForeArm, RightHand
- neck, Head, head_end, headfront

## Notes
- Model has NO jaw bone - headfront doesn't control mouth
- Mouth is already modeled as OPEN (smiling with teeth showing)
- Morph targets work but need precise vertex selection to look good
- For proper lip sync, would need to manually create shape keys in Blender
- The head bobbing animation works well via Head bone rotation

## What Works
- Head bone rotation for talking animation
- Morph targets export/import correctly
- Audio-driven animation system works

## Future Improvements
- Create proper mouth shape keys manually in Blender
- Or find a model with built-in visemes/mouth shapes
- Or use a 2D mouth overlay that animates
