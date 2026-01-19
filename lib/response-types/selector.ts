// Response Type Selector - Algorithm to choose Phil's response type
// Adds variety based on chaos level, recent types, and current state

import type { SessionState } from '../session-state'
import type { MemoryManager } from '../memory'
import {
  ResponseType,
  BitType,
  ActiveBit,
  RESPONSE_TYPE_CONFIGS,
  BIT_CONFIGS,
} from './types'

// ============================================
// WEIGHTED RANDOM SELECTION
// ============================================

function weightedRandom<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][]
  const totalWeight = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0)

  if (totalWeight === 0) {
    // Fallback to first key if all weights are 0
    return entries[0][0]
  }

  let random = Math.random() * totalWeight

  for (const [type, weight] of entries) {
    if (weight <= 0) continue
    random -= weight
    if (random <= 0) return type
  }

  // Fallback
  return entries[0][0]
}

// ============================================
// CONTEXT CHECKS
// ============================================

interface SelectorContext {
  hasRecentMemory: boolean     // Has something worth calling back to
  chatActivityHigh: boolean    // Chat is active (for meta commentary)
  philMood: string            // Current mood
  messagesSinceRant: number   // Messages since last rant
}

// Check if there's recent memory worth calling back to
function checkRecentMemory(memoryManager: MemoryManager | null): boolean {
  if (!memoryManager) return false

  try {
    // Check if there are any notable moments from this session
    const moments = memoryManager.getRecentMoments?.()
    return moments && moments.length > 0
  } catch {
    return false
  }
}

// ============================================
// MOOD-BASED TRIGGERS
// ============================================

type MoodTrigger = 'exhausted' | 'paranoid' | 'manic' | null

function getMoodTrigger(mood: string): MoodTrigger {
  const lowerMood = mood.toLowerCase()

  if (['exhausted', 'tired', 'sleepy', 'drained'].includes(lowerMood)) {
    return 'exhausted'
  }
  if (['paranoid', 'suspicious', 'worried'].includes(lowerMood)) {
    return 'paranoid'
  }
  if (['manic', 'hyped', 'unhinged', 'legendary', 'cocky'].includes(lowerMood)) {
    return 'manic'
  }

  return null
}

// ============================================
// BIT SELECTION
// ============================================

function shouldStartBit(
  state: SessionState,
  recentTypes: ResponseType[],
  chaos: number,
  isWinter: boolean
): boolean {
  // Don't start bits too frequently - need at least 8 responses between bits
  const bitTypeCount = recentTypes.filter(t => t === 'bit_start' || t === 'bit_response').length
  if (bitTypeCount > 0) return false

  // Base chance increases with chaos
  const baseChance = 0.05 + chaos * 0.15  // 5% at 0 chaos, 20% at 100% chaos

  // Random roll
  return Math.random() < baseChance
}

function selectBitType(
  state: SessionState,
  chaos: number,
  isWinter: boolean
): BitType | null {
  const moodTrigger = getMoodTrigger(state.phil.mood)

  // Build weighted pool of available bits
  const weights: Partial<Record<BitType, number>> = {}

  for (const [bitType, config] of Object.entries(BIT_CONFIGS)) {
    const bit = bitType as BitType
    let weight = 10  // Base weight

    // Check chaos requirement
    if (config.chaosRequirement && chaos < config.chaosRequirement) {
      weight = 0
      continue
    }

    // Check flavor requirement
    if (config.flavorRequirement) {
      if (config.flavorRequirement === 'winter' && !isWinter) {
        weight = 0
        continue
      }
      if (config.flavorRequirement === 'spring' && isWinter) {
        weight = 0
        continue
      }
    }

    // Boost for matching triggers
    for (const trigger of config.triggers) {
      if (trigger === 'random') {
        weight += 5
      }
      if (trigger === 'winter_chaos' && isWinter && chaos > 0.4) {
        weight += 15
      }
      if (trigger === 'spring_chaos' && !isWinter && chaos > 0.4) {
        weight += 15
      }
      if (trigger === 'exhausted' && moodTrigger === 'exhausted') {
        weight += 20
      }
      if (trigger === 'paranoid' && moodTrigger === 'paranoid') {
        weight += 20
      }
      if (trigger === 'manic' && moodTrigger === 'manic') {
        weight += 20
      }
    }

    weights[bit] = weight
  }

  // Filter out zero-weight options
  const validWeights = Object.fromEntries(
    Object.entries(weights).filter(([, w]) => w > 0)
  ) as Record<BitType, number>

  if (Object.keys(validWeights).length === 0) {
    return null
  }

  return weightedRandom(validWeights)
}

// ============================================
// MAIN SELECTOR
// ============================================

export interface SelectResponseTypeResult {
  responseType: ResponseType
  bitType?: BitType        // If responseType is 'bit_start', which bit to start
  debug: {
    chaos: number
    flavor: 'winter' | 'spring'
    weights: Record<ResponseType, number>
  }
}

export async function selectResponseType(
  state: SessionState,
  recentTypes: ResponseType[],
  activeBit: ActiveBit | null,
  context: Partial<SelectorContext> = {},
  memoryManager: MemoryManager | null = null
): Promise<SelectResponseTypeResult> {
  const chaos = Math.abs(state.phil.season - 50) / 50
  const isWinter = state.phil.season < 50
  const flavor: 'winter' | 'spring' = isWinter ? 'winter' : 'spring'

  // If bit is active, that takes priority
  if (activeBit && activeBit.messagesRemaining > 0) {
    return {
      responseType: 'bit_response',
      debug: {
        chaos,
        flavor,
        weights: { bit_response: 100 } as Record<ResponseType, number>,
      },
    }
  }

  // Check context
  const hasRecentMemory = context.hasRecentMemory ?? checkRecentMemory(memoryManager)
  const chatActivityHigh = context.chatActivityHigh ?? false

  // Build weighted pool based on conditions
  const weights: Record<ResponseType, number> = {
    roast: 50,          // Still the default
    hot_take: 5,
    story: 3,
    conspiracy: 2,
    callback: 0,
    meta: 2,
    bit_response: 0,    // Only when bit is active
    bit_start: 0,       // Calculated below
  }

  // Apply chaos influence to each type
  for (const [type, config] of Object.entries(RESPONSE_TYPE_CONFIGS)) {
    const responseType = type as ResponseType
    if (responseType === 'bit_response') continue

    const { chaosInfluence } = config
    let adjustment = chaosInfluence.chaosMultiplier * chaos

    // Apply flavor bonus
    if (chaosInfluence.flavorBonus === flavor) {
      adjustment += 10 * chaos
    }

    weights[responseType] = Math.max(0, chaosInfluence.baseWeight + adjustment)
  }

  // Callback requires recent memory
  if (hasRecentMemory) {
    weights.callback = 10 + chaos * 15
  }

  // Meta commentary more likely during high chat activity
  if (chatActivityHigh) {
    weights.meta = (weights.meta || 0) + 8
  }

  // Conspiracy much more likely in winter chaos
  if (isWinter && chaos > 0.3) {
    weights.conspiracy = (weights.conspiracy || 0) + 15
  }

  // Check if we should start a bit
  if (shouldStartBit(state, recentTypes, chaos, isWinter)) {
    const bitType = selectBitType(state, chaos, isWinter)
    if (bitType) {
      weights.bit_start = 15 + chaos * 15
    }
  }

  // Anti-repetition: reduce weight if used in last 3 responses
  const recentSlice = recentTypes.slice(-3)
  for (const type of recentSlice) {
    if (type in weights) {
      weights[type] *= 0.3
    }
  }

  // Ensure we don't pick the same type twice in a row (except roast)
  const lastType = recentTypes[recentTypes.length - 1]
  if (lastType && lastType !== 'roast') {
    weights[lastType] = 0
  }

  // Select response type
  const responseType = weightedRandom(weights)

  // If starting a bit, select which one
  let selectedBitType: BitType | undefined
  if (responseType === 'bit_start') {
    selectedBitType = selectBitType(state, chaos, isWinter) || undefined
    // If we couldn't select a bit, fall back to roast
    if (!selectedBitType) {
      return {
        responseType: 'roast',
        debug: { chaos, flavor, weights },
      }
    }
  }

  return {
    responseType,
    bitType: selectedBitType,
    debug: { chaos, flavor, weights },
  }
}

// ============================================
// CHAOS LEVEL HELPERS
// ============================================

export type ChaosLevel = 'low' | 'medium' | 'high' | 'extreme'

export function getChaosLevel(chaos: number): ChaosLevel {
  if (chaos >= 0.6) return 'extreme'
  if (chaos >= 0.4) return 'high'
  if (chaos >= 0.2) return 'medium'
  return 'low'
}

// What response types are available at each chaos level
export function getAvailableResponseTypes(chaos: number): ResponseType[] {
  const level = getChaosLevel(chaos)

  switch (level) {
    case 'low':
      return ['roast', 'meta']
    case 'medium':
      return ['roast', 'hot_take', 'callback', 'meta']
    case 'high':
      return ['roast', 'hot_take', 'story', 'callback', 'meta', 'conspiracy']
    case 'extreme':
      return ['roast', 'hot_take', 'story', 'conspiracy', 'callback', 'meta', 'bit_start']
  }
}
