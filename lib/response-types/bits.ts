// Bit Management - Start, check, and end bits (temporary personality shifts)

import type { ActiveBit, BitType, BitConfig } from './types'
import { BIT_CONFIGS } from './types'
import { logStateChange } from '../session-state'

// ============================================
// BIT LIFECYCLE
// ============================================

/**
 * Start a new bit - creates the ActiveBit state
 */
export function startBit(bitType: BitType): ActiveBit {
  const config = BIT_CONFIGS[bitType]
  const [minMessages, maxMessages] = config.duration.messages
  const totalMessages = minMessages + Math.floor(Math.random() * (maxMessages - minMessages + 1))

  logStateChange('Bit', `Starting ${config.name}`, {
    type: bitType,
    duration: `${totalMessages} messages`,
  })

  return {
    type: bitType,
    startedAt: Date.now(),
    messagesRemaining: totalMessages,
    totalMessages,
    announcedStart: true,  // The start message counts as announcement
    announcedEnd: false,
  }
}

/**
 * Process a bit response - decrements remaining messages
 * Returns null if bit should end, updated bit otherwise
 */
export function processBitResponse(activeBit: ActiveBit): ActiveBit | null {
  const newRemaining = activeBit.messagesRemaining - 1

  if (newRemaining <= 0) {
    logStateChange('Bit', `Ending ${BIT_CONFIGS[activeBit.type].name}`, {
      type: activeBit.type,
      totalMessages: activeBit.totalMessages,
    })
    return null
  }

  return {
    ...activeBit,
    messagesRemaining: newRemaining,
  }
}

/**
 * Check if the current bit message is the last one
 */
export function isLastBitMessage(activeBit: ActiveBit): boolean {
  return activeBit.messagesRemaining === 1
}

/**
 * Force end a bit (e.g., if something dramatic happens)
 */
export function endBit(activeBit: ActiveBit): null {
  logStateChange('Bit', `Force ending ${BIT_CONFIGS[activeBit.type].name}`, {
    type: activeBit.type,
    messagesRemaining: activeBit.messagesRemaining,
  })
  return null
}

// ============================================
// BIT INFO HELPERS
// ============================================

/**
 * Get the config for a bit type
 */
export function getBitConfig(bitType: BitType): BitConfig {
  return BIT_CONFIGS[bitType]
}

/**
 * Get a display name for a bit
 */
export function getBitName(bitType: BitType): string {
  return BIT_CONFIGS[bitType].name
}

/**
 * Get how far into a bit we are (0-1)
 */
export function getBitProgress(activeBit: ActiveBit): number {
  const used = activeBit.totalMessages - activeBit.messagesRemaining
  return used / activeBit.totalMessages
}

/**
 * Check if a bit is in its "struggle" phase (past 50%)
 */
export function isInStrugglePhase(activeBit: ActiveBit): boolean {
  return getBitProgress(activeBit) >= 0.5
}

// ============================================
// BIT STATE SERIALIZATION
// ============================================

/**
 * Serialize active bit for storage
 */
export function serializeActiveBit(activeBit: ActiveBit | null): string | null {
  if (!activeBit) return null
  return JSON.stringify(activeBit)
}

/**
 * Deserialize active bit from storage
 */
export function deserializeActiveBit(json: string | null): ActiveBit | null {
  if (!json) return null
  try {
    return JSON.parse(json) as ActiveBit
  } catch {
    return null
  }
}

// ============================================
// BIT ELIGIBILITY
// ============================================

/**
 * Check if a specific bit type is available given current conditions
 */
export function isBitEligible(
  bitType: BitType,
  chaos: number,
  isWinter: boolean
): boolean {
  const config = BIT_CONFIGS[bitType]

  // Check chaos requirement
  if (config.chaosRequirement && chaos < config.chaosRequirement) {
    return false
  }

  // Check flavor requirement
  if (config.flavorRequirement) {
    if (config.flavorRequirement === 'winter' && !isWinter) {
      return false
    }
    if (config.flavorRequirement === 'spring' && isWinter) {
      return false
    }
  }

  return true
}

/**
 * Get all eligible bits for current conditions
 */
export function getEligibleBits(chaos: number, isWinter: boolean): BitType[] {
  return (Object.keys(BIT_CONFIGS) as BitType[]).filter(
    bitType => isBitEligible(bitType, chaos, isWinter)
  )
}
