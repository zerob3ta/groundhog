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
import { extractOpening } from './chatters'
import { trackPhrasesInState, getChaosPrompt, updateChaosTheme } from './emotion-prompts'
import {
  type ChatterType,
  calculateChatterEffect,
  getChatterStateChanges,
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
// ENERGY SYSTEM
// ============================================

// Deplete energy when Phil talks
export function depleteEnergy(state: SessionState, messageLength: number): SessionState {
  // Longer messages cost more energy (reduced costs for longer stamina)
  const baseCost = 3 // Reduced from 5
  const lengthCost = Math.floor(messageLength / 100) // 1 extra per 100 chars (was 50)
  const totalCost = Math.min(8, baseCost + lengthCost) // Cap at 8 (was 15)

  const newEnergy = Math.max(0, state.phil.energy - totalCost)

  if (newEnergy !== state.phil.energy) {
    logStateChange('Energy', `${state.phil.energy} -> ${newEnergy}`, {
      cost: totalCost,
      reason: 'spoke',
    })
  }

  return {
    ...state,
    phil: {
      ...state.phil,
      energy: newEnergy,
      lastSpokeAt: Date.now(),
      messageCount: state.phil.messageCount + 1,
    },
    session: {
      ...state.session,
      philMessages: state.session.philMessages + 1,
    },
  }
}

// Recharge energy during silence
export function rechargeEnergy(state: SessionState): SessionState {
  const timeSinceSpoke = Date.now() - state.phil.lastSpokeAt
  const secondsSinceSpoke = timeSinceSpoke / 1000

  // Recharge 3 energy per 4 seconds of silence, up to 100 (increased from 2 per 5s)
  const rechargeAmount = Math.floor(secondsSinceSpoke / 4) * 3
  const newEnergy = Math.min(100, state.phil.energy + rechargeAmount)

  // Update longest silence tracking
  const newLongestSilence = Math.max(state.session.longestSilence, timeSinceSpoke)

  if (rechargeAmount > 0 && newEnergy !== state.phil.energy) {
    logStateChange('Energy', `${state.phil.energy} -> ${newEnergy}`, {
      recharge: rechargeAmount,
      silence: `${Math.floor(secondsSinceSpoke)}s`,
    })
  }

  return {
    ...state,
    phil: {
      ...state.phil,
      energy: newEnergy,
    },
    session: {
      ...state.session,
      longestSilence: newLongestSilence,
    },
  }
}

// ============================================
// WINTER/SPRING BALANCE
// ============================================

export interface SeasonModifier {
  winter: number
  spring: number
  reason: string
}

// Things that bring winter (chaos)
export function applyWinterTrigger(
  state: SessionState,
  trigger: 'troll' | 'silence' | 'weird' | 'meta' | 'boring' | 'failed_joke' | 'time'
): SessionState {
  const modifiers: Record<typeof trigger, SeasonModifier> = {
    troll: { winter: 5, spring: -2, reason: 'troll interaction' },
    silence: { winter: 2, spring: -1, reason: 'ignored/silence' },
    weird: { winter: 3, spring: 0, reason: 'confusing message' },
    meta: { winter: 8, spring: -3, reason: 'AI/bot/fake mention' },
    boring: { winter: 2, spring: -1, reason: 'boring question' },
    failed_joke: { winter: 3, spring: -1, reason: 'joke fell flat' },
    time: { winter: 1, spring: 0, reason: 'time passing' },
  }

  const mod = modifiers[trigger]
  return applySeasonModifier(state, mod)
}

// Things that bring spring (order)
export function applySpringTrigger(
  state: SessionState,
  trigger: 'engagement' | 'wholesome' | 'good_question' | 'roast_success' | 'hype' | 'favorite_topic'
): SessionState {
  const modifiers: Record<typeof trigger, SeasonModifier> = {
    engagement: { winter: -2, spring: 5, reason: 'genuine engagement' },
    wholesome: { winter: -1, spring: 3, reason: 'positive message' },
    good_question: { winter: -1, spring: 4, reason: 'interesting question' },
    roast_success: { winter: 0, spring: 2, reason: 'successful roast' },
    hype: { winter: -2, spring: 5, reason: 'chat hype' },
    favorite_topic: { winter: -1, spring: 3, reason: 'favorite topic' },
  }

  const mod = modifiers[trigger]
  return applySeasonModifier(state, mod)
}

// Apply a season modifier
function applySeasonModifier(state: SessionState, mod: SeasonModifier): SessionState {
  const oldWinter = state.phil.winter
  const oldSpring = state.phil.spring

  let newWinter = Math.max(0, Math.min(100, oldWinter + mod.winter))
  let newSpring = Math.max(0, Math.min(100, oldSpring + mod.spring))

  // Check for winter storm aftermath - spring surges back
  const oldLevel = getSeasonLevel(state)
  if (oldLevel === 'winter_storm' && newWinter < 85) {
    // Storm passed, spring surges
    newSpring = Math.min(100, newSpring + 30)
    logStateChange('Season', 'WINTER STORM PASSED - Spring surging back', {
      spring: `${oldSpring} -> ${newSpring}`,
    })
  }

  if (oldWinter !== newWinter || oldSpring !== newSpring) {
    logStateChange('Season', `Winter: ${oldWinter} -> ${newWinter}, Spring: ${oldSpring} -> ${newSpring}`, {
      reason: mod.reason,
    })

    const newState = {
      ...state,
      phil: {
        ...state.phil,
        winter: newWinter,
        spring: newSpring,
      },
      session: {
        ...state.session,
        peakChaos: Math.max(state.session.peakChaos, newWinter),
        peakOrder: Math.max(state.session.peakOrder, newSpring),
      },
    }

    // Log season state changes
    const newLevel = getSeasonLevel(newState)
    if (oldLevel !== newLevel) {
      logStateChange('Season', `STATE CHANGE: ${oldLevel} -> ${newLevel}`)
    }

    return newState
  }

  return state
}

// Natural decay toward equilibrium (50/50)
export function applySeasonDecay(state: SessionState): SessionState {
  const { winter, spring } = state.phil
  let newWinter = winter
  let newSpring = spring

  // Decay toward 50 by 1 point
  if (winter > 50) newWinter = Math.max(50, winter - 1)
  else if (winter < 50) newWinter = Math.min(50, winter + 1)

  if (spring > 50) newSpring = Math.max(50, spring - 1)
  else if (spring < 50) newSpring = Math.min(50, spring + 1)

  if (newWinter !== winter || newSpring !== spring) {
    return {
      ...state,
      phil: {
        ...state.phil,
        winter: newWinter,
        spring: newSpring,
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
  let newState = state

  // Deplete energy
  newState = depleteEnergy(newState, messageText.length)

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

  // Recharge energy (silence was broken, calculate recharge first)
  newState = rechargeEnergy(newState)

  // Apply effects based on sender type
  if (senderType === 'chatter' && chatterType) {
    // Use the new chatter tendency system with flip mechanic
    const effect = calculateChatterEffect(chatterType as ChatterType, newState)
    const changes = getChatterStateChanges(effect)

    // Apply changes
    const oldWinter = newState.phil.winter
    const oldSpring = newState.phil.spring
    const newWinter = Math.max(0, Math.min(100, oldWinter + changes.winterChange))
    const newSpring = Math.max(0, Math.min(100, oldSpring + changes.springChange))

    if (oldWinter !== newWinter || oldSpring !== newSpring) {
      logStateChange('Chatter', `${chatterType} effect`, {
        effect: effect.reason,
        winter: `${oldWinter} -> ${newWinter}`,
        spring: `${oldSpring} -> ${newSpring}`,
        flipped: effect.didFlip,
      })

      newState = {
        ...newState,
        phil: {
          ...newState.phil,
          winter: newWinter,
          spring: newSpring,
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

  // Hype/excitement - chaos down, spring
  if (
    lower.includes('omg') ||
    lower.includes('!!!') ||
    lower.includes('legendary') ||
    lower.includes('king') ||
    lower.includes('goat')
  ) {
    return { chaos: 'down', flavor: 'spring', trigger: 'hype' }
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

  // Boring/repetitive questions
  if (
    lower.includes('see your shadow') ||
    lower.includes('predict the weather') ||
    lower.includes('favorite food')
  ) {
    return { chaos: 'up', flavor: 'winter', trigger: 'boring' }
  }

  // Weird/confusing
  if (message.length < 3 || /^[^a-zA-Z]+$/.test(message)) {
    return { chaos: 'up', flavor: 'neutral', trigger: 'weird' }
  }

  // Default: neutral, no effect
  return { chaos: 'neutral', flavor: 'neutral' }
}

// Apply user message effect based on sentiment
function applyUserMessageEffect(
  state: SessionState,
  sentiment: MessageSentiment
): SessionState {
  // Base magnitudes for user message effects
  const CHAOS_MAGNITUDE = 5
  const FLAVOR_MAGNITUDE = 3

  let winterChange = 0
  let springChange = 0

  // Apply chaos effect
  if (sentiment.chaos === 'up') {
    // Push away from 50
    if (sentiment.flavor === 'winter') {
      winterChange += CHAOS_MAGNITUDE
    } else if (sentiment.flavor === 'spring') {
      springChange += CHAOS_MAGNITUDE
    } else {
      // Neutral chaos - slight push to dominant side
      if (state.phil.winter > state.phil.spring) {
        winterChange += CHAOS_MAGNITUDE * 0.5
      } else {
        springChange += CHAOS_MAGNITUDE * 0.5
      }
    }
  } else if (sentiment.chaos === 'down') {
    // Push toward 50 (order)
    if (state.phil.winter > 50) {
      winterChange -= CHAOS_MAGNITUDE * 0.5
    } else if (state.phil.winter < 50) {
      winterChange += CHAOS_MAGNITUDE * 0.3
    }
    if (state.phil.spring > 50) {
      springChange -= CHAOS_MAGNITUDE * 0.5
    } else if (state.phil.spring < 50) {
      springChange += CHAOS_MAGNITUDE * 0.3
    }
  }

  // Apply flavor direction
  if (sentiment.flavor === 'winter') {
    winterChange += FLAVOR_MAGNITUDE
  } else if (sentiment.flavor === 'spring') {
    springChange += FLAVOR_MAGNITUDE
  }

  // Apply changes if any
  if (winterChange !== 0 || springChange !== 0) {
    const newWinter = Math.max(0, Math.min(100, state.phil.winter + winterChange))
    const newSpring = Math.max(0, Math.min(100, state.phil.spring + springChange))

    if (newWinter !== state.phil.winter || newSpring !== state.phil.spring) {
      logStateChange('User', `Message sentiment: ${sentiment.trigger || 'neutral'}`, {
        chaos: sentiment.chaos,
        flavor: sentiment.flavor,
        winter: `${state.phil.winter} -> ${newWinter}`,
        spring: `${state.phil.spring} -> ${newSpring}`,
      })

      return {
        ...state,
        phil: {
          ...state.phil,
          winter: newWinter,
          spring: newSpring,
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
