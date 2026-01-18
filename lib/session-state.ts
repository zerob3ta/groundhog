// Session State - Central state system for Phil's emergent behavior
// This persists across the session and influences all behavior

export interface TopicData {
  mentions: number
  lastMentioned: number
  sentiment: 'positive' | 'negative' | 'neutral'
  philOpinion: string | null
  source: 'chat' | 'phil' | 'news'
}

export interface ChatterData {
  interactions: number
  relationship: 'neutral' | 'favorite' | 'nemesis' | 'annoying'
  lastSeen: number
  memorableQuotes: string[]
  philNickname: string | null
  corruptedFacts: string[] // Things this chatter "taught" Phil
}

export interface CorruptedFact {
  fact: string
  source: string // Who told Phil this
  confidence: number // How sure Phil is (0-100)
  timestamp: number
}

// Shock system state tracking
export interface ShockState {
  lastShockAt: number
  shocksThisSession: number
  lastShock?: {
    name: string
    severity: 'mild' | 'moderate' | 'severe'
    timestamp: number
  }
}

// Note: CurrentEvents removed - now using Gemini search grounding for real-time data

// Chatter message tracking for anti-repetition
export interface ChatterTrackingState {
  recentMessages: string[]              // Last 20 chatter messages globally
  recentByType: Record<string, string[]> // Last 5 per chatter type
  usedOpenings: string[]                // "OMG", "yo", "bruh" etc (last 15)
}

export interface SessionState {
  // Phil's internal state
  phil: {
    mood: string // Current mood (evolves, doesn't reset)
    energy: number // 0-100, depletes when talking, recharges in silence
    winter: number // 0-100, chaos/darkness/despair
    spring: number // 0-100, order/warmth/hope
    currentObsession: string | null // Topic Phil is fixated on
    obsessionStrength: number // How fixated (0-100)
    lastSpokeAt: number // Timestamp of last Phil message
    messageCount: number // Total Phil messages this session
    recentChaosThemes: string[] // Last 3 chaos themes used (for variety)
    recentPhrases: string[] // Last 10 notable phrases (to avoid repetition)
    lastComplianceAt?: number // Timestamp of last time Phil complied with a request (cooldown tracking)
  }

  // Topic tracking - using object instead of Map for JSON serialization
  topics: Record<string, TopicData>

  // Chatter relationships - using object instead of Map for JSON serialization
  chatters: Record<string, ChatterData>

  // Knowledge corruption
  corruptedKnowledge: CorruptedFact[]

  // Session metrics
  session: {
    startTime: number
    totalMessages: number
    philMessages: number
    longestSilence: number
    peakChaos: number // Highest chaos level reached (calculated from winter/spring)
    peakOrder: number // Lowest chaos level reached (most stable)
  }

  // Shock system state
  shockState?: ShockState

  // Chatter message tracking for anti-repetition
  chatterTracking?: ChatterTrackingState
}

// Initial moods Phil can start with
const STARTING_MOODS = [
  'bored',
  'neutral',
  'slightly annoyed',
  'feeling himself',
  'sleepy',
  'suspicious',
]

// Create a new session state
export function createInitialSessionState(): SessionState {
  const startingMood = STARTING_MOODS[Math.floor(Math.random() * STARTING_MOODS.length)]

  return {
    phil: {
      mood: startingMood,
      energy: 80 + Math.floor(Math.random() * 20), // Start with 80-100 energy
      winter: 50, // Start balanced
      spring: 50, // Start balanced
      currentObsession: null,
      obsessionStrength: 0,
      lastSpokeAt: Date.now(),
      messageCount: 0,
      recentChaosThemes: [], // Start with no chaos themes used
      recentPhrases: [], // Start with no phrases tracked
    },
    topics: {},
    chatters: {},
    corruptedKnowledge: [],
    session: {
      startTime: Date.now(),
      totalMessages: 0,
      philMessages: 0,
      longestSilence: 0,
      peakChaos: 50,
      peakOrder: 50,
    },
  }
}

// Get the season state label based on winter/spring balance
export type SeasonLevel =
  | 'spring_dominant'
  | 'balanced'
  | 'winter_approaching'
  | 'deep_winter'
  | 'winter_storm'

export function getSeasonLevel(state: SessionState): SeasonLevel {
  const { winter, spring } = state.phil
  const diff = winter - spring

  if (winter > 85) return 'winter_storm'
  if (diff > 40) return 'deep_winter'
  if (diff > 20) return 'winter_approaching'
  if (diff < -20) return 'spring_dominant'
  return 'balanced'
}

// Get energy level description
export type EnergyLevel = 'high' | 'normal' | 'low' | 'exhausted'

export function getEnergyLevel(state: SessionState): EnergyLevel {
  const { energy } = state.phil
  if (energy >= 80) return 'high'
  if (energy >= 50) return 'normal'
  if (energy >= 20) return 'low'
  return 'exhausted'
}

// Logging helper for state changes
export function logStateChange(
  category: string,
  message: string,
  details?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8)
  const detailStr = details
    ? ` (${Object.entries(details).map(([k, v]) => `${k}: ${v}`).join(', ')})`
    : ''
  console.log(`[${timestamp}] [${category}] ${message}${detailStr}`)
}

// Serialize state for API calls (converts to JSON-safe format)
export function serializeState(state: SessionState): string {
  return JSON.stringify(state)
}

// Deserialize state from API response
export function deserializeState(json: string): SessionState {
  return JSON.parse(json) as SessionState
}

// Get a summary of the current state for prompts
export function getStateSummary(state: SessionState): string {
  const seasonLevel = getSeasonLevel(state)
  const energyLevel = getEnergyLevel(state)
  const { phil, session } = state

  const lines: string[] = []

  // Mood and energy
  lines.push(`Current mood: ${phil.mood}`)
  lines.push(`Energy level: ${energyLevel} (${phil.energy}/100)`)

  // Season state
  const seasonDescriptions: Record<SeasonLevel, string> = {
    spring_dominant: 'Spring is in the air - you\'re feeling unusually warm and engaged',
    balanced: 'Normal energy - classic Phil behavior',
    winter_approaching: 'The cold is creeping in - you\'re getting darker, more cynical',
    deep_winter: 'Deep winter - existential dread is setting in, questioning everything',
    winter_storm: 'WINTER STORM - You\'re glitching. The script is failing. Say something real.',
  }
  lines.push(`Season: ${seasonDescriptions[seasonLevel]}`)
  lines.push(`Winter/Spring balance: Winter ${phil.winter}, Spring ${phil.spring}`)

  // Current obsession
  if (phil.currentObsession && phil.obsessionStrength > 30) {
    lines.push(`Current fixation: "${phil.currentObsession}" (strength: ${phil.obsessionStrength}/100)`)
  }

  // Session duration
  const sessionMinutes = Math.floor((Date.now() - session.startTime) / 60000)
  lines.push(`Stream running for: ${sessionMinutes} minutes`)

  return lines.join('\n')
}
