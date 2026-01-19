// Notability Detection - Determines if a Phil message is worth remembering
// Scores messages based on chaos, rant intensity, mood, and target presence

import type { SessionState } from '../session-state'
import type { RantAnalysis } from '../rant-detector'
import {
  type NotabilityScore,
  type MomentType,
  type NotableMoment,
} from './types'

// Moods that indicate intense/memorable moments
const INTENSE_MOODS = [
  'manic', 'unhinged', 'hostile', 'breaking', 'legendary',
  'existential', 'paranoid', 'ranting', 'breakdown',
]

// Moods that indicate wholesome/positive moments
const WHOLESOME_MOODS = [
  'feeling himself', 'engaged', 'relieved', 'cocky',
]

/**
 * Calculate a notability score for a Phil message
 * Score >= 50 indicates a moment worth saving
 */
export function calculateNotabilityScore(
  message: string,
  state: SessionState,
  rantAnalysis: RantAnalysis | null,
): NotabilityScore {
  let chaosContribution = 0
  let rantContribution = 0
  let lengthContribution = 0
  let moodContribution = 0
  let targetContribution = 0

  // Chaos contribution (0-30 points)
  // Higher chaos = more notable
  const chaos = Math.abs(state.phil.season - 50) / 50
  chaosContribution = Math.round(chaos * 30)

  // Rant intensity (0-30 points)
  if (rantAnalysis?.isRant) {
    const intensityScores: Record<string, number> = {
      'mild': 5,
      'moderate': 15,
      'heated': 25,
      'nuclear': 30,
    }
    rantContribution = intensityScores[rantAnalysis.intensity] || 0
  }

  // Length contribution (0-15 points)
  // Longer messages are more memorable (to a point)
  const wordCount = message.split(/\s+/).length
  lengthContribution = Math.min(15, Math.round(wordCount / 10 * 5))

  // Mood contribution (0-15 points)
  if (INTENSE_MOODS.includes(state.phil.mood)) {
    moodContribution = 15
  } else if (WHOLESOME_MOODS.includes(state.phil.mood)) {
    moodContribution = 10  // Wholesome moments are also notable
  }

  // Target contribution (0-10 points)
  // Messages that target specific users are more memorable
  if (rantAnalysis?.mentionedUsers?.length) {
    targetContribution = 10
  }

  const total = chaosContribution + rantContribution + lengthContribution + moodContribution + targetContribution

  return {
    total,
    chaosContribution,
    rantContribution,
    lengthContribution,
    moodContribution,
    targetContribution,
  }
}

/**
 * Check if a message meets the notability threshold
 */
export function isNotable(score: NotabilityScore, threshold: number = 50): boolean {
  return score.total >= threshold
}

/**
 * Determine the type of moment based on context
 */
export function determineMomentType(
  state: SessionState,
  rantAnalysis: RantAnalysis | null,
  score: NotabilityScore,
): MomentType {
  const chaos = Math.abs(state.phil.season - 50) / 50
  const mood = state.phil.mood

  // High chaos = chaos peak
  if (chaos >= 0.85) {
    return 'chaos_peak'
  }

  // Rant-based types
  if (rantAnalysis?.isRant) {
    if (rantAnalysis.intensity === 'nuclear' || rantAnalysis.intensity === 'heated') {
      // Check if it's targeting someone
      if (rantAnalysis.mentionedUsers?.length) {
        return 'legendary_roast'
      }
      return 'epic_rant'
    }
  }

  // Mood-based types
  if (mood === 'breaking' || mood === 'breakdown' || mood === 'existential') {
    return 'meltdown'
  }

  if (WHOLESOME_MOODS.includes(mood) && score.moodContribution > 0) {
    return 'wholesome_crack'
  }

  // Default to epic rant if notable but no specific type
  return 'epic_rant'
}

/**
 * Extract the key quote from a Phil message
 * Tries to find the most punchy/memorable line
 */
export function extractKeyQuote(message: string): string {
  // Split into sentences
  const sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 0)

  if (sentences.length === 0) return message.slice(0, 100)
  if (sentences.length === 1) return sentences[0].trim().slice(0, 100)

  // Score sentences by "punchiness"
  const scored = sentences.map(s => {
    const sentence = s.trim()
    let score = 0

    // Shorter sentences are often punchier
    const words = sentence.split(/\s+/).length
    if (words <= 10) score += 3
    else if (words <= 15) score += 1

    // All caps words indicate emphasis
    const capsWords = (sentence.match(/\b[A-Z]{2,}\b/g) || []).length
    score += capsWords * 2

    // Curse words = memorable
    const curses = (sentence.toLowerCase().match(/\b(fuck|shit|damn|ass|bitch|hell)\b/g) || []).length
    score += curses

    // Question marks = engaging
    if (sentence.includes('?')) score += 1

    // Exclamation intensity
    const exclamations = (sentence.match(/!/g) || []).length
    score += Math.min(exclamations, 3)

    return { sentence, score }
  })

  // Return highest scored sentence
  scored.sort((a, b) => b.score - a.score)
  return scored[0].sentence.slice(0, 100)
}

/**
 * Build context string for a notable moment
 */
export function buildMomentContext(
  state: SessionState,
  rantAnalysis: RantAnalysis | null,
  triggerUser?: string,
): string {
  const parts: string[] = []

  // Trigger user
  if (triggerUser) {
    parts.push(`triggered by ${triggerUser}`)
  } else if (rantAnalysis?.mentionedUsers?.length) {
    parts.push(`targeting ${rantAnalysis.mentionedUsers.join(', ')}`)
  }

  // Topic if available
  if (rantAnalysis?.topics?.length) {
    parts.push(`topic: ${rantAnalysis.topics.slice(0, 2).join(', ')}`)
  } else if (state.phil.currentObsession) {
    parts.push(`obsessing about ${state.phil.currentObsession}`)
  }

  // Mood context
  if (INTENSE_MOODS.includes(state.phil.mood)) {
    parts.push(`mood: ${state.phil.mood}`)
  }

  return parts.join('; ') || 'spontaneous moment'
}

/**
 * Determine chaos flavor based on season
 */
function getChaosFlavor(season: number): 'winter' | 'spring' | 'baseline' {
  if (season < 35) return 'winter'  // Below 35 is winter chaos
  if (season > 65) return 'spring'  // Above 65 is spring chaos
  return 'baseline'
}

/**
 * Determine moment tone based on type and chaos
 */
function getMomentTone(
  type: MomentType,
  chaosFlavor: 'winter' | 'spring' | 'baseline',
  mood: string
): 'light' | 'medium' | 'heavy' | 'dark' {
  // Light roasts are light
  if (type === 'legendary_roast' && chaosFlavor !== 'winter') {
    return 'light'
  }

  // Wholesome cracks are always light
  if (type === 'wholesome_crack') {
    return 'light'
  }

  // Epic rants vary by flavor
  if (type === 'epic_rant') {
    if (chaosFlavor === 'spring') return 'medium'
    if (chaosFlavor === 'winter') return 'heavy'
    return 'medium'
  }

  // Meltdowns are heavy or dark
  if (type === 'meltdown') {
    if (chaosFlavor === 'winter') return 'dark'
    return 'heavy'
  }

  // Chaos peaks depend on flavor
  if (type === 'chaos_peak') {
    if (chaosFlavor === 'winter') return 'heavy'
    return 'medium'
  }

  return 'medium'
}

/**
 * Calculate energy effect (-10 to +10) based on moment characteristics
 */
function getEnergyEffect(
  type: MomentType,
  tone: 'light' | 'medium' | 'heavy' | 'dark',
  chaosFlavor: 'winter' | 'spring' | 'baseline'
): number {
  // Light moments are energizing
  if (tone === 'light') return 5
  if (tone === 'dark') return -8
  if (tone === 'heavy') return -4

  // Medium depends on type and flavor
  if (type === 'legendary_roast') return 3
  if (type === 'epic_rant' && chaosFlavor === 'spring') return 4
  if (type === 'chaos_peak') return chaosFlavor === 'spring' ? 2 : -2

  return 0
}

/**
 * Create a NotableMoment from a Phil message
 * @param excludeUsernames - Set of usernames to exclude from involvedUsers (e.g., fake chatters)
 */
export function createNotableMoment(
  message: string,
  state: SessionState,
  rantAnalysis: RantAnalysis | null,
  triggerUser?: string,
  excludeUsernames?: Set<string>,
): NotableMoment {
  const score = calculateNotabilityScore(message, state, rantAnalysis)
  const chaos = Math.abs(state.phil.season - 50) / 50
  const chaosFlavor = getChaosFlavor(state.phil.season)
  const type = determineMomentType(state, rantAnalysis, score)
  const tone = getMomentTone(type, chaosFlavor, state.phil.mood)
  const energyEffect = getEnergyEffect(type, tone, chaosFlavor)

  // Build involved users list, filtering out excluded usernames (fake chatters)
  let involvedUsers: string[] = []
  if (rantAnalysis?.mentionedUsers?.length) {
    involvedUsers = excludeUsernames
      ? rantAnalysis.mentionedUsers.filter(u => !excludeUsernames.has(u.toLowerCase()))
      : rantAnalysis.mentionedUsers
  } else if (triggerUser) {
    involvedUsers = excludeUsernames?.has(triggerUser.toLowerCase()) ? [] : [triggerUser]
  }

  return {
    id: `moment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    type,
    philQuote: extractKeyQuote(message),
    context: buildMomentContext(state, rantAnalysis, triggerUser),
    involvedUsers,
    chaosLevel: chaos,
    chaosFlavor,
    mood: state.phil.mood,
    timesReferenced: 0,
    tone,
    energyEffect,
    // aftermath will be captured later by the aftermath system
  }
}

/**
 * Check if a moment should be saved and create it if so
 * @param excludeUsernames - Set of usernames to exclude from involvedUsers (e.g., fake chatters)
 */
export function checkAndCreateMoment(
  message: string,
  state: SessionState,
  rantAnalysis: RantAnalysis | null,
  triggerUser?: string,
  excludeUsernames?: Set<string>,
): NotableMoment | null {
  const score = calculateNotabilityScore(message, state, rantAnalysis)

  if (!isNotable(score)) {
    return null
  }

  const moment = createNotableMoment(message, state, rantAnalysis, triggerUser, excludeUsernames)

  console.log(`[Memory] Notable moment detected: ${moment.type} (score: ${score.total})`, {
    quote: moment.philQuote.slice(0, 50),
    context: moment.context,
    breakdown: {
      chaos: score.chaosContribution,
      rant: score.rantContribution,
      length: score.lengthContribution,
      mood: score.moodContribution,
      target: score.targetContribution,
    },
  })

  return moment
}
