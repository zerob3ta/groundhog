// Personality Evolution - Drift calculations for Phil's long-term personality changes
// Phil's traits slowly shift based on how sessions go

import type { SessionState } from '../session-state'
import type { NotableMoment } from './types'
import {
  type PersonalityEvolution,
  type DriftEvent,
  type TopicAffinity,
  type EmergentGag,
  DRIFT_CAPS,
  DRIFT_DECAY,
  KV_LIMITS,
} from './types'

/**
 * Create initial personality state
 */
export function createInitialPersonality(): PersonalityEvolution {
  return {
    aggression: 0,
    paranoia: 0,
    grandiosity: 0,
    philosophicalDepth: 0,
    favoriteTopics: [],
    hatedTopics: [],
    emergentGags: [],
    selfAwareMoments: [],
    totalSessions: 0,
    totalMessages: 0,
    peakChaosEver: 0,
    lastUpdated: Date.now(),
  }
}

/**
 * Calculate drift events from a session's state
 */
export function calculateSessionDrift(
  sessionState: SessionState,
  moments: NotableMoment[],
): DriftEvent[] {
  const events: DriftEvent[] = []
  const chaos = Math.abs(sessionState.phil.season - 50) / 50
  const isWinter = sessionState.phil.season < 50
  const sessionDuration = Date.now() - sessionState.session.startTime
  const minutesInExtreme = sessionState.phil.extremeStateEnteredAt
    ? (Date.now() - sessionState.phil.extremeStateEnteredAt) / 60000
    : 0

  // Peak chaos > 80% affects traits
  if (sessionState.session.peakChaos > 0.8) {
    if (isWinter) {
      events.push({
        trait: 'paranoia',
        amount: 1,
        reason: 'Peak chaos in winter territory',
      })
    } else {
      events.push({
        trait: 'grandiosity',
        amount: 1,
        reason: 'Peak chaos in spring territory',
      })
    }
  }

  // Extended time in extreme states
  if (minutesInExtreme >= 10) {
    if (isWinter) {
      events.push({
        trait: 'philosophicalDepth',
        amount: 0.5,
        reason: '10+ minutes in winter - existential contemplation',
      })
    } else {
      events.push({
        trait: 'grandiosity',
        amount: 0.5,
        reason: '10+ minutes in spring - legend mode sustained',
      })
    }
  }

  // Check moments for trait triggers
  for (const moment of moments) {
    if (moment.type === 'legendary_roast') {
      events.push({
        trait: 'aggression',
        amount: 0.5,
        reason: `Legendary roast delivered`,
      })
    }
    if (moment.type === 'wholesome_crack') {
      events.push({
        trait: 'aggression',
        amount: -0.5,
        reason: 'Wholesome moment softened him',
      })
    }
    if (moment.type === 'meltdown') {
      events.push({
        trait: 'philosophicalDepth',
        amount: 0.5,
        reason: 'Existential meltdown deepened thoughts',
      })
    }
    if (moment.type === 'chaos_peak') {
      events.push({
        trait: 'paranoia',
        amount: 0.5,
        reason: 'Chaos peak triggered paranoid thoughts',
      })
    }
  }

  // Learning facts increases philosophical depth
  if (sessionState.corruptedKnowledge.length > 0) {
    const newFacts = sessionState.corruptedKnowledge.filter(
      f => Date.now() - f.timestamp < sessionDuration
    ).length

    if (newFacts > 0) {
      events.push({
        trait: 'philosophicalDepth',
        amount: Math.min(1, newFacts * 0.5),
        reason: `Learned ${newFacts} new "facts"`,
      })
    }
  }

  // High rant count increases aggression
  if (sessionState.phil.rantCount >= 5) {
    events.push({
      trait: 'aggression',
      amount: 0.5,
      reason: 'Multiple rants in session',
    })
  }

  return events
}

/**
 * Apply drift events to personality, respecting caps
 */
export function applyDrift(
  personality: PersonalityEvolution,
  events: DriftEvent[],
): PersonalityEvolution {
  const updated = { ...personality }

  for (const event of events) {
    const currentValue = updated[event.trait]
    const newValue = Math.max(
      DRIFT_CAPS.min,
      Math.min(DRIFT_CAPS.max, currentValue + event.amount)
    )

    if (newValue !== currentValue) {
      updated[event.trait] = newValue
      console.log(`[Personality] ${event.trait}: ${currentValue.toFixed(1)} -> ${newValue.toFixed(1)} (${event.reason})`)
    }
  }

  updated.lastUpdated = Date.now()
  return updated
}

/**
 * Apply decay to extreme trait values
 * Called at the start of each session
 */
export function applyDriftDecay(
  personality: PersonalityEvolution,
  sessionDriftDirections?: Record<string, 'positive' | 'negative' | 'neutral'>,
): PersonalityEvolution {
  const updated = { ...personality }
  const traits: (keyof Pick<PersonalityEvolution, 'aggression' | 'paranoia' | 'grandiosity' | 'philosophicalDepth'>)[] = [
    'aggression', 'paranoia', 'grandiosity', 'philosophicalDepth',
  ]

  for (const trait of traits) {
    const value = updated[trait]

    // Skip decay if session reinforced the direction
    const direction = sessionDriftDirections?.[trait]
    if (direction === 'positive' && value > 0) continue
    if (direction === 'negative' && value < 0) continue

    // Decay toward 0
    if (value > DRIFT_DECAY) {
      updated[trait] = value - DRIFT_DECAY
    } else if (value < -DRIFT_DECAY) {
      updated[trait] = value + DRIFT_DECAY
    } else {
      updated[trait] = 0
    }
  }

  return updated
}

/**
 * Update topic affinities based on session
 */
export function updateTopicAffinities(
  personality: PersonalityEvolution,
  sessionState: SessionState,
): PersonalityEvolution {
  const updated = { ...personality }

  // Update based on topics discussed this session
  for (const [topic, data] of Object.entries(sessionState.topics)) {
    if (data.mentions < 2) continue  // Need multiple mentions to matter

    const affinity = data.sentiment === 'positive' ? 10 :
                     data.sentiment === 'negative' ? -10 : 0

    if (affinity === 0) continue

    // Find existing or create new
    const existingFavorite = updated.favoriteTopics.find(t => t.topic === topic)
    const existingHated = updated.hatedTopics.find(t => t.topic === topic)

    if (affinity > 0) {
      if (existingFavorite) {
        existingFavorite.affinity = Math.min(100, existingFavorite.affinity + affinity)
      } else if (!existingHated) {
        updated.favoriteTopics.push({ topic, affinity })
      }
    } else {
      if (existingHated) {
        existingHated.affinity = Math.min(100, existingHated.affinity + Math.abs(affinity))
      } else if (!existingFavorite) {
        updated.hatedTopics.push({ topic, affinity: Math.abs(affinity) })
      }
    }
  }

  // Sort and limit
  updated.favoriteTopics.sort((a, b) => b.affinity - a.affinity)
  updated.hatedTopics.sort((a, b) => b.affinity - a.affinity)
  updated.favoriteTopics = updated.favoriteTopics.slice(0, KV_LIMITS.favoriteTopics)
  updated.hatedTopics = updated.hatedTopics.slice(0, KV_LIMITS.hatedTopics)

  return updated
}

/**
 * Add an emergent gag from the session
 */
export function addEmergentGag(
  personality: PersonalityEvolution,
  gag: string,
  origin: string,
): PersonalityEvolution {
  const updated = { ...personality }

  // Check if gag already exists
  const existing = updated.emergentGags.find(g => g.gag.toLowerCase() === gag.toLowerCase())
  if (existing) {
    existing.timesUsed++
    return updated
  }

  // Add new gag
  updated.emergentGags.push({
    gag,
    origin,
    timesUsed: 1,
  })

  // Sort by usage and limit
  updated.emergentGags.sort((a, b) => b.timesUsed - a.timesUsed)
  updated.emergentGags = updated.emergentGags.slice(0, KV_LIMITS.emergentGags)

  console.log(`[Personality] New emergent gag: "${gag}" (origin: ${origin})`)
  return updated
}

/**
 * Add a self-aware moment
 */
export function addSelfAwareMoment(
  personality: PersonalityEvolution,
  realization: string,
): PersonalityEvolution {
  const updated = { ...personality }

  // Check for duplicates (fuzzy)
  const isDuplicate = updated.selfAwareMoments.some(m =>
    m.toLowerCase().includes(realization.toLowerCase().slice(0, 20)) ||
    realization.toLowerCase().includes(m.toLowerCase().slice(0, 20))
  )

  if (!isDuplicate) {
    updated.selfAwareMoments.push(realization)
    updated.selfAwareMoments = updated.selfAwareMoments.slice(-KV_LIMITS.selfAwareMoments)
    console.log(`[Personality] New self-aware moment: "${realization}"`)
  }

  return updated
}

/**
 * Update personality stats at end of session
 */
export function updateSessionStats(
  personality: PersonalityEvolution,
  sessionState: SessionState,
): PersonalityEvolution {
  return {
    ...personality,
    totalSessions: personality.totalSessions + 1,
    totalMessages: personality.totalMessages + sessionState.phil.messageCount,
    peakChaosEver: Math.max(personality.peakChaosEver, sessionState.session.peakChaos),
    lastUpdated: Date.now(),
  }
}

/**
 * Full end-of-session personality update
 */
export function updatePersonalityEndOfSession(
  personality: PersonalityEvolution,
  sessionState: SessionState,
  newMoments: NotableMoment[],
): PersonalityEvolution {
  let updated = personality

  // Calculate and apply drift
  const driftEvents = calculateSessionDrift(sessionState, newMoments)
  updated = applyDrift(updated, driftEvents)

  // Determine drift directions for decay calculation
  const driftDirections: Record<string, 'positive' | 'negative' | 'neutral'> = {}
  for (const event of driftEvents) {
    if (event.amount > 0) driftDirections[event.trait] = 'positive'
    else if (event.amount < 0) driftDirections[event.trait] = 'negative'
  }

  // Apply decay (only to traits not reinforced this session)
  updated = applyDriftDecay(updated, driftDirections)

  // Update topic affinities
  updated = updateTopicAffinities(updated, sessionState)

  // Update stats
  updated = updateSessionStats(updated, sessionState)

  console.log('[Personality] End of session update:', {
    driftEvents: driftEvents.length,
    traits: {
      aggression: updated.aggression.toFixed(1),
      paranoia: updated.paranoia.toFixed(1),
      grandiosity: updated.grandiosity.toFixed(1),
      philosophicalDepth: updated.philosophicalDepth.toFixed(1),
    },
    totalSessions: updated.totalSessions,
  })

  return updated
}

/**
 * Get personality modifier descriptions for prompts
 */
export function getPersonalityModifiers(personality: PersonalityEvolution): string[] {
  const modifiers: string[] = []

  if (personality.aggression > 10) {
    modifiers.push("You've gotten MEANER over time. The chat has hardened you. You don't hold back anymore.")
  } else if (personality.aggression > 5) {
    modifiers.push("You've been getting sharper lately. Less patience for bullshit.")
  } else if (personality.aggression < -10) {
    modifiers.push("You've softened up a bit. Maybe you're getting sentimental in your old age.")
  }

  if (personality.paranoia > 10) {
    modifiers.push("Your conspiracy brain has been validated too many times. Trust no one. Everything is connected.")
  } else if (personality.paranoia > 5) {
    modifiers.push("You're getting more suspicious. Things aren't adding up.")
  }

  if (personality.grandiosity > 15) {
    modifiers.push("Your legend status is CONFIRMED. You ARE the main character. The universe revolves around you.")
  } else if (personality.grandiosity > 8) {
    modifiers.push("You've been on fire lately. The hype is real. You're kind of a big deal.")
  }

  if (personality.philosophicalDepth > 10) {
    modifiers.push("You've stared into the void too many times. Deep thoughts come unbidden. You ponder existence.")
  } else if (personality.philosophicalDepth > 5) {
    modifiers.push("You've been having... thoughts. About things. The big questions.")
  }

  return modifiers
}

/**
 * Get topic preferences for prompts
 */
export function getTopicPreferences(personality: PersonalityEvolution): string | null {
  const parts: string[] = []

  if (personality.favoriteTopics.length > 0) {
    const topics = personality.favoriteTopics.slice(0, 3).map(t => t.topic).join(', ')
    parts.push(`You've been really into talking about: ${topics}`)
  }

  if (personality.hatedTopics.length > 0) {
    const topics = personality.hatedTopics.slice(0, 3).map(t => t.topic).join(', ')
    parts.push(`You're SICK of hearing about: ${topics}`)
  }

  return parts.length > 0 ? parts.join('\n') : null
}

/**
 * Get emergent gags for prompts
 */
export function getEmergentGags(personality: PersonalityEvolution): string | null {
  if (personality.emergentGags.length === 0) return null

  const gags = personality.emergentGags
    .filter(g => g.timesUsed >= 2)  // Only include recurring gags
    .slice(0, 5)
    .map(g => `- "${g.gag}"`)
    .join('\n')

  if (!gags) return null

  return `Your running gags/bits that the chat loves:\n${gags}`
}
