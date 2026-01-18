// Emotion System - Maps Phil's internal state to emotional dimensions
// Used for both prompt engineering and animation selection

import type { SessionState } from './session-state'
import { getSeasonLevel } from './session-state'
import { calculateChaos } from './trait-system'

// ============================================
// EMOTION TYPES
// ============================================

export type PrimaryEmotion =
  | 'content'
  | 'irritated'
  | 'anxious'
  | 'depressed'
  | 'manic'
  | 'hostile'
  | 'melancholic'

export type EmotionIntensity = 'subtle' | 'moderate' | 'intense' | 'overwhelming'

export type PhysicalState = 'energized' | 'normal' | 'tired' | 'exhausted'

export interface EmotionalState {
  primary: PrimaryEmotion
  intensity: EmotionIntensity
  secondary?: PrimaryEmotion // Blended states
  physicalState: PhysicalState
}

// ============================================
// DERIVE EMOTIONAL STATE FROM SESSION
// ============================================

export function deriveEmotionalState(state: SessionState): EmotionalState {
  const { season } = state.phil
  const seasonLevel = getSeasonLevel(state)
  const chaos = calculateChaos(state)
  const isSpring = season > 50 // spring side of the axis

  // Map physical state from chaos level
  // Higher chaos = more unstable physical state
  let physicalState: PhysicalState
  if (chaos > 0.7) {
    // Extreme chaos can go either way
    physicalState = isSpring ? 'energized' : 'exhausted'
  } else if (chaos > 0.4) {
    physicalState = isSpring ? 'energized' : 'tired'
  } else {
    physicalState = 'normal'
  }

  // Map emotion from season level
  let primary: PrimaryEmotion
  let intensity: EmotionIntensity
  let secondary: PrimaryEmotion | undefined

  switch (seasonLevel) {
    case 'winter_storm':
      // Extreme winter chaos state
      primary = physicalState === 'exhausted' ? 'depressed' : 'manic'
      intensity = 'overwhelming'
      secondary = 'anxious'
      break

    case 'spring_storm':
      // Extreme spring chaos state (manic)
      primary = 'manic'
      intensity = 'overwhelming'
      secondary = 'hostile' // Aggressive manic energy
      break

    case 'deep_winter':
      // Heavy existential state
      if (physicalState === 'tired' || physicalState === 'exhausted') {
        primary = 'depressed'
        secondary = 'melancholic'
      } else {
        primary = 'anxious'
        secondary = 'hostile'
      }
      intensity = 'intense'
      break

    case 'winter_approaching':
      // Getting darker
      primary = 'irritated'
      intensity = 'moderate'
      secondary = physicalState === 'energized' ? 'hostile' : 'melancholic'
      break

    case 'spring_dominant':
      // High spring energy
      if (physicalState === 'energized') {
        primary = 'manic'
        intensity = 'moderate'
      } else {
        primary = 'content'
        intensity = 'moderate'
      }
      break

    case 'balanced':
    default:
      // Normal Phil
      if (physicalState === 'exhausted') {
        primary = 'irritated'
        intensity = 'subtle'
      } else if (physicalState === 'tired') {
        primary = 'content'
        intensity = 'subtle'
      } else {
        primary = 'content'
        intensity = 'subtle'
      }
      break
  }

  // Adjust intensity based on extreme season values (single-axis)
  if (season < 10 || season > 90) {
    // Extreme ends of the axis
    intensity = 'overwhelming'
  } else if ((season < 25 || season > 75) && intensity !== 'overwhelming') {
    intensity = 'intense'
  }

  return {
    primary,
    intensity,
    secondary,
    physicalState,
  }
}

// ============================================
// EMOTION DESCRIPTIONS (for UI/debugging)
// ============================================

export function describeEmotionalState(emotion: EmotionalState): string {
  const intensityWords: Record<EmotionIntensity, string> = {
    subtle: 'slightly',
    moderate: 'noticeably',
    intense: 'very',
    overwhelming: 'extremely',
  }

  const emotionWords: Record<PrimaryEmotion, string> = {
    content: 'content',
    irritated: 'irritated',
    anxious: 'anxious',
    depressed: 'depressed',
    manic: 'manic',
    hostile: 'hostile',
    melancholic: 'melancholic',
  }

  let description = `${intensityWords[emotion.intensity]} ${emotionWords[emotion.primary]}`

  if (emotion.secondary) {
    description += ` (with ${emotionWords[emotion.secondary]} undertones)`
  }

  description += `, physically ${emotion.physicalState}`

  return description
}
