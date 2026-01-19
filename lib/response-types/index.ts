// Response Types - Main export file

// Types
export type {
  ResponseType,
  BitType,
  BitConfig,
  BitTrigger,
  ActiveBit,
  ResponseTypeConfig,
  ResponseSelectorState,
} from './types'

export {
  BIT_CONFIGS,
  RESPONSE_TYPE_CONFIGS,
} from './types'

// Selector
export {
  selectResponseType,
  getChaosLevel,
  getAvailableResponseTypes,
} from './selector'

export type { SelectResponseTypeResult } from './selector'

// Prompts
export {
  buildResponseTypePrompt,
  getResponseTypeDescription,
} from './prompts'

export type { ResponseTypePromptContext } from './prompts'

// Bits
export {
  startBit,
  processBitResponse,
  isLastBitMessage,
  endBit,
  getBitConfig,
  getBitName,
  getBitProgress,
  isInStrugglePhase,
  serializeActiveBit,
  deserializeActiveBit,
  isBitEligible,
  getEligibleBits,
} from './bits'
