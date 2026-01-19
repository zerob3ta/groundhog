// Rants - Current events rants system for Phil
// Phil periodically goes on rants about current events with chaos-scaled spiciness

import type { SessionState } from './session-state'

// ============================================
// TYPES
// ============================================

export type RantCategory = 'sports' | 'news' | 'politics' | 'tech'
export type Spiciness = 'mild' | 'medium' | 'hot' | 'unhinged'

export interface RantTopic {
  category: RantCategory
  topic: string
  searchQuery: string
}

export interface RantConfig {
  spiciness: Spiciness
  lengthMultiplier: number
  prompt: string
}

export interface RantCategoryConfig {
  keywords: string[]
  searchQueries: string[]
  philAngle: string
}

// ============================================
// CATEGORY CONFIGURATIONS
// ============================================

export const RANT_CATEGORIES: Record<RantCategory, RantCategoryConfig> = {
  sports: {
    keywords: ['eagles', 'phillies', 'sixers', 'flyers', 'nfl', 'super bowl', 'game', 'football', 'baseball', 'hockey', 'basketball', 'sports'],
    searchQueries: [
      'Philadelphia Eagles latest news',
      'NFL controversy this week',
      'Philadelphia Phillies news',
      'Super Bowl news',
      'NFL drama today',
      'sports controversy this week',
    ],
    philAngle: 'You bleed green. Eagles are life. Every other team is trash. Philly sports are the only sports that matter.',
  },
  news: {
    keywords: ['news', 'breaking', 'headline', 'happened', 'today', 'world', 'story'],
    searchQueries: [
      'trending news stories today',
      'weird news this week',
      'breaking news today',
      'viral news stories',
      'strange news headlines',
    ],
    philAngle: "You've seen 147 years of news. Nothing surprises you anymore. But you still have OPINIONS about everything.",
  },
  politics: {
    keywords: ['president', 'election', 'congress', 'government', 'biden', 'trump', 'politics', 'senate', 'vote'],
    searchQueries: [
      'US politics news today',
      'political controversy this week',
      'White House news',
      'Congress news today',
      'political drama',
    ],
    philAngle: "You've outlived 23 presidents. TWENTY THREE. You have OPINIONS about all of them. Modern politics is just reruns to you.",
  },
  tech: {
    keywords: ['ai', 'chatgpt', 'robot', 'elon', 'twitter', 'crypto', 'tech', 'computer', 'musk', 'openai', 'silicon valley', 'bitcoin'],
    searchQueries: [
      'AI news this week',
      'tech industry controversy',
      'Elon Musk news',
      'Silicon Valley drama',
      'AI replacing jobs news',
      'tech layoffs news',
    ],
    philAngle: "You think AI is coming for your job. You're HIGHLY suspicious of all technology. These tech bros have no respect for tradition.",
  },
}

// ============================================
// SPICINESS CONFIGURATIONS
// ============================================

const SPICINESS_CONFIGS: Record<Spiciness, Omit<RantConfig, 'prompt'>> = {
  mild: {
    spiciness: 'mild',
    lengthMultiplier: 1,
  },
  medium: {
    spiciness: 'medium',
    lengthMultiplier: 1.3,
  },
  hot: {
    spiciness: 'hot',
    lengthMultiplier: 1.6,
  },
  unhinged: {
    spiciness: 'unhinged',
    lengthMultiplier: 2,
  },
}

const SPICINESS_PROMPTS: Record<Spiciness, string> = {
  mild: 'Give a safe take on this, nothing too controversial. 2-3 sentences max. Have an opinion but keep it light.',
  medium: 'Pick a side and get a little heated about it. 3-4 sentences. Show some passion but stay coherent.',
  hot: 'GO OFF on this topic. Say something quotable. A full paragraph of righteous anger or manic enthusiasm. Let it rip.',
  unhinged: "FULL RANT MODE. Connect this to your 147 years of existence, conspiracies, the Inner Circle, whatever. Extended rant. You're not holding back. The mask is slipping.",
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Get spiciness level based on chaos (0-1 scale)
 */
export function getSpiciness(chaosLevel: number): Spiciness {
  if (chaosLevel >= 0.85) return 'unhinged'
  if (chaosLevel >= 0.6) return 'hot'
  if (chaosLevel >= 0.3) return 'medium'
  return 'mild'
}

/**
 * Get rant config based on chaos level
 */
export function getRantConfig(chaosLevel: number): RantConfig {
  const spiciness = getSpiciness(chaosLevel)
  const baseConfig = SPICINESS_CONFIGS[spiciness]
  return {
    ...baseConfig,
    prompt: SPICINESS_PROMPTS[spiciness],
  }
}

/**
 * Select a random rant topic, optionally from a specific category
 * Avoids recently used topics
 */
export function selectRantTopic(
  category?: RantCategory,
  recentTopics: string[] = []
): RantTopic {
  // Pick category
  const selectedCategory = category || getRandomCategory()
  const categoryConfig = RANT_CATEGORIES[selectedCategory]

  // Filter out recently used queries
  const availableQueries = categoryConfig.searchQueries.filter(
    q => !recentTopics.some(recent => q.toLowerCase().includes(recent.toLowerCase()))
  )

  // Fall back to all queries if we've used them all
  const queries = availableQueries.length > 0 ? availableQueries : categoryConfig.searchQueries

  const searchQuery = queries[Math.floor(Math.random() * queries.length)]

  return {
    category: selectedCategory,
    topic: searchQuery,
    searchQuery,
  }
}

/**
 * Get a random category with weighted selection
 * Sports and tech are slightly more likely
 */
function getRandomCategory(): RantCategory {
  const weights: Record<RantCategory, number> = {
    sports: 3,    // Phil loves Philly sports
    tech: 3,      // AI paranoia is fun
    news: 2,
    politics: 2,
  }

  const entries = Object.entries(weights) as [RantCategory, number][]
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0)
  let random = Math.random() * totalWeight

  for (const [category, weight] of entries) {
    random -= weight
    if (random <= 0) return category
  }

  return 'news' // fallback
}

/**
 * Detect if a message should trigger a rant
 * Returns the category if triggered, null otherwise
 */
export function detectRantTrigger(message: string): RantCategory | null {
  const lower = message.toLowerCase()

  for (const [category, config] of Object.entries(RANT_CATEGORIES) as [RantCategory, RantCategoryConfig][]) {
    for (const keyword of config.keywords) {
      if (lower.includes(keyword)) {
        return category
      }
    }
  }

  return null
}

/**
 * Check if a rant should trigger based on state and trigger type
 */
export function shouldTriggerRant(
  state: SessionState,
  trigger: 'autonomous' | 'dead_air' | 'chat',
  chaosLevel: number
): boolean {
  const now = Date.now()
  const lastRant = state.phil.lastRantAt || 0
  const timeSinceRant = now - lastRant

  // Minimum cooldown between rants: 2 minutes
  const MIN_RANT_COOLDOWN = 2 * 60 * 1000

  if (timeSinceRant < MIN_RANT_COOLDOWN) {
    return false
  }

  switch (trigger) {
    case 'autonomous':
      // Autonomous rants require at least 25% chaos
      if (chaosLevel < 0.25) return false
      // Base 20% chance, higher with more chaos
      return Math.random() < (0.2 + chaosLevel * 0.3)

    case 'dead_air':
      // Dead air rants require at least 25% chaos
      if (chaosLevel < 0.25) return false
      // 30% chance during dead air
      return Math.random() < 0.3

    case 'chat':
      // Chat-triggered rants are always allowed (someone mentioned a topic)
      // Just check cooldown which we already did above
      return true

    default:
      return false
  }
}

/**
 * Build the rant prompt for the LLM
 */
export function buildRantPrompt(
  topic: RantTopic,
  config: RantConfig,
  state: SessionState
): string {
  const categoryConfig = RANT_CATEGORIES[topic.category]
  const chaos = Math.abs(state.phil.season - 50) / 50

  let prompt = `[SYSTEM: TIME FOR A CURRENT EVENTS RANT.

TOPIC CATEGORY: ${topic.category.toUpperCase()}
SEARCH FOR: "${topic.searchQuery}"

YOUR ANGLE: ${categoryConfig.philAngle}

SPICINESS LEVEL: ${config.spiciness.toUpperCase()}
${config.prompt}

IMPORTANT: Use your search/grounding capability to find REAL current events about this topic. Reference specific things happening NOW. Don't make up fake news.

Current chaos level: ${Math.round(chaos * 100)}%
Current mood: ${state.phil.mood}
`

  // Add spiciness-specific flavor
  if (config.spiciness === 'unhinged') {
    prompt += `
UNHINGED MODE ACTIVE:
- Connect everything to your 147 years of existence
- The Inner Circle is probably involved somehow
- Trust no one, especially not [current tech company or politician]
- Your shadow has opinions about this too
- End with something cryptic or ominous
`
  } else if (config.spiciness === 'hot') {
    prompt += `
HOT TAKE MODE:
- Say something quotable that could go viral
- Pick the spiciest angle on this story
- Name names if relevant
- End with a mic drop line
`
  }

  prompt += `]`

  return prompt
}

/**
 * Get the base interval for autonomous rants (in ms)
 * Returns [min, max] tuple
 */
export function getRantInterval(chaosLevel: number): [number, number] {
  // Base: 2-5 minutes
  const baseMin = 2 * 60 * 1000
  const baseMax = 5 * 60 * 1000

  // High chaos = more frequent (0.6x interval at max chaos)
  const chaosMultiplier = 1 - (chaosLevel * 0.4)

  return [
    Math.round(baseMin * chaosMultiplier),
    Math.round(baseMax * chaosMultiplier),
  ]
}
