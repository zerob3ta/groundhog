'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useEffect, useRef, useState, useMemo } from 'react'
import * as THREE from 'three'
import { usePhil } from '@/lib/phil-context'
import {
  getAnimationForEmotion,
  getAnimationConfig,
  type AnimationState,
} from '@/lib/animation-mapping'

// Animation file paths
const ANIMATION_PATHS = {
  idle_content: '/models/Meshy_AI_biped/Meshy_AI_Animation_Idle_11_withSkin.glb',
  talk_passionate: '/models/Meshy_AI_biped/Meshy_AI_Animation_Talk_Passionately_withSkin.glb',
}

// Preload main animation files
useGLTF.preload(ANIMATION_PATHS.idle_content)
useGLTF.preload(ANIMATION_PATHS.talk_passionate)

function PhilModel() {
  const { isTalking, emotionalState } = usePhil()
  const group = useRef<THREE.Group>(null)
  const headBoneRef = useRef<THREE.Bone | null>(null)
  const initialHeadRotation = useRef<THREE.Euler | null>(null)

  // Load main animation GLTFs
  const idleGltf = useGLTF(ANIMATION_PATHS.idle_content)
  const talkGltf = useGLTF(ANIMATION_PATHS.talk_passionate)

  // Get animation actions
  const { actions: idleActions } = useAnimations(idleGltf.animations, group)
  const { actions: talkActions } = useAnimations(talkGltf.animations, group)

  // Find head bone after model loads
  useEffect(() => {
    if (idleGltf.scene) {
      idleGltf.scene.traverse((child) => {
        if (child instanceof THREE.Bone && child.name === 'Head') {
          headBoneRef.current = child
          initialHeadRotation.current = child.rotation.clone()
        }
      })
    }
  }, [idleGltf.scene])

  // Switch animations based on talking state
  useEffect(() => {
    const idleAction = idleActions[Object.keys(idleActions)[0]]
    const talkAction = talkActions[Object.keys(talkActions)[0]]

    if (isTalking && talkAction) {
      idleAction?.fadeOut(0.3)
      talkAction.reset().fadeIn(0.3).play()
    } else if (idleAction) {
      talkAction?.fadeOut(0.3)
      idleAction.reset().fadeIn(0.3).play()
    }
  }, [isTalking, idleActions, talkActions])

  // Start idle animation on mount
  useEffect(() => {
    const idleAction = idleActions[Object.keys(idleActions)[0]]
    if (idleAction) {
      idleAction.play()
    }
  }, [idleActions])

  // Log emotional state changes (for debugging)
  useEffect(() => {
    if (emotionalState) {
      console.log(`[Emotion] ${emotionalState.primary} (${emotionalState.intensity}), physical: ${emotionalState.physicalState}`)
    }
  }, [emotionalState])

  // Animate head when talking
  useFrame(() => {
    if (headBoneRef.current && initialHeadRotation.current) {
      if (isTalking) {
        const time = Date.now() * 0.003
        // Natural head movement while speaking
        headBoneRef.current.rotation.x = initialHeadRotation.current.x + Math.sin(time * 2) * 0.08
        headBoneRef.current.rotation.y = initialHeadRotation.current.y + Math.sin(time) * 0.06
        headBoneRef.current.rotation.z = initialHeadRotation.current.z + Math.cos(time * 1.5) * 0.03
      } else {
        headBoneRef.current.rotation.x = initialHeadRotation.current.x
        headBoneRef.current.rotation.y = initialHeadRotation.current.y
        headBoneRef.current.rotation.z = initialHeadRotation.current.z
      }
    }
  })

  return (
    <group ref={group} position={[0, -1.5, -1]} scale={1.1} rotation={[-0.2, 0, 0]}>
      <primitive object={idleGltf.scene} />
    </group>
  )
}

export default function Phil3D() {
  return (
    <div
      className="w-full h-full relative"
      style={{
        backgroundImage: 'url(/burrow-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <Canvas
        camera={{ position: [0, 0.5, 3], fov: 40 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.8} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.2}
          color="#fff5e6"
        />
        <pointLight position={[-3, 2, 2]} intensity={0.4} color="#ffd700" />
        <hemisphereLight args={['#87CEEB', '#3d5a27', 0.5]} />

        {/* Phil */}
        <PhilModel />
      </Canvas>
    </div>
  )
}
