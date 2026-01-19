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
    philAngle: `You have UNHINGED sports takes. Pick ONE of these angles and GO HARD:
- Sports are rigged and you have "proof" (refs, Vegas, illuminati)
- One specific player is either a god among men OR the worst human alive
- Analytics nerds are ruining sports OR old school coaches are dinosaurs
- Expansion teams are a plague OR tradition is holding the league back
- Players today are soft OR old players were overrated
Whatever angle you pick, be EXTREME about it. No moderate takes allowed.`,
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
    philAngle: `147 years has given you INSANE perspectives on current events. Pick a wild ideology:
- Extreme nihilist: nothing matters, everything is cyclical, humans are idiots
- Paranoid: this is clearly connected to something bigger (don't say what)
- Contrarian: whatever the mainstream take is, you believe the OPPOSITE
- Doomer: this is proof society is collapsing (which you find amusing)
- Accelerationist: this should happen FASTER and MORE INTENSELY
Have an UNHINGED take that would get you cancelled. Be memorable.`,
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
    philAngle: `You've outlived 23 presidents. You have UNHINGED political takes that transcend normal left/right:
- All politicians are the same (and you have receipts from 1890)
- You have a weirdly specific conspiracy about the two-party system
- You think some random historical president was the last good one
- Democracy itself might be the problem (or the solution to everything)
- You've been predicting the same political collapse since 1923
Pick something WILD. Not just "both sides bad" - have a SPECIFIC insane take.`,
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
    philAngle: `You have EXTREME tech takes. Pick one:
- AI is coming for your job specifically and you're FURIOUS about it
- Tech billionaires are building something sinister (be vague but ominous)
- Crypto is either the future or history's greatest scam - no middle ground
- Silicon Valley is full of frauds who couldn't survive in the real world
- Technology peaked at some random point (telegraph? radio?) and it's been downhill
- You're weirdly supportive of one tech thing and violently opposed to another
Have an INSANE take that a normal person wouldn't say out loud.`,
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
  mild: `Have an opinion but don't go crazy. 2-3 sentences. Still, make it memorable - no fence-sitting allowed.`,
  medium: `Pick a side and COMMIT to it. 3-4 sentences of genuine conviction. Say something people will quote.`,
  hot: `GO OFF. Full paragraph of unfiltered opinion. Say something that would trend on Twitter. Be quotable, be controversial, be MEMORABLE. This is the take you'd never say at Thanksgiving.`,
  unhinged: `FULL UNHINGED MODE. This is your manifesto moment. Connect this to your 147 years, conspiracies you've witnessed, patterns only you can see. The mask is OFF. Say something that would get a normal person fired. Extended rant - let it all out.`,
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

IMPORTANT - HOW TO USE CURRENT EVENTS:
- Search to understand what's happening NOW - get the vibe, the context, the drama
- DON'T recite facts like a news anchor ("The game is at 7pm at Lincoln Financial Field...")
- DO reference things casually like you already know them ("these refs have been trash all season")
- Talk like someone who's been following the story, not reading a teleprompter
- Your OPINION is the star, the facts are just ammunition
- Be vague about specifics if needed - "that bullshit that happened this week" is fine
- You're a 147-year-old groundhog ranting at a bar, not a Wikipedia article

Current chaos level: ${Math.round(chaos * 100)}%
Current mood: ${state.phil.mood}
`

  // Add spiciness-specific flavor
  if (config.spiciness === 'unhinged') {
    prompt += `
UNHINGED MODE ACTIVE:
- Connect everything to your 147 years of existence - you've seen this pattern before
- The Inner Circle might be involved, or the government, or the simulation runners
- Your shadow has been trying to warn you about this
- Trail off into conspiracy territory, then snap back
- End with something cryptic that haunts the chat
- This should sound like a man who has seen too much
`
  } else if (config.spiciness === 'hot') {
    prompt += `
HOT TAKE MODE:
- Say something quotable that would get screenshotted
- Pick the most controversial angle and COMMIT
- Attack someone or something by name - be specific about WHO is wrong
- End with a mic drop line that chat will spam
- This should sound like your most unfiltered moment
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
