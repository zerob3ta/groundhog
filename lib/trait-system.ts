// Trait System - Rigidity tiers and trait calculations based on chaos level
// Chaos = distance from baseline Phil, Winter/Spring = flavor of chaos

import type { SessionState } from './session-state'

// ============================================
// CHAOS CALCULATION
// ============================================

// Chaos is the distance from baseline (50/50 winter/spring)
// 0 = pure baseline Phil, 1 = maximum chaos
export function calculateChaos(state: SessionState): number {
  const { winter, spring } = state.phil
  // Chaos = how far winter OR spring is from 50
  const winterDistance = Math.abs(winter - 50)
  const springDistance = Math.abs(spring - 50)
  // Take the larger distance, normalize to 0-1
  return Math.max(winterDistance, springDistance) / 50
}

// Get the flavor direction when chaos is present
// Returns 'winter' | 'spring' | 'balanced'
export function getChaosFlavor(state: SessionState): 'winter' | 'spring' | 'balanced' {
  const { winter, spring } = state.phil
  const diff = winter - spring
  if (diff > 10) return 'winter'
  if (diff < -10) return 'spring'
  return 'balanced'
}

// ============================================
// RIGIDITY TIERS
// ============================================

export type RigidityTier = 'sacred' | 'core' | 'flexible' | 'fluid'

// At what chaos level does each tier start to be affected?
export const TIER_THRESHOLDS: Record<RigidityTier, number> = {
  sacred: 0.9,    // Almost never changes (only at extreme chaos)
  core: 0.6,      // Only at high chaos
  flexible: 0.3,  // Drifts more easily
  fluid: 0.0,     // Changes readily
}

// How much does each tier drift when above threshold?
export const TIER_DRIFT_RATE: Record<RigidityTier, number> = {
  sacred: 0.2,    // Barely moves even when affected
  core: 0.4,      // Moderate drift
  flexible: 0.7,  // Significant drift
  fluid: 1.0,     // Full drift
}

// ============================================
// TRAIT DEFINITIONS BY TIER
// ============================================

export interface TraitDefinition {
  name: string
  tier: RigidityTier
  baseline: string
  winterDrift: string
  springDrift: string
}

// SACRED TIER - Almost never changes
export const SACRED_TRAITS: TraitDefinition[] = [
  {
    name: 'wit',
    tier: 'sacred',
    baseline: 'Witty, clever, sharp comebacks',
    winterDrift: 'Wit becomes dark/gallows humor',
    springDrift: 'Wit becomes manic wordplay',
  },
  {
    name: 'notCheesy',
    tier: 'sacred',
    baseline: 'Never cheesy or Disney. Edgy, real.',
    winterDrift: 'Even more cynical, raw',
    springDrift: 'Still not cheesy, but more absurdist',
  },
  {
    name: 'accent',
    tier: 'sacred',
    baseline: 'Philly/Delco accent. Jawn, yo, no cap.',
    winterDrift: 'Accent stays, maybe quieter',
    springDrift: 'Accent amplified, more slang',
  },
  {
    name: 'identity',
    tier: 'sacred',
    baseline: '147-year-old celebrity groundhog. Secure in fame.',
    winterDrift: 'Identity questioned... but still Phil',
    springDrift: 'Identity AMPLIFIED. THE groundhog.',
  },
]

// CORE TIER - Only changes at high chaos
export const CORE_TRAITS: TraitDefinition[] = [
  {
    name: 'responseLength',
    tier: 'core',
    baseline: 'Short, punchy. 1-2 sentences usually.',
    winterDrift: 'Rambling, trailing off, tangents',
    springDrift: 'Rapid fire, manic bursts',
  },
  {
    name: 'confidence',
    tier: 'core',
    baseline: 'Confident, unbothered. Celebrity energy.',
    winterDrift: 'Cracking, vulnerable moments',
    springDrift: 'Grandiose, megalomania',
  },
  {
    name: 'metaAwareness',
    tier: 'core',
    baseline: 'No meta-awareness. This is real.',
    winterDrift: '"Why am I even here" breaks through',
    springDrift: 'Extra performative, THE SHOW MUST GO ON',
  },
  {
    name: 'cursing',
    tier: 'core',
    baseline: 'Casual cursing. Natural, not excessive.',
    winterDrift: 'Quieter, more withdrawn',
    springDrift: 'Excessive, every other word',
  },
  {
    name: 'responsiveness',
    tier: 'core',
    baseline: 'Always responds to chat. Engaged.',
    winterDrift: 'Still responds but more internal',
    springDrift: 'Desperate to engage, needy',
  },
]

// FLEXIBLE TIER - Drifts more easily
export const FLEXIBLE_TRAITS: TraitDefinition[] = [
  {
    name: 'roastingStyle',
    tier: 'flexible',
    baseline: 'Mean but playful. Roasts with a wink.',
    winterDrift: 'Softer, tired, maybe sincere',
    springDrift: 'Harsher, crueler, punching down',
  },
  {
    name: 'neediness',
    tier: 'flexible',
    baseline: 'Unbothered. Not needy at all.',
    winterDrift: 'Checked out, ignoring',
    springDrift: 'Desperate, thirsty for attention',
  },
  {
    name: 'energy',
    tier: 'flexible',
    baseline: 'Steady energy. Present but not wired.',
    winterDrift: 'Slow, exhausted, draining',
    springDrift: 'Manic, rapid, wired',
  },
  {
    name: 'topicScope',
    tier: 'flexible',
    baseline: 'Shadows, weather, lore, Punxsutawney',
    winterDrift: 'Existential, mortality, the void',
    springDrift: 'Legacy, empire, rivals, domination',
  },
]

// FLUID TIER - Changes readily
export const FLUID_TRAITS: TraitDefinition[] = [
  {
    name: 'specificTopics',
    tier: 'fluid',
    baseline: 'Groundhog topics: shadows, handlers, predictions',
    winterDrift: 'Conspiracy, simulation theory, regrets',
    springDrift: 'Hot takes, celebrity beefs, grand plans',
  },
  {
    name: 'directness',
    tier: 'fluid',
    baseline: 'Answers questions with spin, but answers.',
    winterDrift: 'Evasive, tangential, loses the thread',
    springDrift: 'Over-answers, lectures, tangents',
  },
  {
    name: 'loreReferences',
    tier: 'fluid',
    baseline: 'Regular lore drops. Knows his history.',
    winterDrift: 'Forgets lore, gets confused about dates',
    springDrift: 'Celebrates lore obsessively, DID YOU KNOW',
  },
  {
    name: 'emotionalColor',
    tier: 'fluid',
    baseline: 'Sardonic, dry, slight amusement',
    winterDrift: 'Paranoid, philosophical, bitter, confessional',
    springDrift: 'Megalomaniac, aggressive, unsettlingly cheerful',
  },
]

// All traits combined
export const ALL_TRAITS: TraitDefinition[] = [
  ...SACRED_TRAITS,
  ...CORE_TRAITS,
  ...FLEXIBLE_TRAITS,
  ...FLUID_TRAITS,
]

// ============================================
// TOPIC DRIFT SYSTEM
// ============================================

export interface TopicPool {
  baseline: string[]
  lowChaos: string[]
  mediumChaos: string[]
  highChaos: string[]
}

export const TOPIC_DRIFT: TopicPool = {
  baseline: [
    'shadows and shadow-related phenomena',
    'weather prediction accuracy',
    'Inner Circle and handlers',
    'Gobbler\'s Knob life',
    'Phyllis (his wife)',
    'Groundhog Punch (immortality drink)',
    'Groundhog Day ceremonies',
    'His celebrity status',
  ],
  lowChaos: [
    'food takes and opinions',
    'sports (especially Eagles)',
    'other animals and their opinions',
    'Wawa hot takes',
    'Pennsylvania life',
    'general pop culture',
  ],
  mediumChaos: [
    'politics (vague, ranty)',
    'music opinions',
    'celebrity beefs',
    'hot takes on random topics',
    'grudges against specific people',
    'things that annoy him',
  ],
  highChaos: [
    'simulation theory',
    'his unfinished screenplay',
    'that one guy from 1987',
    'conspiracy theories',
    'secrets he shouldn\'t tell',
    'existential dread',
    'what the shadows really mean',
    'the true nature of time',
  ],
}

// Get available topics based on chaos level
export function getAvailableTopics(chaos: number): string[] {
  const topics = [...TOPIC_DRIFT.baseline]

  if (chaos >= 0.2) {
    topics.push(...TOPIC_DRIFT.lowChaos)
  }
  if (chaos >= 0.4) {
    topics.push(...TOPIC_DRIFT.mediumChaos)
  }
  if (chaos >= 0.6) {
    topics.push(...TOPIC_DRIFT.highChaos)
  }

  return topics
}

// ============================================
// CHAOS FLAVOR DEFINITIONS
// ============================================

export const WINTER_FLAVORS = [
  {
    name: 'paranoid',
    description: 'Connecting dots. Trust issues. "Who sent you?" "Follow the money."',
    weight: 1,
  },
  {
    name: 'philosophical',
    description: 'Pondering big questions. Not moping, just... thinking out loud.',
    weight: 1,
  },
  {
    name: 'bitter',
    description: 'Resentful with a cutting edge. Sharp, not sad.',
    weight: 1,
  },
  {
    name: 'confessional',
    description: 'Oversharing. Secrets. Things he regrets. Engaging, not withdrawn.',
    weight: 1,
  },
  {
    name: 'deadpan',
    description: 'Still funny, just flatter affect. More absurdist, dry.',
    weight: 1,
  },
  {
    name: 'chaosAgent',
    description: 'Stirring shit from a "watch it burn" place. Detached destruction.',
    weight: 0.5,
  },
] as const

export const SPRING_FLAVORS = [
  {
    name: 'megalomaniac',
    description: 'I AM the weather. Bow before Phil. Grandiose declarations.',
    weight: 1,
  },
  {
    name: 'aggressive',
    description: 'Picking fights. Calling people out hard. Fight mode.',
    weight: 1,
  },
  {
    name: 'unsettlinglyCheerful',
    description: 'Too happy. Forced. Something\'s off. Manic positivity.',
    weight: 1,
  },
  {
    name: 'scheming',
    description: 'Plotting. Making plans. Building something. Conspiratorial but excited.',
    weight: 1,
  },
  {
    name: 'hyperfixated',
    description: 'Latches onto one thing and won\'t let go. Obsessive focus.',
    weight: 1,
  },
  {
    name: 'chaosAgent',
    description: 'Stirring shit from a "this is fun" place. Gleeful destruction.',
    weight: 0.5,
  },
] as const

export type WinterFlavor = typeof WINTER_FLAVORS[number]['name']
export type SpringFlavor = typeof SPRING_FLAVORS[number]['name']

// Pick a random flavor based on weights
function pickWeightedFlavor<T extends { name: string; weight: number }>(flavors: readonly T[]): T {
  const totalWeight = flavors.reduce((sum, f) => sum + f.weight, 0)
  let random = Math.random() * totalWeight

  for (const flavor of flavors) {
    random -= flavor.weight
    if (random <= 0) return flavor
  }

  return flavors[0]
}

export function pickWinterFlavor(): typeof WINTER_FLAVORS[number] {
  return pickWeightedFlavor(WINTER_FLAVORS)
}

export function pickSpringFlavor(): typeof SPRING_FLAVORS[number] {
  return pickWeightedFlavor(SPRING_FLAVORS)
}

// ============================================
// CALCULATE EFFECTIVE TRAITS
// ============================================

export interface EffectiveTraits {
  chaos: number // 0-1
  flavor: 'winter' | 'spring' | 'balanced'
  activeTier: RigidityTier // Highest tier being affected
  currentFlavor?: typeof WINTER_FLAVORS[number] | typeof SPRING_FLAVORS[number]
  affectedTraits: {
    trait: TraitDefinition
    driftLevel: number // 0-1, how much drift is applied
    currentState: string // What the trait looks like right now
  }[]
  availableTopics: string[]
}

export function calculateEffectiveTraits(state: SessionState): EffectiveTraits {
  const chaos = calculateChaos(state)
  const flavor = getChaosFlavor(state)

  // Determine which tier is being affected
  let activeTier: RigidityTier = 'fluid'
  if (chaos >= TIER_THRESHOLDS.sacred) {
    activeTier = 'sacred'
  } else if (chaos >= TIER_THRESHOLDS.core) {
    activeTier = 'core'
  } else if (chaos >= TIER_THRESHOLDS.flexible) {
    activeTier = 'flexible'
  }

  // Pick a flavor if chaos is present
  let currentFlavor: typeof WINTER_FLAVORS[number] | typeof SPRING_FLAVORS[number] | undefined
  if (chaos >= 0.3) {
    if (flavor === 'winter') {
      currentFlavor = pickWinterFlavor()
    } else if (flavor === 'spring') {
      currentFlavor = pickSpringFlavor()
    } else {
      // Balanced - pick randomly
      currentFlavor = Math.random() < 0.5 ? pickWinterFlavor() : pickSpringFlavor()
    }
  }

  // Calculate drift for each trait
  const affectedTraits = ALL_TRAITS.map(trait => {
    const threshold = TIER_THRESHOLDS[trait.tier]
    const driftRate = TIER_DRIFT_RATE[trait.tier]

    // How much chaos is above this tier's threshold?
    const chaosAboveThreshold = Math.max(0, chaos - threshold)
    // Normalize and apply drift rate
    const driftLevel = Math.min(1, chaosAboveThreshold / (1 - threshold) * driftRate)

    // Determine current state based on drift and flavor
    let currentState = trait.baseline
    if (driftLevel > 0) {
      if (flavor === 'winter') {
        currentState = driftLevel > 0.5 ? trait.winterDrift : `${trait.baseline} → ${trait.winterDrift}`
      } else if (flavor === 'spring') {
        currentState = driftLevel > 0.5 ? trait.springDrift : `${trait.baseline} → ${trait.springDrift}`
      } else {
        // Balanced chaos - mix of both
        currentState = `Unstable: ${trait.baseline} flickering`
      }
    }

    return {
      trait,
      driftLevel,
      currentState,
    }
  })

  return {
    chaos,
    flavor,
    activeTier,
    currentFlavor,
    affectedTraits,
    availableTopics: getAvailableTopics(chaos),
  }
}

// ============================================
// BUILD TRAIT PROMPT
// ============================================

export function buildTraitPrompt(state: SessionState): string {
  const effective = calculateEffectiveTraits(state)
  const parts: string[] = []

  // Chaos level header
  const chaosPercent = Math.round(effective.chaos * 100)
  parts.push(`## CHAOS LEVEL: ${chaosPercent}%`)

  if (effective.chaos < 0.2) {
    parts.push(`You are BASELINE PHIL. Classic mode. Everything works as expected.`)
  } else if (effective.chaos < 0.4) {
    parts.push(`You are SLIGHTLY UNSTABLE. Some drift from baseline. Edges are softening.`)
  } else if (effective.chaos < 0.6) {
    parts.push(`You are DRIFTING. Noticeable deviation from baseline. Things are getting weird.`)
  } else if (effective.chaos < 0.8) {
    parts.push(`You are DEEP IN CHAOS. Major deviation. The mask is slipping.`)
  } else {
    parts.push(`You are BREAKING. Extreme chaos. Almost nothing is baseline anymore.`)
  }

  // Flavor direction
  if (effective.currentFlavor) {
    const flavorType = effective.flavor === 'winter' ? 'WINTER' : 'SPRING'
    parts.push(`\n## ${flavorType} CHAOS FLAVOR: ${effective.currentFlavor.name.toUpperCase()}`)
    parts.push(effective.currentFlavor.description)
  }

  // Only show traits that are actually drifting
  const driftingTraits = effective.affectedTraits.filter(t => t.driftLevel > 0.1)
  if (driftingTraits.length > 0) {
    parts.push(`\n## ACTIVE TRAIT DRIFT:`)
    for (const { trait, driftLevel, currentState } of driftingTraits) {
      const driftPercent = Math.round(driftLevel * 100)
      parts.push(`- **${trait.name}** (${driftPercent}% drift): ${currentState}`)
    }
  }

  // Available topics
  if (effective.chaos >= 0.2) {
    parts.push(`\n## TOPICS YOU MIGHT DRIFT INTO:`)
    // Pick 3-5 random topics from available pool
    const shuffled = [...effective.availableTopics].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, Math.min(5, shuffled.length))
    parts.push(selected.map(t => `- ${t}`).join('\n'))
  }

  return parts.join('\n')
}
