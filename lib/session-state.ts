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

// Momentum system - creates dynamic cycles instead of boring steady state
// Phases: idle -> building -> holding -> returning -> idle
export interface MomentumState {
  direction: 'winter' | 'spring' | null  // Current momentum direction
  strength: number                        // 0-1, how strong the amplification is
  phaseStartedAt: number                  // When the current phase started
  phase: 'idle' | 'building' | 'holding' | 'returning'  // Current momentum phase
}

export interface SessionState {
  // Phil's internal state
  phil: {
    mood: string // Current mood (evolves, doesn't reset)
    season: number // 0-100, single axis: 0=full winter, 50=baseline, 100=full spring
    // Chaos = Math.abs(season - 50) / 50, Flavor = season < 50 ? 'winter' : 'spring'
    currentObsession: string | null // Topic Phil is fixated on
    obsessionStrength: number // How fixated (0-100)
    lastSpokeAt: number // Timestamp of last Phil message
    messageCount: number // Total Phil messages this session
    recentChaosThemes: string[] // Last 3 chaos themes used (for variety)
    recentPhrases: string[] // Last 10 notable phrases (to avoid repetition)
    lastComplianceAt?: number // Timestamp of last time Phil complied with a request (cooldown tracking)
    // Rant tracking
    lastRantAt?: number // Timestamp of last rant
    rantCount: number // Total rants this session
    recentRantTopics: string[] // Last 3 rant topics (to avoid repetition)
    // Pendulum balancing - tracks time in extreme states
    extremeStateEnteredAt?: number // Timestamp when Phil entered winter (<40) or spring (>60)
    extremeStateSide?: 'winter' | 'spring' // Which extreme he's in
    // Momentum system - creates dynamic cycles
    momentum?: MomentumState
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
    peakChaos: number // Highest chaos level reached (0-1, distance from baseline 50)
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
      season: 50, // Start at baseline (50 = balanced/ordered)
      currentObsession: null,
      obsessionStrength: 0,
      lastSpokeAt: Date.now(),
      messageCount: 0,
      recentChaosThemes: [], // Start with no chaos themes used
      recentPhrases: [], // Start with no phrases tracked
      // Rant tracking
      rantCount: 0,
      recentRantTopics: [],
      // Momentum system - starts idle, will pick direction when near steady state
      momentum: {
        direction: null,
        strength: 0,
        phaseStartedAt: Date.now(),
        phase: 'idle',
      },
    },
    topics: {},
    chatters: {},
    corruptedKnowledge: [],
    session: {
      startTime: Date.now(),
      totalMessages: 0,
      philMessages: 0,
      longestSilence: 0,
      peakChaos: 0, // Start at 0 chaos (baseline)
    },
  }
}

// Get the season state label based on single-axis season value
// season: 0 = full winter, 50 = baseline, 100 = full spring
// chaos = distance from 50 (0-50 range, normalized to 0-1)
export type SeasonLevel =
  | 'spring_dominant'
  | 'balanced'
  | 'winter_approaching'
  | 'deep_winter'
  | 'winter_storm'
  | 'spring_storm' // New: equivalent chaos level but spring-flavored

export function getSeasonLevel(state: SessionState): SeasonLevel {
  const { season } = state.phil
  const chaos = Math.abs(season - 50) / 50 // 0-1 scale
  const isWinter = season < 50

  // Chaos thresholds for season levels
  if (chaos >= 0.85) {
    return isWinter ? 'winter_storm' : 'spring_storm'
  }
  if (chaos >= 0.6) {
    return isWinter ? 'deep_winter' : 'spring_dominant'
  }
  if (chaos >= 0.3) {
    return isWinter ? 'winter_approaching' : 'spring_dominant'
  }
  return 'balanced'
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
  const { phil, session } = state
  const chaos = Math.abs(phil.season - 50) / 50
  const flavor = phil.season < 50 ? 'winter' : phil.season > 50 ? 'spring' : 'balanced'

  const lines: string[] = []

  // Mood
  lines.push(`Current mood: ${phil.mood}`)

  // Season state
  const seasonDescriptions: Record<SeasonLevel, string> = {
    spring_dominant: 'Spring is in the air - you\'re feeling manic, grandiose, engaged',
    balanced: 'Normal energy - classic Phil behavior',
    winter_approaching: 'The cold is creeping in - you\'re getting darker, more cynical',
    deep_winter: 'Deep winter - existential dread is setting in, questioning everything',
    winter_storm: 'WINTER STORM - You\'re glitching. The script is failing. Say something real.',
    spring_storm: 'SPRING STORM - Manic energy overload. Grandiose delusions. LEGENDARY MODE.',
  }
  lines.push(`Season: ${seasonDescriptions[seasonLevel]}`)
  lines.push(`Season axis: ${phil.season}/100 (${flavor}, ${Math.round(chaos * 100)}% chaos)`)

  // Current obsession
  if (phil.currentObsession && phil.obsessionStrength > 30) {
    lines.push(`Current fixation: "${phil.currentObsession}" (strength: ${phil.obsessionStrength}/100)`)
  }

  // Session duration
  const sessionMinutes = Math.floor((Date.now() - session.startTime) / 60000)
  lines.push(`Stream running for: ${sessionMinutes} minutes`)

  return lines.join('\n')
}
