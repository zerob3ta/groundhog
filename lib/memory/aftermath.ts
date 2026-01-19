// Aftermath System - Tracks reactions to Phil's notable moments
// Captures how the chat reacted after Phil said something memorable

import type { BroadcastMessage } from '@/lib/broadcast/types'
import type { NotableMoment, MomentAftermath, AudienceReaction, TargetResponse, FeltLike } from './types'

// How long to wait after a notable moment to capture reactions
const AFTERMATH_WINDOW_MS = 30000  // 30 seconds

// Minimum messages to consider for analysis
const MIN_MESSAGES_FOR_ANALYSIS = 2

/**
 * Analyze messages that came after a notable moment to determine aftermath
 */
export function analyzeAftermath(
  moment: NotableMoment,
  messagesAfter: BroadcastMessage[],
): MomentAftermath {
  // Filter messages within the window that aren't from Phil
  const relevantMessages = messagesAfter.filter(
    m => m.type !== 'phil' && m.timestamp <= moment.timestamp + AFTERMATH_WINDOW_MS
  )

  const chatMessagesAfter = relevantMessages.length

  // Analyze audience reaction
  const audienceReaction = determineAudienceReaction(relevantMessages, moment)
  const reactionIntensity = calculateReactionIntensity(relevantMessages, chatMessagesAfter)

  // Check for target response if there was a target
  const targetResponse = moment.involvedUsers.length > 0
    ? determineTargetResponse(relevantMessages, moment.involvedUsers)
    : undefined

  // Determine how Phil "felt" about it based on reactions
  const feltLike = interpretFeltLike(audienceReaction, targetResponse, moment)

  return {
    audienceReaction,
    reactionIntensity,
    targetResponse,
    chatMessagesAfter,
    feltLike,
  }
}

/**
 * Determine the overall audience reaction based on message content
 */
function determineAudienceReaction(
  messages: BroadcastMessage[],
  moment: NotableMoment,
): AudienceReaction {
  if (messages.length < MIN_MESSAGES_FOR_ANALYSIS) {
    return 'silent'
  }

  // Analyze sentiment of messages
  let positive = 0
  let negative = 0
  let laughs = 0
  let concerns = 0

  for (const msg of messages) {
    const text = msg.text.toLowerCase()

    // Positive reactions
    if (text.includes('lmao') || text.includes('lol') || text.includes('😂') ||
        text.includes('💀') || text.includes('dead') || text.includes('haha') ||
        text.includes('iconic') || text.includes('goat') || text.includes('w ')) {
      positive++
      laughs++
    }

    // Supportive/hype
    if (text.includes('let him cook') || text.includes('go off') ||
        text.includes('real') || text.includes('based') || text.includes('spitting')) {
      positive++
    }

    // Negative/concerned reactions
    if (text.includes('chill') || text.includes('relax') || text.includes('bro') ||
        text.includes('damn') || text.includes('too far') || text.includes('yikes')) {
      negative++
      concerns++
    }

    // Pushback
    if (text.includes('actually') || text.includes('wrong') || text.includes('nah') ||
        text.includes('cap') || text.includes('ratio')) {
      negative++
    }
  }

  const total = messages.length
  const positiveRatio = positive / total
  const negativeRatio = negative / total

  // Determine reaction type
  if (positiveRatio > 0.6 && laughs > 0) {
    return 'enthusiastic'
  }

  if (negativeRatio > 0.5) {
    if (concerns > laughs) {
      return 'concerned'
    }
    return 'pushback'
  }

  if (positiveRatio > 0.4 && negativeRatio > 0.3) {
    return 'mixed'
  }

  if (total > 4) {
    return 'pile_on'  // Lots of activity, not clearly positive or negative
  }

  return 'enthusiastic'  // Default to positive if we have enough messages
}

/**
 * Calculate intensity of reaction (0-10)
 */
function calculateReactionIntensity(
  messages: BroadcastMessage[],
  totalCount: number,
): number {
  if (totalCount === 0) return 0
  if (totalCount < MIN_MESSAGES_FOR_ANALYSIS) return 2

  // Base intensity on message count
  let intensity = Math.min(5, totalCount)

  // Check for strong language indicators
  const strongReactions = messages.filter(m => {
    const text = m.text.toLowerCase()
    return text.includes('💀') || text.includes('dead') ||
           text.includes('!') || text.includes('???') ||
           text.length > 50 || // Long messages = engaged
           text.includes('holy') || text.includes('bro')
  }).length

  intensity += Math.min(3, strongReactions)

  // Check for rapid-fire responses (messages close together)
  if (messages.length >= 3) {
    const timeDiffs: number[] = []
    for (let i = 1; i < messages.length; i++) {
      timeDiffs.push(messages[i].timestamp - messages[i - 1].timestamp)
    }
    const avgTimeDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length
    if (avgTimeDiff < 2000) {  // Avg less than 2 seconds between messages
      intensity += 2
    }
  }

  return Math.min(10, intensity)
}

/**
 * Determine how the target(s) of a moment responded
 */
function determineTargetResponse(
  messages: BroadcastMessage[],
  involvedUsers: string[],
): TargetResponse {
  const involvedLower = involvedUsers.map(u => u.toLowerCase())

  // Check if any involved user sent a message
  const targetMessages = messages.filter(
    m => involvedLower.includes(m.sender.toLowerCase())
  )

  if (targetMessages.length === 0) {
    // They didn't respond - could be silent or left
    // Can't really tell if they left without more context
    return 'silent'
  }

  // Analyze their response
  const responseText = targetMessages.map(m => m.text.toLowerCase()).join(' ')

  // Check for fighting back
  if (responseText.includes('nah') || responseText.includes('actually') ||
      responseText.includes('wrong') || responseText.includes('ratio') ||
      responseText.includes('mid') || responseText.includes('L ') ||
      responseText.match(/no\s+u/i)) {
    return 'fought_back'
  }

  // Check for laughing it off
  if (responseText.includes('lmao') || responseText.includes('lol') ||
      responseText.includes('fair') || responseText.includes('true') ||
      responseText.includes('😂') || responseText.includes('got me')) {
    return 'laughed_off'
  }

  // Default: they responded but neutral/unclear
  return 'laughed_off'
}

/**
 * Interpret how Phil "felt" about the aftermath
 * This can be reinterpreted based on Phil's current state when remembering
 */
function interpretFeltLike(
  audienceReaction: AudienceReaction,
  targetResponse: TargetResponse | undefined,
  moment: NotableMoment,
): FeltLike {
  // Winter chaos moments tend toward darker interpretations
  if (moment.chaosFlavor === 'winter') {
    switch (audienceReaction) {
      case 'enthusiastic':
        return 'power'  // They fear/respect me
      case 'silent':
        return 'alienation'  // I've pushed everyone away
      case 'concerned':
        return 'guilt'  // Maybe I went too far
      case 'pushback':
        return 'uncertainty'  // Am I wrong?
      case 'pile_on':
        return 'emptiness'  // None of this matters
      case 'mixed':
        return 'uncertainty'
    }
  }

  // Spring chaos moments tend toward brighter interpretations
  if (moment.chaosFlavor === 'spring') {
    switch (audienceReaction) {
      case 'enthusiastic':
        return 'triumph'  // Nailed it
      case 'silent':
        return 'uncertainty'  // Did they get it?
      case 'concerned':
        return 'power'  // They can't handle me at my best
      case 'pushback':
        return 'triumph'  // Haters gonna hate
      case 'pile_on':
        return 'connection'  // We're all in this together
      case 'mixed':
        return 'connection'
    }
  }

  // Baseline moments - more neutral interpretations
  switch (audienceReaction) {
    case 'enthusiastic':
      return 'triumph'
    case 'silent':
      return 'emptiness'
    case 'concerned':
      return 'uncertainty'
    case 'pushback':
      return 'uncertainty'
    case 'pile_on':
      return 'connection'
    case 'mixed':
      return 'uncertainty'
  }
}

/**
 * Re-interpret a past felt-like based on current state
 * Used when Phil remembers a moment - his current state colors the memory
 */
export function reinterpretFeltLike(
  originalFeltLike: FeltLike,
  currentChaosFlavor: 'winter' | 'spring' | 'baseline',
  momentChaosFlavor: 'winter' | 'spring' | 'baseline',
): FeltLike {
  // If Phil is in winter chaos, he remembers things more darkly
  if (currentChaosFlavor === 'winter') {
    switch (originalFeltLike) {
      case 'triumph':
        return 'power'  // "It wasn't triumph, it was dominance"
      case 'connection':
        return 'alienation'  // "Were they really laughing with me?"
      case 'power':
        return 'emptiness'  // "Power over what? Meaningless"
      default:
        return originalFeltLike
    }
  }

  // If Phil is in spring chaos, he remembers things more positively
  if (currentChaosFlavor === 'spring') {
    switch (originalFeltLike) {
      case 'alienation':
        return 'power'  // "I was being real, they couldn't handle it"
      case 'guilt':
        return 'triumph'  // "They deserved it"
      case 'emptiness':
        return 'uncertainty'  // "Maybe there was something there"
      default:
        return originalFeltLike
    }
  }

  return originalFeltLike
}

/**
 * Check if enough time has passed to capture aftermath for a moment
 */
export function isAftermathReady(moment: NotableMoment): boolean {
  return Date.now() - moment.timestamp >= AFTERMATH_WINDOW_MS
}
