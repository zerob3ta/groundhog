// Shock System - Random events that shift Phil's state
// Shocks happen every ~5 minutes with varying severity
// Phil doesn't know shocks exist - he just reacts to the vibes

import type { SessionState } from './session-state'
import { logStateChange } from './session-state'

// ============================================
// SHOCK DEFINITIONS
// ============================================

export type ShockEffect = {
  chaos: number      // Positive = more chaos, negative = order
  winter?: number    // Positive = toward winter flavor
  spring?: number    // Positive = toward spring flavor
}

export interface Shock {
  name: string
  description: string  // For logging/debugging
  effect: ShockEffect
}

// All possible shocks - mixed effects
export const SHOCK_POOL: Shock[] = [
  // CHAOS UP shocks
  {
    name: 'technical_difficulties',
    description: 'Stream glitches, something feels off',
    effect: { chaos: 1, winter: 0.5 },
  },
  {
    name: 'troll_raid',
    description: 'Wave of trolls incoming',
    effect: { chaos: 1, winter: 0.7 },
  },
  {
    name: 'existential_dread',
    description: '147 years hits different right now',
    effect: { chaos: 1, winter: 1 },
  },
  {
    name: 'dead_chat_moment',
    description: 'Everyone went quiet. Too quiet.',
    effect: { chaos: 0.8, winter: 0.8 },
  },
  {
    name: 'time_confusion',
    description: 'Wait what year is it again?',
    effect: { chaos: 0.7, winter: 0.6 },
  },
  {
    name: 'chuck_mentioned',
    description: 'Someone brought up Staten Island Chuck',
    effect: { chaos: 0.8, spring: 0.9 },  // Fight mode!
  },
  {
    name: 'celebrity_pressure',
    description: 'A famous person might be watching',
    effect: { chaos: 0.6, spring: 0.5 },
  },
  {
    name: 'weird_message',
    description: 'Someone said something deeply unsettling',
    effect: { chaos: 0.5, winter: 0.3 },
  },
  {
    name: 'hype_explosion',
    description: 'Chat suddenly goes crazy',
    effect: { chaos: 0.6, spring: 1 },
  },
  {
    name: 'manic_energy',
    description: 'Something clicked and you\'re WIRED',
    effect: { chaos: 0.7, spring: 0.8 },
  },

  // ORDER (chaos down) shocks
  {
    name: 'viewer_milestone',
    description: 'Hit a nice viewer number',
    effect: { chaos: -0.5, spring: 0.3 },
  },
  {
    name: 'perfect_roast',
    description: 'You just landed the perfect roast',
    effect: { chaos: -0.6, spring: 0.4 },
  },
  {
    name: 'wholesome_moment',
    description: 'Something genuine happened',
    effect: { chaos: -0.7 },
  },
  {
    name: 'inner_circle_energy',
    description: 'Feeling connected to the handlers',
    effect: { chaos: -0.5 },
  },
  {
    name: 'lore_deep_cut',
    description: 'Someone knew real Phil history',
    effect: { chaos: -0.6, spring: 0.2 },
  },
  {
    name: 'good_conversation',
    description: 'Actually having a real moment with chat',
    effect: { chaos: -0.8 },
  },
  {
    name: 'enemy_defeated',
    description: 'A hater left or admitted defeat',
    effect: { chaos: -0.4, spring: 0.5 },
  },

  // WINTER flavor shocks (can be chaos up or down)
  {
    name: 'mortality_reminder',
    description: 'Someone mentioned death or age',
    effect: { chaos: 0.5, winter: 1 },
  },
  {
    name: 'forgotten_feeling',
    description: 'Nobody cares about Groundhog Day anymore vibes',
    effect: { chaos: 0.6, winter: 0.9 },
  },
  {
    name: 'betrayal',
    description: 'Someone you liked said something mean',
    effect: { chaos: 0.4, winter: 0.7 },
  },
  {
    name: 'late_night_vibes',
    description: 'Stream has gone on too long, empty feeling',
    effect: { chaos: 0.3, winter: 0.8 },
  },
  {
    name: 'bad_news',
    description: 'Something sad happened in the world',
    effect: { chaos: 0.4, winter: 0.6 },
  },

  // SPRING flavor shocks
  {
    name: 'ego_boost',
    description: 'Major compliment or recognition',
    effect: { chaos: -0.3, spring: 0.8 },
  },
  {
    name: 'rivalry_activated',
    description: 'Competition mode engaged',
    effect: { chaos: 0.5, spring: 0.9 },
  },
  {
    name: 'viral_moment_energy',
    description: 'Something shareable just happened',
    effect: { chaos: 0.4, spring: 0.7 },
  },
  {
    name: 'scheming_mood',
    description: 'Plotting something',
    effect: { chaos: 0.3, spring: 0.6 },
  },
  {
    name: 'legacy_thoughts',
    description: 'Thinking about your empire',
    effect: { chaos: 0.2, spring: 0.7 },
  },

  // NEUTRAL/MIXED shocks
  {
    name: 'groundhog_news',
    description: 'Breaking news about groundhogs',
    effect: { chaos: 0.6 },  // Flavor determined by severity roll
  },
  {
    name: 'random_memory',
    description: 'Suddenly remembering something from 1952',
    effect: { chaos: 0.4 },
  },
  {
    name: 'vibe_shift',
    description: 'Something in the air changed',
    effect: { chaos: 0.3 },
  },
]

// ============================================
// SEVERITY SYSTEM
// ============================================

export type ShockSeverity = 'mild' | 'moderate' | 'severe'

export interface SeverityMultiplier {
  chaos: number
  flavor: number
  probability: number
}

export const SEVERITY_CONFIG: Record<ShockSeverity, SeverityMultiplier> = {
  mild: {
    chaos: 0.4,     // 40% of base effect
    flavor: 0.3,    // 30% of flavor shift
    probability: 0.50,  // 50% chance
  },
  moderate: {
    chaos: 0.7,     // 70% of base effect
    flavor: 0.6,    // 60% of flavor shift
    probability: 0.35,  // 35% chance
  },
  severe: {
    chaos: 1.0,     // Full effect
    flavor: 1.0,    // Full flavor shift
    probability: 0.15,  // 15% chance
  },
}

// Roll for severity
export function rollSeverity(): ShockSeverity {
  const roll = Math.random()
  if (roll < SEVERITY_CONFIG.severe.probability) {
    return 'severe'
  } else if (roll < SEVERITY_CONFIG.severe.probability + SEVERITY_CONFIG.moderate.probability) {
    return 'moderate'
  }
  return 'mild'
}

// ============================================
// SHOCK TIMING
// ============================================

// How often shocks occur (in milliseconds)
export const SHOCK_INTERVAL_MS = 5 * 60 * 1000  // 5 minutes

// Track last shock time in session state
export interface ShockState {
  lastShockAt: number
  shocksThisSession: number
  lastShock?: {
    name: string
    severity: ShockSeverity
    timestamp: number
  }
}

// Check if it's time for a shock
export function shouldTriggerShock(state: SessionState): boolean {
  const now = Date.now()
  const lastShock = state.shockState?.lastShockAt ?? state.session.startTime
  const timeSinceLastShock = now - lastShock

  return timeSinceLastShock >= SHOCK_INTERVAL_MS
}

// ============================================
// APPLY SHOCK
// ============================================

export interface ShockResult {
  shock: Shock
  severity: ShockSeverity
  chaosChange: number
  winterChange: number
  springChange: number
}

// Pick and apply a random shock
export function triggerShock(state: SessionState): { newState: SessionState; result: ShockResult } {
  // Pick random shock
  const shock = SHOCK_POOL[Math.floor(Math.random() * SHOCK_POOL.length)]

  // Roll severity
  const severity = rollSeverity()
  const multiplier = SEVERITY_CONFIG[severity]

  // Calculate actual changes based on severity
  // Base values: mild ~10-15, moderate ~20-30, severe ~40-50
  const baseChaosMagnitude = 25  // This gets multiplied by effect and severity
  const baseFlavorMagnitude = 20

  const chaosChange = Math.round(shock.effect.chaos * baseChaosMagnitude * multiplier.chaos)
  const winterChange = Math.round((shock.effect.winter ?? 0) * baseFlavorMagnitude * multiplier.flavor)
  const springChange = Math.round((shock.effect.spring ?? 0) * baseFlavorMagnitude * multiplier.flavor)

  // Apply to state
  const newWinter = Math.max(0, Math.min(100, state.phil.winter + winterChange))
  const newSpring = Math.max(0, Math.min(100, state.phil.spring + springChange))

  // Chaos affects both - pushing away from 50 or toward 50
  let adjustedWinter = newWinter
  let adjustedSpring = newSpring

  if (chaosChange > 0) {
    // Increase chaos = push away from 50
    if (adjustedWinter > 50) adjustedWinter = Math.min(100, adjustedWinter + chaosChange / 2)
    else adjustedWinter = Math.max(0, adjustedWinter - chaosChange / 2)

    if (adjustedSpring > 50) adjustedSpring = Math.min(100, adjustedSpring + chaosChange / 2)
    else adjustedSpring = Math.max(0, adjustedSpring - chaosChange / 2)
  } else {
    // Decrease chaos (order) = push toward 50
    const orderAmount = Math.abs(chaosChange)
    if (adjustedWinter > 50) adjustedWinter = Math.max(50, adjustedWinter - orderAmount / 2)
    else adjustedWinter = Math.min(50, adjustedWinter + orderAmount / 2)

    if (adjustedSpring > 50) adjustedSpring = Math.max(50, adjustedSpring - orderAmount / 2)
    else adjustedSpring = Math.min(50, adjustedSpring + orderAmount / 2)
  }

  // Log the shock
  logStateChange('Shock', `${severity.toUpperCase()}: ${shock.name}`, {
    chaos: chaosChange > 0 ? `+${chaosChange}` : chaosChange,
    winter: `${state.phil.winter} -> ${Math.round(adjustedWinter)}`,
    spring: `${state.phil.spring} -> ${Math.round(adjustedSpring)}`,
    description: shock.description,
  })

  const newState: SessionState = {
    ...state,
    phil: {
      ...state.phil,
      winter: Math.round(adjustedWinter),
      spring: Math.round(adjustedSpring),
    },
    shockState: {
      lastShockAt: Date.now(),
      shocksThisSession: (state.shockState?.shocksThisSession ?? 0) + 1,
      lastShock: {
        name: shock.name,
        severity,
        timestamp: Date.now(),
      },
    },
  }

  return {
    newState,
    result: {
      shock,
      severity,
      chaosChange,
      winterChange,
      springChange,
    },
  }
}

// ============================================
// SHOCK CHECK (call this periodically)
// ============================================

export function checkAndApplyShock(state: SessionState): SessionState {
  if (shouldTriggerShock(state)) {
    const { newState } = triggerShock(state)
    return newState
  }
  return state
}

// Get time until next shock (for UI/debugging)
export function getTimeUntilNextShock(state: SessionState): number {
  const lastShock = state.shockState?.lastShockAt ?? state.session.startTime
  const elapsed = Date.now() - lastShock
  return Math.max(0, SHOCK_INTERVAL_MS - elapsed)
}

// Format time for display
export function formatTimeUntilShock(state: SessionState): string {
  const ms = getTimeUntilNextShock(state)
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${remainingSeconds}s`
}
