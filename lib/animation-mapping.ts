// Animation Mapping - Maps emotional states to Phil's animations
// Used by Phil3D component to select appropriate animations

import type { EmotionalState, PrimaryEmotion, PhysicalState } from './emotion-system'

// ============================================
// ANIMATION STATE TYPES
// ============================================

export type AnimationState =
  | 'idle_content'
  | 'idle_irritated'
  | 'idle_anxious'
  | 'idle_depressed'
  | 'idle_manic'
  | 'idle_exhausted'
  | 'talk_normal'
  | 'talk_passionate'
  | 'talk_tired'

// ============================================
// ANIMATION FILE MAPPINGS
// ============================================

const BASE_PATH = '/models/Meshy_AI_biped'

export interface AnimationConfig {
  file: string
  speed?: number // Playback speed multiplier (default 1.0)
}

export const ANIMATION_FILES: Record<AnimationState, AnimationConfig> = {
  // Idle animations based on emotion
  idle_content: {
    file: `${BASE_PATH}/Meshy_AI_Animation_Idle_11_withSkin.glb`,
    speed: 1.0,
  },
  idle_irritated: {
    file: `${BASE_PATH}/Meshy_AI_Animation_Shrug_withSkin.glb`,
    speed: 0.7,
  },
  idle_anxious: {
    file: `${BASE_PATH}/Meshy_AI_Animation_Look_Around_Dumbfounded_withSkin.glb`,
    speed: 1.0,
  },
  idle_depressed: {
    file: `${BASE_PATH}/Meshy_AI_Animation_Sit_and_Doze_Off_withSkin.glb`,
    speed: 0.5,
  },
  idle_manic: {
    file: `${BASE_PATH}/Meshy_AI_Animation_Hip_Hop_Dance_2_withSkin.glb`,
    speed: 0.6,
  },
  idle_exhausted: {
    file: `${BASE_PATH}/Meshy_AI_Animation_Sleep_Normally_withSkin.glb`,
    speed: 0.3,
  },

  // Talking animations
  talk_normal: {
    file: `${BASE_PATH}/Meshy_AI_Animation_Stand_and_Chat_withSkin.glb`,
    speed: 1.0,
  },
  talk_passionate: {
    file: `${BASE_PATH}/Meshy_AI_Animation_Talk_Passionately_withSkin.glb`,
    speed: 1.0,
  },
  talk_tired: {
    file: `${BASE_PATH}/Meshy_AI_Animation_Talk_with_Right_Hand_Open_withSkin.glb`,
    speed: 0.7,
  },
}

// ============================================
// GET ANIMATION FOR EMOTIONAL STATE
// ============================================

export function getAnimationForEmotion(
  emotion: EmotionalState,
  isTalking: boolean
): AnimationState {
  // Handle talking states first
  if (isTalking) {
    return getTalkingAnimation(emotion)
  }

  // Handle idle states
  return getIdleAnimation(emotion)
}

function getTalkingAnimation(emotion: EmotionalState): AnimationState {
  const { physicalState, primary, intensity } = emotion

  // Exhausted/tired = tired talking animation
  if (physicalState === 'exhausted' || physicalState === 'tired') {
    return 'talk_tired'
  }

  // Manic or overwhelming intensity = passionate talking
  if (primary === 'manic' || intensity === 'overwhelming') {
    return 'talk_passionate'
  }

  // Hostile or intense emotions = passionate talking
  if (primary === 'hostile' && intensity === 'intense') {
    return 'talk_passionate'
  }

  // Default talking
  return 'talk_normal'
}

function getIdleAnimation(emotion: EmotionalState): AnimationState {
  const { primary, physicalState, intensity } = emotion

  // Physical exhaustion overrides emotion
  if (physicalState === 'exhausted') {
    return 'idle_exhausted'
  }

  // Map primary emotion to idle animation
  switch (primary) {
    case 'manic':
      return 'idle_manic'

    case 'anxious':
      return 'idle_anxious'

    case 'depressed':
    case 'melancholic':
      return physicalState === 'tired' ? 'idle_exhausted' : 'idle_depressed'

    case 'irritated':
    case 'hostile':
      return 'idle_irritated'

    case 'content':
    default:
      return 'idle_content'
  }
}

// ============================================
// GET ALL ANIMATION PATHS FOR PRELOADING
// ============================================

export function getAllAnimationPaths(): string[] {
  return Object.values(ANIMATION_FILES).map((config) => config.file)
}

// ============================================
// GET ANIMATION CONFIG
// ============================================

export function getAnimationConfig(state: AnimationState): AnimationConfig {
  return ANIMATION_FILES[state]
}
