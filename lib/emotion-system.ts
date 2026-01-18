// Emotion System - Maps Phil's internal state to emotional dimensions
// Used for both prompt engineering and animation selection

import type { SessionState } from './session-state'
import { getSeasonLevel, getEnergyLevel } from './session-state'

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
  const { winter, spring, energy } = state.phil
  const seasonLevel = getSeasonLevel(state)
  const energyLevel = getEnergyLevel(state)

  // Map physical state from energy
  let physicalState: PhysicalState
  if (energy >= 70) {
    physicalState = 'energized'
  } else if (energy >= 40) {
    physicalState = 'normal'
  } else if (energy >= 20) {
    physicalState = 'tired'
  } else {
    physicalState = 'exhausted'
  }

  // Map emotion from season level
  let primary: PrimaryEmotion
  let intensity: EmotionIntensity
  let secondary: PrimaryEmotion | undefined

  switch (seasonLevel) {
    case 'winter_storm':
      // Extreme chaos state
      primary = physicalState === 'exhausted' ? 'depressed' : 'manic'
      intensity = 'overwhelming'
      secondary = 'anxious'
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
      // Unusually positive
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

  // Adjust intensity based on extreme values
  if (winter > 90) {
    intensity = 'overwhelming'
  } else if (winter > 75 && intensity !== 'overwhelming') {
    intensity = 'intense'
  }

  // Spring can moderate intensity
  if (spring > 70 && intensity === 'overwhelming') {
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
