// State Updates - Functions to update SessionState based on events

import {
  SessionState,
  ChatterData,
  TopicData,
  CorruptedFact,
  ChatterTrackingState,
  getSeasonLevel,
  logStateChange,
} from './session-state'
import type { RantCategory } from './rants'
import type { ResponseType, ActiveBit, BitType } from './response-types/types'
import { startBit, processBitResponse, isLastBitMessage } from './response-types/bits'
import { extractOpening } from './chatters'
import { trackPhrasesInState, getChaosPrompt, updateChaosTheme } from './emotion-prompts'
import {
  type ChatterType,
  calculateChatterEffect,
} from './chatters'
import { calculateChaos } from './trait-system'

// ============================================
// MOOD TRANSITIONS
// ============================================

// Mood transition paths - moods can compound and spiral
const MOOD_TRANSITIONS: Record<string, Record<string, string>> = {
  bored: {
    negative: 'irritated',
    positive: 'slightly interested',
    neutral: 'bored',
  },
  irritated: {
    negative: 'hostile',
    positive: 'irritated',
    neutral: 'annoyed',
  },
  hostile: {
    negative: 'existential',
    positive: 'irritated',
    neutral: 'hostile',
  },
  existential: {
    negative: 'breaking',
    positive: 'existential',
    neutral: 'existential',
  },
  breaking: {
    negative: 'breaking',
    positive: 'recovering',
    neutral: 'breaking',
  },
  recovering: {
    negative: 'tired',
    positive: 'neutral',
    neutral: 'recovering',
  },
  neutral: {
    negative: 'annoyed',
    positive: 'feeling himself',
    neutral: 'neutral',
  },
  annoyed: {
    negative: 'frustrated',
    positive: 'annoyed',
    neutral: 'annoyed',
  },
  frustrated: {
    negative: 'ranting',
    positive: 'annoyed',
    neutral: 'frustrated',
  },
  ranting: {
    negative: 'breakdown',
    positive: 'venting',
    neutral: 'ranting',
  },
  breakdown: {
    negative: 'breakdown',
    positive: 'recovering',
    neutral: 'breakdown',
  },
  venting: {
    negative: 'ranting',
    positive: 'relieved',
    neutral: 'venting',
  },
  relieved: {
    negative: 'neutral',
    positive: 'feeling himself',
    neutral: 'neutral',
  },
  'slightly interested': {
    negative: 'bored',
    positive: 'engaged',
    neutral: 'slightly interested',
  },
  engaged: {
    negative: 'slightly interested',
    positive: 'hyped',
    neutral: 'engaged',
  },
  hyped: {
    negative: 'engaged',
    positive: 'manic',
    neutral: 'hyped',
  },
  manic: {
    negative: 'hyped',
    positive: 'unhinged',
    neutral: 'manic',
  },
  unhinged: {
    negative: 'manic',
    positive: 'unhinged',
    neutral: 'hyped',
  },
  'feeling himself': {
    negative: 'neutral',
    positive: 'cocky',
    neutral: 'feeling himself',
  },
  cocky: {
    negative: 'feeling himself',
    positive: 'legendary',
    neutral: 'cocky',
  },
  legendary: {
    negative: 'cocky',
    positive: 'legendary',
    neutral: 'feeling himself',
  },
  sleepy: {
    negative: 'grumpy',
    positive: 'sleepy',
    neutral: 'tired',
  },
  tired: {
    negative: 'exhausted',
    positive: 'neutral',
    neutral: 'tired',
  },
  exhausted: {
    negative: 'existential',
    positive: 'tired',
    neutral: 'exhausted',
  },
  grumpy: {
    negative: 'hostile',
    positive: 'irritated',
    neutral: 'grumpy',
  },
  suspicious: {
    negative: 'paranoid',
    positive: 'suspicious',
    neutral: 'suspicious',
  },
  paranoid: {
    negative: 'unhinged',
    positive: 'suspicious',
    neutral: 'paranoid',
  },
}

// Transition Phil's mood based on interaction sentiment
export function transitionMood(
  state: SessionState,
  sentiment: 'positive' | 'negative' | 'neutral'
): SessionState {
  const currentMood = state.phil.mood
  const transitions = MOOD_TRANSITIONS[currentMood] || MOOD_TRANSITIONS['neutral']
  const newMood = transitions[sentiment] || currentMood

  if (newMood !== currentMood) {
    logStateChange('Mood', `${currentMood} -> ${newMood}`, { trigger: sentiment })
  }

  return {
    ...state,
    phil: {
      ...state.phil,
      mood: newMood,
    },
  }
}

// ============================================
// SINGLE-AXIS SEASON SYSTEM
// ============================================
// season: 0 = full winter, 50 = baseline/order, 100 = full spring
// chaos = |season - 50| / 50 (automatically derived)
// flavor = season < 50 ? 'winter' : 'spring' (automatically derived)

// Season change magnitudes - BALANCED for winter/spring parity
// Negative = push toward winter (0), Positive = push toward spring (100)
// Winter total: ~49, Spring total: ~49 (equal)
const SEASON_TRIGGERS = {
  // Winter triggers (push toward 0) - total: ~49
  troll: -8,           // Trolling pushes toward winter
  silence: -3,         // Ignored/silence
  weird: -5,           // Confusing message
  meta: -12,           // AI/bot/fake mention - BIG winter push
  boring: -4,          // Boring question
  failed_joke: -5,     // Joke fell flat
  time: -2,            // Time passing (slow drift)
  existential: -10,    // Existential questions

  // Spring triggers (push toward 100) - total: ~49 (balanced with winter)
  engagement: 6,       // Genuine engagement
  wholesome: 4,        // Positive message
  good_question: 5,    // Interesting question
  roast_success: 4,    // Successful roast
  hype: 7,             // Chat hype
  favorite_topic: 4,   // Favorite topic

  // Competitive spring triggers (balanced)
  fight_won: 7,        // Phil wins an argument/roast
  challenge: 5,        // Someone challenges Phil
  worship: 4,          // Excessive praise/worship
  competition: 3,      // Rivalry/competition talk
} as const

export type SeasonTrigger = keyof typeof SEASON_TRIGGERS

// Apply a season trigger - pushes toward winter (negative) or spring (positive)
export function applySeasonTrigger(
  state: SessionState,
  trigger: SeasonTrigger
): SessionState {
  const delta = SEASON_TRIGGERS[trigger]
  return applySeasonDelta(state, delta, trigger)
}

// Legacy function aliases for backwards compatibility
export function applyWinterTrigger(
  state: SessionState,
  trigger: 'troll' | 'silence' | 'weird' | 'meta' | 'boring' | 'failed_joke' | 'time'
): SessionState {
  return applySeasonTrigger(state, trigger)
}

export function applySpringTrigger(
  state: SessionState,
  trigger: 'engagement' | 'wholesome' | 'good_question' | 'roast_success' | 'hype' | 'favorite_topic' | 'fight_won' | 'challenge' | 'worship' | 'competition'
): SessionState {
  return applySeasonTrigger(state, trigger)
}

// Extreme state thresholds for pendulum balancing
const EXTREME_WINTER_THRESHOLD = 40  // Below this = winter extreme
const EXTREME_SPRING_THRESHOLD = 60  // Above this = spring extreme

// Pendulum boost configuration
const PENDULUM_CONFIG = {
  startAfterMs: 10 * 60 * 1000,      // Start boosting after 10 minutes in extreme
  boostPerIntervalMs: 5 * 60 * 1000, // Add boost every 5 minutes
  boostPerInterval: 0.25,             // +25% per interval (0.25 = 25%)
  maxBoost: 1.5,                      // Cap at 150% boost (2.5x total weight)
}

/**
 * Calculate the pendulum boost multiplier for opposite-direction chatters.
 * Returns { winterBoost, springBoost } where values > 0 mean boost that direction.
 *
 * Example: If Phil has been in winter extreme for 20 minutes:
 * - winterBoost = 0 (no boost for winter chatters)
 * - springBoost = 0.5 (50% boost for spring chatters, so 1.5x weight)
 */
export function calculatePendulumBoost(state: SessionState): { winterBoost: number; springBoost: number } {
  const { extremeStateEnteredAt, extremeStateSide } = state.phil

  // No boost if not in an extreme state
  if (!extremeStateEnteredAt || !extremeStateSide) {
    return { winterBoost: 0, springBoost: 0 }
  }

  const timeInExtreme = Date.now() - extremeStateEnteredAt

  // No boost until after the start threshold
  if (timeInExtreme < PENDULUM_CONFIG.startAfterMs) {
    return { winterBoost: 0, springBoost: 0 }
  }

  // Calculate boost based on time past the start threshold
  const timePastStart = timeInExtreme - PENDULUM_CONFIG.startAfterMs
  const intervals = Math.floor(timePastStart / PENDULUM_CONFIG.boostPerIntervalMs)
  const boost = Math.min(
    PENDULUM_CONFIG.maxBoost,
    (intervals + 1) * PENDULUM_CONFIG.boostPerInterval
  )

  // Apply boost to the OPPOSITE direction
  if (extremeStateSide === 'winter') {
    // In winter extreme -> boost spring chatters
    return { winterBoost: 0, springBoost: boost }
  } else {
    // In spring extreme -> boost winter chatters
    return { winterBoost: boost, springBoost: 0 }
  }
}

// ============================================
// MOMENTUM SYSTEM
// ============================================
// Creates dynamic cycles instead of boring steady state
// Phases: idle -> building -> holding -> returning -> idle

import type { MomentumState } from './session-state'

const MOMENTUM_CONFIG = {
  // Steady state detection - when to start building momentum
  steadyStateRange: 15,        // Within 15 points of 50 = steady state (35-65)

  // Building phase
  buildingDurationMs: 3 * 60 * 1000,  // 3 minutes to build momentum
  maxBuildStrength: 0.6,              // Max 60% boost during building

  // Holding phase
  holdingThreshold: 30,               // Season must be <30 or >70 to enter holding
  holdingDurationMs: 5 * 60 * 1000,   // Hold at extreme for 5 minutes

  // Returning phase
  returningDurationMs: 4 * 60 * 1000, // 4 minutes to return to center
  maxReturnStrength: 0.5,             // Max 50% boost toward center
}

/**
 * Update momentum state based on current season.
 * Called after each season change to manage phase transitions.
 */
export function updateMomentum(state: SessionState): SessionState {
  const { season } = state.phil
  const momentum = state.phil.momentum || {
    direction: null,
    strength: 0,
    phaseStartedAt: Date.now(),
    phase: 'idle' as const,
  }

  const now = Date.now()
  const timeInPhase = now - momentum.phaseStartedAt
  const distanceFromCenter = Math.abs(season - 50)
  const isInSteadyState = distanceFromCenter <= MOMENTUM_CONFIG.steadyStateRange

  let newMomentum: MomentumState = { ...momentum }

  switch (momentum.phase) {
    case 'idle': {
      // In idle, wait for steady state then pick a random direction
      if (isInSteadyState && timeInPhase > 30000) { // Wait 30s before starting
        // Pick random direction
        const direction = Math.random() < 0.5 ? 'winter' : 'spring'
        newMomentum = {
          direction,
          strength: 0.1, // Start with small boost
          phaseStartedAt: now,
          phase: 'building',
        }
        logStateChange('Momentum', `Starting to build ${direction} momentum`, { season })
      }
      break
    }

    case 'building': {
      // Building phase - increase strength over time, pushing toward direction
      const buildProgress = Math.min(1, timeInPhase / MOMENTUM_CONFIG.buildingDurationMs)
      newMomentum.strength = 0.1 + (buildProgress * (MOMENTUM_CONFIG.maxBuildStrength - 0.1))

      // Check if we've hit the extreme threshold
      const hitWinterExtreme = momentum.direction === 'winter' && season <= MOMENTUM_CONFIG.holdingThreshold
      const hitSpringExtreme = momentum.direction === 'spring' && season >= (100 - MOMENTUM_CONFIG.holdingThreshold)

      if (hitWinterExtreme || hitSpringExtreme) {
        // Transition to holding
        newMomentum = {
          ...newMomentum,
          phaseStartedAt: now,
          phase: 'holding',
        }
        logStateChange('Momentum', `Hit extreme, entering holding phase`, {
          direction: momentum.direction,
          season
        })
      }
      // If we drift the wrong way significantly, reset
      else if (
        (momentum.direction === 'winter' && season > 65) ||
        (momentum.direction === 'spring' && season < 35)
      ) {
        newMomentum = {
          direction: null,
          strength: 0,
          phaseStartedAt: now,
          phase: 'idle',
        }
        logStateChange('Momentum', `Drifted wrong way, resetting to idle`, { season })
      }
      break
    }

    case 'holding': {
      // Holding at extreme - maintain position, then transition to returning
      if (timeInPhase >= MOMENTUM_CONFIG.holdingDurationMs) {
        newMomentum = {
          direction: momentum.direction === 'winter' ? 'spring' : 'winter', // Flip direction
          strength: MOMENTUM_CONFIG.maxReturnStrength,
          phaseStartedAt: now,
          phase: 'returning',
        }
        logStateChange('Momentum', `Holding complete, returning toward center`, {
          from: momentum.direction,
          season
        })
      }
      break
    }

    case 'returning': {
      // Returning to center - decrease strength as we approach
      const returnProgress = Math.min(1, timeInPhase / MOMENTUM_CONFIG.returningDurationMs)
      newMomentum.strength = MOMENTUM_CONFIG.maxReturnStrength * (1 - returnProgress * 0.5)

      // If we're back in steady state, go to idle
      if (isInSteadyState) {
        newMomentum = {
          direction: null,
          strength: 0,
          phaseStartedAt: now,
          phase: 'idle',
        }
        logStateChange('Momentum', `Returned to steady state, entering idle`, { season })
      }
      // If return phase times out, also go to idle
      else if (timeInPhase >= MOMENTUM_CONFIG.returningDurationMs) {
        newMomentum = {
          direction: null,
          strength: 0,
          phaseStartedAt: now,
          phase: 'idle',
        }
        logStateChange('Momentum', `Return phase timed out, entering idle`, { season })
      }
      break
    }
  }

  // Only update if momentum changed
  if (
    newMomentum.phase !== momentum.phase ||
    newMomentum.direction !== momentum.direction ||
    Math.abs(newMomentum.strength - momentum.strength) > 0.05
  ) {
    return {
      ...state,
      phil: {
        ...state.phil,
        momentum: newMomentum,
      },
    }
  }

  return state
}

/**
 * Calculate momentum boost for chatter selection.
 * Returns boost values that amplify the current momentum direction.
 */
export function calculateMomentumBoost(state: SessionState): { winterBoost: number; springBoost: number } {
  const momentum = state.phil.momentum

  if (!momentum || momentum.phase === 'idle' || !momentum.direction) {
    return { winterBoost: 0, springBoost: 0 }
  }

  // Apply boost in the momentum direction
  if (momentum.direction === 'winter') {
    return { winterBoost: momentum.strength, springBoost: 0 }
  } else {
    return { winterBoost: 0, springBoost: momentum.strength }
  }
}

/**
 * Get combined boost from both pendulum and momentum systems.
 * Pendulum corrects extremes, momentum creates dynamic cycles.
 */
export function getCombinedBoost(state: SessionState): { winterBoost: number; springBoost: number } {
  const pendulum = calculatePendulumBoost(state)
  const momentum = calculateMomentumBoost(state)

  // Combine boosts - they can work together or against each other
  return {
    winterBoost: Math.max(0, pendulum.winterBoost + momentum.winterBoost),
    springBoost: Math.max(0, pendulum.springBoost + momentum.springBoost),
  }
}

// Apply a raw delta to the season value
function applySeasonDelta(state: SessionState, delta: number, reason: string): SessionState {
  const oldSeason = state.phil.season
  const newSeason = Math.max(0, Math.min(100, oldSeason + delta))

  if (oldSeason === newSeason) return state

  const oldChaos = Math.abs(oldSeason - 50) / 50
  const newChaos = Math.abs(newSeason - 50) / 50
  const oldFlavor = oldSeason < 50 ? 'winter' : 'spring'
  const newFlavor = newSeason < 50 ? 'winter' : 'spring'

  logStateChange('Season', `Season: ${oldSeason} -> ${newSeason}`, {
    reason,
    chaos: `${Math.round(oldChaos * 100)}% -> ${Math.round(newChaos * 100)}%`,
    flavor: newFlavor,
  })

  const oldLevel = getSeasonLevel(state)

  // Track extreme state entry/exit for pendulum balancing
  const wasInWinterExtreme = oldSeason < EXTREME_WINTER_THRESHOLD
  const wasInSpringExtreme = oldSeason > EXTREME_SPRING_THRESHOLD
  const nowInWinterExtreme = newSeason < EXTREME_WINTER_THRESHOLD
  const nowInSpringExtreme = newSeason > EXTREME_SPRING_THRESHOLD

  let extremeStateEnteredAt = state.phil.extremeStateEnteredAt
  let extremeStateSide = state.phil.extremeStateSide

  // Entering winter extreme
  if (!wasInWinterExtreme && nowInWinterExtreme) {
    extremeStateEnteredAt = Date.now()
    extremeStateSide = 'winter'
    logStateChange('Pendulum', 'Entered winter extreme', { season: newSeason })
  }
  // Entering spring extreme
  else if (!wasInSpringExtreme && nowInSpringExtreme) {
    extremeStateEnteredAt = Date.now()
    extremeStateSide = 'spring'
    logStateChange('Pendulum', 'Entered spring extreme', { season: newSeason })
  }
  // Exiting winter extreme (back to middle)
  else if (wasInWinterExtreme && !nowInWinterExtreme) {
    extremeStateEnteredAt = undefined
    extremeStateSide = undefined
    logStateChange('Pendulum', 'Exited winter extreme', { season: newSeason })
  }
  // Exiting spring extreme (back to middle)
  else if (wasInSpringExtreme && !nowInSpringExtreme) {
    extremeStateEnteredAt = undefined
    extremeStateSide = undefined
    logStateChange('Pendulum', 'Exited spring extreme', { season: newSeason })
  }

  const newState = {
    ...state,
    phil: {
      ...state.phil,
      season: newSeason,
      extremeStateEnteredAt,
      extremeStateSide,
    },
    session: {
      ...state.session,
      peakChaos: Math.max(state.session.peakChaos, newChaos),
    },
  }

  // Log season state changes
  const newLevel = getSeasonLevel(newState)
  if (oldLevel !== newLevel) {
    logStateChange('Season', `STATE CHANGE: ${oldLevel} -> ${newLevel}`)
  }

  // Check for storm aftermath - surge back toward 50
  if ((oldLevel === 'winter_storm' || oldLevel === 'spring_storm') &&
      (newLevel !== 'winter_storm' && newLevel !== 'spring_storm')) {
    // Storm passed, surge back toward baseline
    const surgeAmount = newSeason < 50 ? 15 : -15
    const surgedSeason = Math.max(0, Math.min(100, newSeason + surgeAmount))
    logStateChange('Season', `STORM PASSED - Surging toward baseline`, {
      season: `${newSeason} -> ${surgedSeason}`,
    })
    const stormState = {
      ...newState,
      phil: {
        ...newState.phil,
        season: surgedSeason,
      },
    }
    // Update momentum after storm
    return updateMomentum(stormState)
  }

  // Update momentum system after season change
  return updateMomentum(newState)
}

// Natural decay toward equilibrium (50) with MOMENTUM
// Higher chaos = slower decay (sticky extreme states)
export function applySeasonDecay(state: SessionState): SessionState {
  const { season } = state.phil

  if (season === 50) return state

  // Calculate current chaos
  const chaos = Math.abs(season - 50) / 50

  // Momentum: higher chaos = slower decay
  // At 0% chaos: full decay (1 point)
  // At 50% chaos: half decay (0.5 points)
  // At 100% chaos: quarter decay (0.25 points)
  const decayRate = 1 - (chaos * 0.75)

  // Decay toward 50
  let newSeason = season
  if (season > 50) {
    newSeason = Math.max(50, season - decayRate)
  } else {
    newSeason = Math.min(50, season + decayRate)
  }

  // Round to avoid floating point issues
  newSeason = Math.round(newSeason * 10) / 10

  if (newSeason !== season) {
    return {
      ...state,
      phil: {
        ...state.phil,
        season: newSeason,
      },
    }
  }

  return state
}

// ============================================
// TOPIC TRACKING
// ============================================

// Track a new topic mention
export function trackTopic(
  state: SessionState,
  topic: string,
  source: 'chat' | 'phil' | 'news',
  sentiment: 'positive' | 'negative' | 'neutral' = 'neutral'
): SessionState {
  const normalizedTopic = topic.toLowerCase().trim()
  const existing = state.topics[normalizedTopic]

  const now = Date.now()
  const newTopicData: TopicData = existing
    ? {
        ...existing,
        mentions: existing.mentions + 1,
        lastMentioned: now,
        sentiment: sentiment, // Most recent sentiment wins
      }
    : {
        mentions: 1,
        lastMentioned: now,
        sentiment,
        philOpinion: null,
        source,
      }

  logStateChange('Topic', existing ? 'Updated' : 'New topic', {
    topic: normalizedTopic,
    mentions: newTopicData.mentions,
  })

  const newTopics = {
    ...state.topics,
    [normalizedTopic]: newTopicData,
  }

  // Check for obsession (3+ mentions)
  let newState = {
    ...state,
    topics: newTopics,
  }

  if (newTopicData.mentions >= 3) {
    newState = updateObsession(newState, normalizedTopic, newTopicData.mentions)
  }

  return newState
}

// Update Phil's current obsession
function updateObsession(state: SessionState, topic: string, mentions: number): SessionState {
  const strength = Math.min(100, mentions * 20) // 20 per mention, max 100

  if (
    !state.phil.currentObsession ||
    strength > state.phil.obsessionStrength
  ) {
    logStateChange('Topic', 'Obsession forming', {
      topic,
      strength,
    })

    return {
      ...state,
      phil: {
        ...state.phil,
        currentObsession: topic,
        obsessionStrength: strength,
      },
    }
  }

  return state
}

// Set Phil's opinion on a topic
export function setTopicOpinion(
  state: SessionState,
  topic: string,
  opinion: string
): SessionState {
  const normalizedTopic = topic.toLowerCase().trim()
  const existing = state.topics[normalizedTopic]

  if (!existing) return state

  return {
    ...state,
    topics: {
      ...state.topics,
      [normalizedTopic]: {
        ...existing,
        philOpinion: opinion,
      },
    },
  }
}

// Decay obsession over time
export function decayObsession(state: SessionState): SessionState {
  if (!state.phil.currentObsession) return state

  const newStrength = Math.max(0, state.phil.obsessionStrength - 5)

  if (newStrength === 0) {
    logStateChange('Topic', 'Obsession faded', {
      topic: state.phil.currentObsession,
    })
    return {
      ...state,
      phil: {
        ...state.phil,
        currentObsession: null,
        obsessionStrength: 0,
      },
    }
  }

  return {
    ...state,
    phil: {
      ...state.phil,
      obsessionStrength: newStrength,
    },
  }
}

// ============================================
// CHATTER RELATIONSHIPS
// ============================================

// Track a chatter interaction
export function trackChatterInteraction(
  state: SessionState,
  username: string,
  wasRoasted: boolean = false,
  quote?: string
): SessionState {
  const existing = state.chatters[username]
  const now = Date.now()

  const newChatterData: ChatterData = existing
    ? {
        ...existing,
        interactions: existing.interactions + 1,
        lastSeen: now,
        memorableQuotes: quote
          ? [...existing.memorableQuotes.slice(-4), quote] // Keep last 5
          : existing.memorableQuotes,
      }
    : {
        interactions: 1,
        relationship: 'neutral',
        lastSeen: now,
        memorableQuotes: quote ? [quote] : [],
        philNickname: null,
        corruptedFacts: [],
      }

  logStateChange('Chatter', wasRoasted ? 'Roasted' : 'Interacted', {
    username,
    interactions: newChatterData.interactions,
  })

  return {
    ...state,
    chatters: {
      ...state.chatters,
      [username]: newChatterData,
    },
    session: {
      ...state.session,
      totalMessages: state.session.totalMessages + 1,
    },
  }
}

// Update chatter relationship
export function updateChatterRelationship(
  state: SessionState,
  username: string,
  relationship: 'neutral' | 'favorite' | 'nemesis' | 'annoying'
): SessionState {
  const existing = state.chatters[username]
  if (!existing) return state

  if (existing.relationship !== relationship) {
    logStateChange('Chatter', 'Relationship update', {
      username,
      from: existing.relationship,
      to: relationship,
    })
  }

  return {
    ...state,
    chatters: {
      ...state.chatters,
      [username]: {
        ...existing,
        relationship,
      },
    },
  }
}

// Give a chatter a nickname
export function setChatterNickname(
  state: SessionState,
  username: string,
  nickname: string
): SessionState {
  const existing = state.chatters[username]
  if (!existing) return state

  return {
    ...state,
    chatters: {
      ...state.chatters,
      [username]: {
        ...existing,
        philNickname: nickname,
      },
    },
  }
}

// ============================================
// KNOWLEDGE CORRUPTION
// ============================================

// Check if Phil should learn a "fact" (30% chance)
export function maybeLearnFact(
  state: SessionState,
  fact: string,
  source: string
): SessionState {
  if (Math.random() > 0.3) return state // 70% chance to ignore

  const corruptedFact: CorruptedFact = {
    fact,
    source,
    confidence: 60 + Math.floor(Math.random() * 20), // 60-80 initial confidence
    timestamp: Date.now(),
  }

  logStateChange('Corruption', 'New fact learned', {
    fact: fact.slice(0, 50),
    source,
  })

  // Also add to the chatter's corrupted facts
  let newState = {
    ...state,
    corruptedKnowledge: [...state.corruptedKnowledge.slice(-9), corruptedFact], // Keep last 10
  }

  if (state.chatters[source]) {
    newState = {
      ...newState,
      chatters: {
        ...newState.chatters,
        [source]: {
          ...newState.chatters[source],
          corruptedFacts: [
            ...newState.chatters[source].corruptedFacts.slice(-2),
            fact,
          ],
        },
      },
    }
  }

  return newState
}

// Adjust confidence in a fact (when challenged or confirmed)
export function adjustFactConfidence(
  state: SessionState,
  factIndex: number,
  delta: number
): SessionState {
  const fact = state.corruptedKnowledge[factIndex]
  if (!fact) return state

  const newConfidence = Math.max(0, Math.min(100, fact.confidence + delta))

  // If confidence drops to 0, remove the fact
  if (newConfidence === 0) {
    logStateChange('Corruption', 'Fact forgotten', {
      fact: fact.fact.slice(0, 50),
    })
    return {
      ...state,
      corruptedKnowledge: state.corruptedKnowledge.filter((_, i) => i !== factIndex),
    }
  }

  return {
    ...state,
    corruptedKnowledge: state.corruptedKnowledge.map((f, i) =>
      i === factIndex ? { ...f, confidence: newConfidence } : f
    ),
  }
}

// ============================================
// COMBINED UPDATES
// ============================================

// Process a complete Phil message (call after Phil speaks)
export function processPhilMessage(
  state: SessionState,
  messageText: string,
  sentiment: 'positive' | 'negative' | 'neutral' = 'neutral'
): SessionState {
  let newState = {
    ...state,
    phil: {
      ...state.phil,
      lastSpokeAt: Date.now(),
      messageCount: state.phil.messageCount + 1,
    },
    session: {
      ...state.session,
      philMessages: state.session.philMessages + 1,
    },
  }

  // Update mood based on how the interaction went
  newState = transitionMood(newState, sentiment)

  // Apply season decay
  newState = applySeasonDecay(newState)

  // Track notable phrases for anti-repetition
  newState = trackPhrasesInState(newState, messageText)

  // Update chaos theme tracking if in chaos state
  const seasonLevel = getSeasonLevel(newState)
  if (seasonLevel === 'winter_storm' || seasonLevel === 'deep_winter') {
    const { theme } = getChaosPrompt(newState)
    newState = updateChaosTheme(newState, theme)
    logStateChange('Chaos', `Using theme: ${theme}`, {
      recentThemes: newState.phil.recentChaosThemes.join(', '),
    })
  }

  return newState
}

// Process incoming chat message (before Phil responds)
export function processIncomingMessage(
  state: SessionState,
  senderType: 'user' | 'chatter',
  chatterType?: string,
  username?: string,
  messageContent?: string
): SessionState {
  let newState = state

  // Apply effects based on sender type
  if (senderType === 'chatter' && chatterType) {
    // Use the new chatter tendency system with flip mechanic (updated for single-axis)
    const effect = calculateChatterEffect(chatterType as ChatterType, newState)
    const seasonChange = getChatterSeasonChange(effect)

    // Apply changes
    const oldSeason = newState.phil.season
    const newSeason = Math.max(0, Math.min(100, oldSeason + seasonChange))

    if (oldSeason !== newSeason) {
      const oldChaos = Math.abs(oldSeason - 50) / 50
      const newChaos = Math.abs(newSeason - 50) / 50
      logStateChange('Chatter', `${chatterType} effect`, {
        effect: effect.reason,
        season: `${oldSeason} -> ${newSeason}`,
        chaos: `${Math.round(oldChaos * 100)}% -> ${Math.round(newChaos * 100)}%`,
        flipped: effect.didFlip,
      })

      newState = {
        ...newState,
        phil: {
          ...newState.phil,
          season: newSeason,
        },
      }
    }
  } else if (senderType === 'user') {
    // Real user messages - derive effect from content, not default
    // For now, analyze basic sentiment if content provided
    if (messageContent) {
      const sentiment = analyzeMessageSentiment(messageContent)
      newState = applyUserMessageEffect(newState, sentiment)
    }
    // No default effect - real users are neutral until we analyze their message
  }

  // Track chatter if applicable
  if (username) {
    newState = trackChatterInteraction(newState, username)
  }

  return newState
}

// Convert chatter effect to single-axis season change
function getChatterSeasonChange(effect: ReturnType<typeof calculateChatterEffect>): number {
  // Base magnitude for chatter effects (INCREASED for more chaos drift)
  const BASE_MAGNITUDE = 10

  // Apply chaos effect
  const chaosMagnitude = Math.abs(effect.chaosChange) * BASE_MAGNITUDE

  // Direction: positive chaosChange = push away from 50
  // flavorDirection determines which way to push
  let seasonChange = 0

  if (effect.chaosChange > 0) {
    // Increasing chaos - push away from 50
    if (effect.flavorDirection === 'winter') {
      seasonChange = -chaosMagnitude // Push toward 0
    } else if (effect.flavorDirection === 'spring') {
      seasonChange = chaosMagnitude // Push toward 100
    } else {
      // Neutral - push toward current dominant direction
      seasonChange = Math.random() < 0.5 ? -chaosMagnitude * 0.5 : chaosMagnitude * 0.5
    }
  } else {
    // Decreasing chaos (order) - push toward 50
    // Direction doesn't matter for order - always toward center
    seasonChange = 0 // The decay function handles order naturally
    // But give a small nudge toward 50
    // This will be handled by the caller checking current season
  }

  return Math.round(seasonChange)
}

// ============================================
// USER MESSAGE ANALYSIS
// ============================================

export type MessageSentiment = {
  chaos: 'up' | 'down' | 'neutral'
  flavor: 'winter' | 'spring' | 'neutral'
  trigger?: 'troll' | 'wholesome' | 'meta' | 'engagement' | 'boring' | 'weird' | 'hype' | 'existential'
}

// Basic sentiment analysis for user messages
export function analyzeMessageSentiment(message: string): MessageSentiment {
  const lower = message.toLowerCase()

  // Meta/AI mentions - big chaos up, winter
  if (
    lower.includes('ai') ||
    lower.includes('bot') ||
    lower.includes('fake') ||
    lower.includes('not real') ||
    lower.includes('chatgpt') ||
    lower.includes('llm')
  ) {
    return { chaos: 'up', flavor: 'winter', trigger: 'meta' }
  }

  // Existential questions - chaos up, winter
  if (
    lower.includes('what is the point') ||
    lower.includes('why do you exist') ||
    lower.includes('are you alive') ||
    lower.includes('do you have feelings') ||
    lower.includes('147 years')
  ) {
    return { chaos: 'up', flavor: 'winter', trigger: 'existential' }
  }

  // ============================================
  // SPRING CHAOS TRIGGERS (push toward 100)
  // ============================================

  // Ego boosting / worship - chaos UP, spring (manic energy)
  if (
    lower.includes('goat') ||
    lower.includes('the greatest') ||
    lower.includes('legend') ||
    lower.includes('iconic') ||
    lower.includes('king') ||
    lower.includes('better than') ||
    lower.includes('no one compares')
  ) {
    return { chaos: 'up', flavor: 'spring', trigger: 'hype' }
  }

  // Fighting words / challenges - chaos UP, spring (aggressive)
  if (
    lower.includes('fight me') ||
    lower.includes('prove it') ||
    lower.includes('bet you can\'t') ||
    lower.includes('bet you won\'t') ||
    lower.includes('no balls') ||
    lower.includes('scared') ||
    lower.includes('coward')
  ) {
    return { chaos: 'up', flavor: 'spring', trigger: 'hype' }
  }

  // Competition / rivalry mentions - chaos UP, spring (megalomaniac)
  if (
    lower.includes('vs') ||
    lower.includes('versus') ||
    lower.includes('dominate') ||
    lower.includes('destroy') ||
    lower.includes('crush') ||
    lower.includes('beat') ||
    lower.includes('win')
  ) {
    return { chaos: 'up', flavor: 'spring', trigger: 'hype' }
  }

  // Excessive hype / mania - chaos UP, spring
  if (
    lower.includes('omg') ||
    lower.includes('!!!') ||
    (lower.match(/!{2,}/)) ||
    lower.includes('lets goooo') ||
    lower.includes('let\'s go') ||
    lower.includes('hype') ||
    lower.includes('insane')
  ) {
    return { chaos: 'up', flavor: 'spring', trigger: 'hype' }
  }

  // Empire / domination talk - chaos UP, spring
  if (
    lower.includes('empire') ||
    lower.includes('rule') ||
    lower.includes('world domination') ||
    lower.includes('bow down') ||
    lower.includes('kneel')
  ) {
    return { chaos: 'up', flavor: 'spring', trigger: 'hype' }
  }

  // ============================================
  // WINTER CHAOS TRIGGERS
  // ============================================

  // Trolling/hate - chaos up, winter
  if (
    lower.includes('suck') ||
    lower.includes('fake') ||
    lower.includes('chuck') ||
    lower.includes('overrated') ||
    lower.includes('washed')
  ) {
    return { chaos: 'up', flavor: 'winter', trigger: 'troll' }
  }

  // Boring/repetitive questions
  if (
    lower.includes('see your shadow') ||
    lower.includes('predict the weather') ||
    lower.includes('favorite food')
  ) {
    return { chaos: 'up', flavor: 'winter', trigger: 'boring' }
  }

  // ============================================
  // STABILIZING TRIGGERS (push toward 50)
  // ============================================

  // Wholesome/supportive - chaos down, neutral
  if (
    lower.includes('love you') ||
    lower.includes('amazing') ||
    lower.includes('the best') ||
    lower.includes('thank you') ||
    lower.includes('appreciate')
  ) {
    return { chaos: 'down', flavor: 'neutral', trigger: 'wholesome' }
  }

  // Good engagement/questions about lore - chaos down
  if (
    lower.includes('tell me about') ||
    lower.includes('how did you') ||
    lower.includes('what was it like') ||
    lower.includes('inner circle') ||
    lower.includes('gobbler')
  ) {
    return { chaos: 'down', flavor: 'neutral', trigger: 'engagement' }
  }

  // Weird/confusing
  if (message.length < 3 || /^[^a-zA-Z]+$/.test(message)) {
    return { chaos: 'up', flavor: 'neutral', trigger: 'weird' }
  }

  // Default: neutral, no effect
  return { chaos: 'neutral', flavor: 'neutral' }
}

// Apply user message effect based on sentiment (SINGLE-AXIS)
function applyUserMessageEffect(
  state: SessionState,
  sentiment: MessageSentiment
): SessionState {
  // INCREASED magnitudes for more chaos drift
  const CHAOS_MAGNITUDE = 8
  const FLAVOR_MAGNITUDE = 5

  let seasonChange = 0

  // Apply chaos effect
  if (sentiment.chaos === 'up') {
    // Push away from 50 in the flavor direction
    if (sentiment.flavor === 'winter') {
      seasonChange -= CHAOS_MAGNITUDE // Push toward 0
    } else if (sentiment.flavor === 'spring') {
      seasonChange += CHAOS_MAGNITUDE // Push toward 100
    } else {
      // Neutral chaos - push toward current dominant side
      if (state.phil.season < 50) {
        seasonChange -= CHAOS_MAGNITUDE * 0.5 // Continue winter direction
      } else {
        seasonChange += CHAOS_MAGNITUDE * 0.5 // Continue spring direction
      }
    }
  } else if (sentiment.chaos === 'down') {
    // Push toward 50 (order)
    if (state.phil.season > 50) {
      seasonChange -= CHAOS_MAGNITUDE * 0.5 // Push back toward 50
    } else if (state.phil.season < 50) {
      seasonChange += CHAOS_MAGNITUDE * 0.5 // Push back toward 50
    }
  }

  // Apply flavor direction
  if (sentiment.flavor === 'winter') {
    seasonChange -= FLAVOR_MAGNITUDE // Push toward winter (0)
  } else if (sentiment.flavor === 'spring') {
    seasonChange += FLAVOR_MAGNITUDE // Push toward spring (100)
  }

  // Apply changes if any
  if (seasonChange !== 0) {
    const oldSeason = state.phil.season
    const newSeason = Math.max(0, Math.min(100, oldSeason + seasonChange))

    if (newSeason !== oldSeason) {
      const oldChaos = Math.abs(oldSeason - 50) / 50
      const newChaos = Math.abs(newSeason - 50) / 50
      logStateChange('User', `Message sentiment: ${sentiment.trigger || 'neutral'}`, {
        chaos: `${Math.round(oldChaos * 100)}% -> ${Math.round(newChaos * 100)}%`,
        flavor: sentiment.flavor,
        season: `${oldSeason} -> ${newSeason}`,
      })

      return {
        ...state,
        phil: {
          ...state.phil,
          season: newSeason,
        },
      }
    }
  }

  return state
}

// ============================================
// CHATTER MESSAGE TRACKING (Anti-Repetition)
// ============================================

// Track a chatter message for anti-repetition
export function trackChatterMessage(
  state: SessionState,
  chatterType: ChatterType,
  message: string
): SessionState {
  // Initialize tracking state if not present
  const tracking: ChatterTrackingState = state.chatterTracking || {
    recentMessages: [],
    recentByType: {},
    usedOpenings: [],
  }

  // Update recent messages globally (keep last 20)
  const newRecentMessages = [...tracking.recentMessages, message].slice(-20)

  // Update recent messages by type (keep last 5 per type)
  const typeMessages = tracking.recentByType[chatterType] || []
  const newTypeMessages = [...typeMessages, message].slice(-5)
  const newRecentByType = {
    ...tracking.recentByType,
    [chatterType]: newTypeMessages,
  }

  // Extract and track opening word
  const opening = extractOpening(message)
  let newUsedOpenings = tracking.usedOpenings
  if (opening) {
    newUsedOpenings = [...tracking.usedOpenings, opening].slice(-15)
  }

  const newTracking: ChatterTrackingState = {
    recentMessages: newRecentMessages,
    recentByType: newRecentByType,
    usedOpenings: newUsedOpenings,
  }

  logStateChange('Chatter', 'Tracked message', {
    type: chatterType,
    opening: opening || 'none',
    tracked: newRecentMessages.length,
  })

  return {
    ...state,
    chatterTracking: newTracking,
  }
}

// ============================================
// RANT PROCESSING
// ============================================

/**
 * Process a completed rant - update tracking state
 */
export function processRant(
  state: SessionState,
  topic: string,
  category: RantCategory
): SessionState {
  const now = Date.now()

  // Track the rant topic (keep last 3)
  const recentRantTopics = [...state.phil.recentRantTopics, topic].slice(-3)

  logStateChange('Rant', `Completed rant`, {
    category,
    topic: topic.slice(0, 40),
    rantCount: state.phil.rantCount + 1,
  })

  return {
    ...state,
    phil: {
      ...state.phil,
      lastRantAt: now,
      rantCount: state.phil.rantCount + 1,
      recentRantTopics,
    },
  }
}

// ============================================
// RESPONSE TYPE TRACKING
// ============================================

const MAX_RECENT_RESPONSE_TYPES = 10

/**
 * Track a response type that was used
 */
export function trackResponseType(
  state: SessionState,
  responseType: ResponseType
): SessionState {
  const recentTypes = [...state.phil.recentResponseTypes, responseType].slice(-MAX_RECENT_RESPONSE_TYPES)

  logStateChange('ResponseType', `Used ${responseType}`, {
    recent: recentTypes.slice(-3).join(', '),
  })

  return {
    ...state,
    phil: {
      ...state.phil,
      recentResponseTypes: recentTypes,
    },
  }
}

/**
 * Start a new bit (temporary personality shift)
 */
export function startNewBit(
  state: SessionState,
  bitType: BitType
): SessionState {
  const activeBit = startBit(bitType)

  return {
    ...state,
    phil: {
      ...state.phil,
      activeBit,
    },
  }
}

/**
 * Process a bit response - decrements remaining messages and potentially ends the bit
 */
export function processActiveBit(state: SessionState): SessionState {
  const { activeBit } = state.phil

  if (!activeBit) return state

  const updatedBit = processBitResponse(activeBit)

  return {
    ...state,
    phil: {
      ...state.phil,
      activeBit: updatedBit,
    },
  }
}

/**
 * Check if the current message is the last one of an active bit
 */
export function isLastBitMessageInState(state: SessionState): boolean {
  const { activeBit } = state.phil
  if (!activeBit) return false
  return isLastBitMessage(activeBit)
}

/**
 * Force end the current bit
 */
export function endCurrentBit(state: SessionState): SessionState {
  if (!state.phil.activeBit) return state

  logStateChange('Bit', `Force ending bit`, {
    type: state.phil.activeBit.type,
  })

  return {
    ...state,
    phil: {
      ...state.phil,
      activeBit: null,
    },
  }
}

/**
 * Get the active bit if one exists
 */
export function getActiveBit(state: SessionState): ActiveBit | null {
  return state.phil.activeBit || null
}

/**
 * Get recent response types for anti-repetition
 */
export function getRecentResponseTypes(state: SessionState): ResponseType[] {
  return state.phil.recentResponseTypes || []
}
