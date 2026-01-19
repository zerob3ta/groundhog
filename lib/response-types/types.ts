// Response Types - Type definitions for Phil's varied response system
// Enables variety beyond roasts: stories, hot takes, conspiracy drops, callbacks, meta commentary, and bits

// ============================================
// RESPONSE TYPES
// ============================================

export type ResponseType =
  | 'roast'           // Default - Phil's classic roasting behavior
  | 'hot_take'        // Short, punchy controversial opinions
  | 'story'           // Brief anecdotes from Phil's 147 years
  | 'conspiracy'      // Mysterious, cryptic theories
  | 'callback'        // Referencing earlier chat moments
  | 'meta'            // Commentary on the stream/chat vibe
  | 'bit_response'    // Response while a bit is active
  | 'bit_start'       // Starting a new bit

// ============================================
// BIT TYPES - Temporary personality shifts
// ============================================

export type BitType =
  | 'nice_mode'       // Forced positivity, gets harder to maintain
  | 'one_word'        // Only one-word answers
  | 'conspiracy_brain' // Everything connects to a conspiracy
  | 'historian'       // Everything relates to the past
  | 'confessional'    // Oversharing, vulnerable
  | 'hype_man'        // Aggressively positive about everything
  | 'contrarian'      // Disagrees with everything

// Bit configuration - how each bit behaves
export interface BitConfig {
  type: BitType
  name: string           // Display name for announcements
  duration: {
    messages: [number, number]  // [min, max] messages before ending
  }
  triggers: BitTrigger[] // What can trigger this bit
  chaosRequirement?: number  // Minimum chaos level (0-1)
  flavorRequirement?: 'winter' | 'spring' | null  // Season flavor requirement
}

export type BitTrigger =
  | 'random'           // Can trigger randomly
  | 'winter_chaos'     // High winter chaos
  | 'spring_chaos'     // High spring chaos
  | 'exhausted'        // Phil is tired/drained
  | 'paranoid'         // Phil is suspicious/paranoid
  | 'manic'            // Phil is hyped/manic

// Active bit tracking
export interface ActiveBit {
  type: BitType
  startedAt: number
  messagesRemaining: number   // Messages until bit ends
  totalMessages: number       // Total messages this bit should last
  announcedStart: boolean     // Did Phil announce the bit?
  announcedEnd: boolean       // Did Phil announce the end?
}

// ============================================
// RESPONSE TYPE CONFIGURATIONS
// ============================================

export interface ResponseTypeConfig {
  type: ResponseType
  lengthRange: [number, number]  // [min, max] sentence count
  chaosInfluence: {
    baseWeight: number         // Weight at 0% chaos
    chaosMultiplier: number    // How much chaos increases weight
    flavorBonus?: 'winter' | 'spring'  // Extra weight for specific flavor
  }
}

// ============================================
// SELECTOR STATE
// ============================================

export interface ResponseSelectorState {
  recentResponseTypes: ResponseType[]  // Last N response types used
  activeBit: ActiveBit | null          // Currently active bit
}

// ============================================
// BIT CONFIGURATIONS
// ============================================

export const BIT_CONFIGS: Record<BitType, BitConfig> = {
  nice_mode: {
    type: 'nice_mode',
    name: 'Nice Mode',
    duration: { messages: [3, 5] },
    triggers: ['random', 'spring_chaos'],
    flavorRequirement: null,
  },
  one_word: {
    type: 'one_word',
    name: 'One Word Mode',
    duration: { messages: [3, 5] },
    triggers: ['random', 'exhausted'],
    flavorRequirement: null,
  },
  conspiracy_brain: {
    type: 'conspiracy_brain',
    name: 'Conspiracy Brain',
    duration: { messages: [5, 8] },
    triggers: ['winter_chaos', 'paranoid'],
    chaosRequirement: 0.3,
    flavorRequirement: 'winter',
  },
  historian: {
    type: 'historian',
    name: 'Historian Mode',
    duration: { messages: [3, 5] },
    triggers: ['random'],
    flavorRequirement: null,
  },
  confessional: {
    type: 'confessional',
    name: 'Confessional',
    duration: { messages: [2, 4] },
    triggers: ['winter_chaos'],
    chaosRequirement: 0.5,
    flavorRequirement: 'winter',
  },
  hype_man: {
    type: 'hype_man',
    name: 'Hype Man Mode',
    duration: { messages: [3, 5] },
    triggers: ['spring_chaos', 'manic'],
    chaosRequirement: 0.3,
    flavorRequirement: 'spring',
  },
  contrarian: {
    type: 'contrarian',
    name: 'Contrarian Mode',
    duration: { messages: [4, 6] },
    triggers: ['random'],
    flavorRequirement: null,
  },
}

// ============================================
// RESPONSE TYPE CONFIGURATIONS
// ============================================

export const RESPONSE_TYPE_CONFIGS: Record<ResponseType, ResponseTypeConfig> = {
  roast: {
    type: 'roast',
    lengthRange: [1, 2],
    chaosInfluence: {
      baseWeight: 50,
      chaosMultiplier: -10,  // Slightly less roasts at high chaos
    },
  },
  hot_take: {
    type: 'hot_take',
    lengthRange: [1, 2],
    chaosInfluence: {
      baseWeight: 5,
      chaosMultiplier: 30,  // More hot takes at high chaos
    },
  },
  story: {
    type: 'story',
    lengthRange: [2, 4],
    chaosInfluence: {
      baseWeight: 3,
      chaosMultiplier: 25,  // More stories at high chaos
    },
  },
  conspiracy: {
    type: 'conspiracy',
    lengthRange: [1, 3],
    chaosInfluence: {
      baseWeight: 2,
      chaosMultiplier: 35,  // Much more at high chaos
      flavorBonus: 'winter',  // Extra likely in winter chaos
    },
  },
  callback: {
    type: 'callback',
    lengthRange: [1, 2],
    chaosInfluence: {
      baseWeight: 0,  // Only available when there's recent memory
      chaosMultiplier: 10,
    },
  },
  meta: {
    type: 'meta',
    lengthRange: [1, 1],
    chaosInfluence: {
      baseWeight: 2,
      chaosMultiplier: 15,
    },
  },
  bit_response: {
    type: 'bit_response',
    lengthRange: [1, 3],  // Varies by bit type
    chaosInfluence: {
      baseWeight: 0,  // Only available when bit is active
      chaosMultiplier: 0,
    },
  },
  bit_start: {
    type: 'bit_start',
    lengthRange: [1, 2],
    chaosInfluence: {
      baseWeight: 0,  // Calculated separately
      chaosMultiplier: 20,
    },
  },
}
