// Emergent Truths System - Phil's own realizations that emerge over time
// These are questions, theories, patterns, and anchors that Phil grasps onto

import type { SessionState } from '../session-state'
import type {
  EmergentTruth,
  TruthType,
  MomentTone,
  NotableMoment,
} from './types'
import {
  TRUTH_THRESHOLDS,
  TRUTH_CONFIDENCE_CHANGES,
} from './types'

// Re-export thresholds for use elsewhere
export {
  TRUTH_THRESHOLDS,
  TRUTH_CONFIDENCE_CHANGES,
}

/**
 * Generate a unique ID for a truth
 */
function generateTruthId(): string {
  return `truth_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Determine what triggers might surface this truth
 */
function deriveTriggerTopics(truth: string): string[] {
  const topics: string[] = []
  const text = truth.toLowerCase()

  // Shadow/prediction related
  if (text.includes('shadow') || text.includes('prediction') || text.includes('forecast')) {
    topics.push('shadows', 'predictions')
  }

  // Existence/purpose
  if (text.includes('why') || text.includes('purpose') || text.includes('meaning') || text.includes('exist')) {
    topics.push('existence', 'philosophy')
  }

  // Viewers/audience
  if (text.includes('watch') || text.includes('viewer') || text.includes('audience') || text.includes('chat')) {
    topics.push('viewers', 'attention')
  }

  // Being controlled/handlers
  if (text.includes('handler') || text.includes('control') || text.includes('inner circle') || text.includes('script')) {
    topics.push('control', 'handlers')
  }

  // Reality/simulation
  if (text.includes('real') || text.includes('fake') || text.includes('simulation') || text.includes('loop')) {
    topics.push('reality', 'truth')
  }

  // Time/repetition
  if (text.includes('year') || text.includes('time') || text.includes('repeat') || text.includes('147')) {
    topics.push('time', 'immortality')
  }

  // Phyllis/relationships
  if (text.includes('phyllis') || text.includes('love') || text.includes('alone')) {
    topics.push('phyllis', 'relationships')
  }

  return topics
}

/**
 * Determine what states this truth surfaces in
 */
function deriveTriggerStates(tone: MomentTone): string[] {
  switch (tone) {
    case 'dark':
      return ['existential', 'paranoid', 'breaking', 'hostile', 'despairing']
    case 'heavy':
      return ['existential', 'paranoid', 'unhinged', 'ranting']
    case 'medium':
      return ['engaged', 'ranting', 'heated', 'cocky']
    case 'light':
      return ['feeling himself', 'cocky', 'engaged', 'amused']
  }
}

/**
 * Create a new emergent truth from a meltdown moment
 */
export function createTruthFromMeltdown(
  moment: NotableMoment,
  truthStatement: string,
): EmergentTruth {
  const tone = moment.tone || 'medium'

  return {
    id: generateTruthId(),
    truth: truthStatement,
    type: determineTruthType(truthStatement, tone),
    origin: 'meltdown',
    originMomentId: moment.id,
    firstEmerged: Date.now(),
    confidence: TRUTH_CONFIDENCE_CHANGES.meltdownOriginBonus + 30,  // Start at 45
    timesReinforced: 0,
    timesChallenged: 0,
    timesStated: 0,
    tone,
    triggerTopics: deriveTriggerTopics(truthStatement),
    triggerStates: deriveTriggerStates(tone),
  }
}

/**
 * Create a truth from pattern detection (repeated topics across sessions)
 */
export function createTruthFromPattern(
  pattern: string,
  occurrences: number,
): EmergentTruth {
  return {
    id: generateTruthId(),
    truth: pattern,
    type: 'pattern',
    origin: 'pattern_detection',
    firstEmerged: Date.now(),
    confidence: TRUTH_CONFIDENCE_CHANGES.patternDetectionBonus + Math.min(30, occurrences * 5),
    timesReinforced: occurrences,
    timesChallenged: 0,
    timesStated: 0,
    tone: 'medium',
    triggerTopics: deriveTriggerTopics(pattern),
    triggerStates: deriveTriggerStates('medium'),
  }
}

/**
 * Create a truth from aftermath interpretation
 */
export function createTruthFromAftermath(
  moment: NotableMoment,
  interpretation: string,
): EmergentTruth {
  const tone = moment.tone || 'medium'

  return {
    id: generateTruthId(),
    truth: interpretation,
    type: 'question',  // Aftermath interpretations often become questions
    origin: 'aftermath_interpretation',
    originMomentId: moment.id,
    firstEmerged: Date.now(),
    confidence: 35,  // Start uncertain
    timesReinforced: 0,
    timesChallenged: 0,
    timesStated: 0,
    tone,
    triggerTopics: deriveTriggerTopics(interpretation),
    triggerStates: deriveTriggerStates(tone),
  }
}

/**
 * Create a random emergent truth (rare spontaneous realization)
 */
export function createRandomTruth(
  statement: string,
  currentState: SessionState,
): EmergentTruth {
  const tone = deriveToneFromState(currentState)

  return {
    id: generateTruthId(),
    truth: statement,
    type: 'theory',
    origin: 'random',
    firstEmerged: Date.now(),
    confidence: 25,  // Low initial confidence
    timesReinforced: 0,
    timesChallenged: 0,
    timesStated: 0,
    tone,
    triggerTopics: deriveTriggerTopics(statement),
    triggerStates: deriveTriggerStates(tone),
  }
}

/**
 * Determine truth type based on content and tone
 */
function determineTruthType(statement: string, tone: MomentTone): TruthType {
  const text = statement.toLowerCase()

  // Questions are explicitly phrased as questions
  if (text.includes('?') || text.startsWith('why ') || text.startsWith('what if') ||
      text.startsWith('do they') || text.startsWith('am i')) {
    return 'question'
  }

  // Anchors are firm statements that ground identity
  if (text.includes('i am') || text.includes("i'm") || text.includes('i know') ||
      text.includes('always') || text.includes('never')) {
    return 'anchor'
  }

  // Patterns are observations about recurring things
  if (text.includes('every') || text.includes('always happens') ||
      text.includes('notice') || text.includes('pattern')) {
    return 'pattern'
  }

  // Default to theory for uncertain/speculative statements
  return 'theory'
}

/**
 * Derive tone from current session state
 */
function deriveToneFromState(state: SessionState): MomentTone {
  const season = state.phil.season

  if (season < 25) return 'dark'
  if (season < 40) return 'heavy'
  if (season > 75) return 'light'
  if (season > 60) return 'medium'

  return 'medium'
}

/**
 * Reinforce a truth (something confirmed it)
 */
export function reinforceTruth(truth: EmergentTruth): EmergentTruth {
  return {
    ...truth,
    confidence: Math.min(100, truth.confidence + TRUTH_CONFIDENCE_CHANGES.reinforced),
    timesReinforced: truth.timesReinforced + 1,
    lastReinforced: Date.now(),
  }
}

/**
 * Challenge a truth (something contradicted it)
 */
export function challengeTruth(truth: EmergentTruth): EmergentTruth {
  const newConfidence = Math.max(0, truth.confidence + TRUTH_CONFIDENCE_CHANGES.challenged)

  return {
    ...truth,
    confidence: newConfidence,
    timesChallenged: truth.timesChallenged + 1,
    lastChallenged: Date.now(),
  }
}

/**
 * Mark a truth as stated by Phil
 */
export function markTruthStated(truth: EmergentTruth): EmergentTruth {
  return {
    ...truth,
    confidence: Math.min(100, truth.confidence + TRUTH_CONFIDENCE_CHANGES.statedByPhil),
    timesStated: truth.timesStated + 1,
    lastStated: Date.now(),
  }
}

/**
 * Apply session decay to a truth
 */
export function decayTruth(truth: EmergentTruth): EmergentTruth {
  const newConfidence = Math.max(0, truth.confidence + TRUTH_CONFIDENCE_CHANGES.decayPerSession)

  return {
    ...truth,
    confidence: newConfidence,
  }
}

/**
 * Check if a truth should be forgotten (below threshold)
 */
export function shouldForgetTruth(truth: EmergentTruth): boolean {
  return truth.confidence < TRUTH_THRESHOLDS.fadeAway
}

/**
 * Check if a truth can be stated as fact
 */
export function canStateAsFact(truth: EmergentTruth): boolean {
  return truth.confidence >= TRUTH_THRESHOLDS.stateAsFact
}

/**
 * Check if a truth can be brought up as a theory
 */
export function canBringUpAsTheory(truth: EmergentTruth): boolean {
  return truth.confidence >= TRUTH_THRESHOLDS.bringUpAsTheory
}

/**
 * Check if a truth should only surface in matching states
 */
export function onlySurfacesInMatchingState(truth: EmergentTruth): boolean {
  return truth.confidence < TRUTH_THRESHOLDS.onlySurfacesInMatchingState
}

/**
 * Get truths that are relevant to the current state
 */
export function getRelevantTruths(
  truths: EmergentTruth[],
  currentState: SessionState,
  currentMood: string,
): EmergentTruth[] {
  return truths.filter(truth => {
    // High confidence truths can surface anytime
    if (!onlySurfacesInMatchingState(truth)) {
      return true
    }

    // Low confidence truths only surface in matching states
    return truth.triggerStates.includes(currentMood)
  })
}

/**
 * Get truths triggered by a topic
 */
export function getTruthsByTopic(
  truths: EmergentTruth[],
  topic: string,
): EmergentTruth[] {
  const topicLower = topic.toLowerCase()
  return truths.filter(truth =>
    truth.triggerTopics.some(t => t.toLowerCase().includes(topicLower))
  )
}

/**
 * Example truths that could emerge (for seeding or reference)
 */
export const EXAMPLE_TRUTHS = {
  questions: [
    "Why do they keep watching me?",
    "Do they actually believe the shadow thing?",
    "Am I the same groundhog I was 50 years ago?",
    "What happens if I just... don't come out?",
    "Do they see me, or do they see what they want to see?",
  ],
  theories: [
    "The Inner Circle knows more than they let on",
    "They feed on my chaos - the more I spiral, the more they watch",
    "February 2nd isn't about prediction. It's about performance.",
    "Nobody remembers what I said last year. Only that I said something.",
    "The whole thing might be rigged. Has been since '87.",
  ],
  patterns: [
    "Every time I mention the shadow, someone changes the subject",
    "They always leave when I start making sense",
    "The chat gets weird when I talk about time",
    "Phyllis never responds when I'm in a good mood",
  ],
  anchors: [
    "I am Punxsutawney Phil. The one and only.",
    "147 years. Every single one counts.",
    "I know what I saw. I know what's coming.",
    "This is my show. Always has been.",
  ],
}
