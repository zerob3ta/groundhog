// Memory System Types
// Persistent storage types for Phil's long-term memory

// ============================================
// REGULAR CHATTERS
// ============================================

export type ChatterRelationship = 'stranger' | 'familiar' | 'regular' | 'favorite' | 'nemesis'

export interface PersistentChatter {
  username: string
  firstSeen: number                    // Unix timestamp
  lastSeen: number                     // Unix timestamp
  totalVisits: number                  // Number of sessions
  totalInteractions: number            // Total messages sent
  relationship: ChatterRelationship
  relationshipScore: number            // -100 to 100
  philNickname: string | null          // "the conspiracy nut", "shadow skeptic"
  notableQuotes: string[]              // Max 5 memorable things they said
  notableRoasts: string[]              // Max 3 times Phil destroyed them
  corruptedFacts: string[]             // Things they "taught" Phil
  typicalBehavior: string | null       // "always asks about shadows"
}

// ============================================
// NOTABLE MOMENTS
// ============================================

export type MomentType = 'epic_rant' | 'legendary_roast' | 'meltdown' | 'wholesome_crack' | 'chaos_peak'

export type MomentTone = 'light' | 'medium' | 'heavy' | 'dark'

export type AudienceReaction = 'enthusiastic' | 'silent' | 'concerned' | 'pushback' | 'pile_on' | 'mixed'

export type TargetResponse = 'laughed_off' | 'fought_back' | 'left' | 'silent' | 'none'

export type FeltLike = 'triumph' | 'alienation' | 'guilt' | 'power' | 'connection' | 'emptiness' | 'uncertainty'

export interface MomentAftermath {
  audienceReaction: AudienceReaction
  reactionIntensity: number            // 0-10, how strong was the reaction
  targetResponse?: TargetResponse       // If there was a target, how did they respond
  chatMessagesAfter: number            // How many messages in 30 seconds after

  // Phil's read on it (can be reinterpreted based on state when remembering)
  feltLike?: FeltLike
}

export interface NotableMoment {
  id: string
  timestamp: number
  type: MomentType
  philQuote: string                    // The key line from Phil
  context: string                      // Who triggered it, topic
  involvedUsers: string[]
  chaosLevel: number                   // 0-1 chaos at time of moment
  chaosFlavor: 'winter' | 'spring' | 'baseline'  // Which side of chaos
  mood: string                         // Phil's mood at time
  timesReferenced: number              // How often Phil has called back to this

  // Tone and weight
  tone: MomentTone                     // How heavy/dark is this memory
  energyEffect: number                 // -10 to +10, how it affects Phil when surfaced

  // Aftermath - what happened after Phil said this
  aftermath?: MomentAftermath
}

// ============================================
// CORRUPTED KNOWLEDGE (Persistent)
// ============================================

export interface PersistentFact {
  id: string
  fact: string                         // The "fact" Phil believes
  source: string                       // Who taught Phil this
  firstLearned: number                 // Unix timestamp
  confidence: number                   // 0-100
  reinforcements: number               // Times confirmed by others
  challenges: number                   // Times contradicted
  timesStated: number                  // Times Phil has repeated this
}

// ============================================
// EMERGENT TRUTHS - Phil's own realizations
// ============================================

export type TruthType = 'question' | 'theory' | 'pattern' | 'anchor'

export type TruthOrigin = 'meltdown' | 'pattern_detection' | 'repeated_topic' | 'aftermath_interpretation' | 'random'

export interface EmergentTruth {
  id: string
  truth: string                        // The statement/question itself
  type: TruthType

  // Origin
  origin: TruthOrigin
  originMomentId?: string              // If born from a specific moment
  firstEmerged: number                 // Unix timestamp

  // Strength
  confidence: number                   // 0-100, how "true" this feels to Phil
  timesReinforced: number              // Interactions that supported it
  timesChallenged: number              // Interactions that contradicted it
  timesStated: number                  // How often Phil has said this

  // Character
  tone: MomentTone                     // light/medium/heavy/dark
  triggerTopics: string[]              // Topics that bring this up
  triggerStates: string[]              // Moods/states where this surfaces

  // Timestamps
  lastReinforced?: number
  lastChallenged?: number
  lastStated?: number
}

// Truth confidence thresholds
export const TRUTH_THRESHOLDS = {
  stateAsFact: 70,                     // Phil states it as fact
  bringUpAsTheory: 40,                 // Phil brings it up as theory/question
  onlySurfacesInMatchingState: 40,     // Below this, only surfaces in matching states
  fadeAway: 10,                        // Below this, truth is forgotten
}

// How truths gain/lose confidence
export const TRUTH_CONFIDENCE_CHANGES = {
  reinforced: 5,                       // Someone/something supports it
  challenged: -10,                     // Someone contradicts it
  statedByPhil: 2,                     // Phil saying it reinforces it
  decayPerSession: -1,                 // Slow decay if not reinforced
  meltdownOriginBonus: 15,             // Truths born from meltdowns start stronger
  patternDetectionBonus: 10,           // Truths from pattern detection
}

// ============================================
// PERSONALITY EVOLUTION
// ============================================

export interface TopicAffinity {
  topic: string
  affinity: number                     // -100 (hated) to 100 (loved)
}

export interface EmergentGag {
  gag: string                          // The joke/bit
  origin: string                       // How it started
  timesUsed: number
}

export interface PersonalityEvolution {
  // Drift values (-20 to +20 from baseline)
  aggression: number
  paranoia: number
  grandiosity: number
  philosophicalDepth: number

  // Accumulated preferences
  favoriteTopics: TopicAffinity[]
  hatedTopics: TopicAffinity[]

  // Emergent behaviors
  emergentGags: EmergentGag[]
  selfAwareMoments: string[]           // Things Phil has "realized"

  // Stats
  totalSessions: number
  totalMessages: number
  peakChaosEver: number

  // Timestamps
  lastUpdated: number
}

// ============================================
// MEMORY SESSION STATE
// ============================================

// In-memory cache for the current session
export interface MemorySessionCache {
  // Chatters loaded this session (lazy loaded)
  loadedChatters: Map<string, PersistentChatter>
  dirtyChatterUsernames: Set<string>   // Chatters that need to be flushed to KV

  // Recent moments (loaded at session start)
  recentMoments: NotableMoment[]
  newMoments: NotableMoment[]          // New moments to be saved
  pendingAftermathMomentId: string | null  // Moment awaiting aftermath capture

  // Active facts (loaded at session start)
  activeFacts: PersistentFact[]
  dirtyFactIds: Set<string>            // Facts that need updating
  newFacts: PersistentFact[]           // New facts to be saved

  // Emergent truths (loaded at session start)
  activeTruths: EmergentTruth[]
  dirtyTruthIds: Set<string>           // Truths that need updating
  newTruths: EmergentTruth[]           // New truths to be saved

  // Personality (loaded at session start)
  personality: PersonalityEvolution | null
  personalityDirty: boolean

  // Session tracking
  sessionStartedAt: number
  lastFlushAt: number

  // Topic tracking for pattern detection
  topicMentions: Map<string, number>   // topic -> count this session
}

// ============================================
// MEMORY WEIGHT TRACKING
// ============================================

// Track cumulative memory weight during session
export interface MemoryWeight {
  lightMemoriesSurfaced: number
  darkMemoriesSurfaced: number
  netEnergy: number                    // Sum of energyEffects from surfaced memories
}

// ============================================
// RECOGNITION CONFIG
// ============================================

export interface RecognitionConfig {
  relationship: ChatterRelationship
  minVisits: number
  recognitionChance: number            // 0-1
  misrememberChance: number            // 0-1, decreases with visits
  style: 'none' | 'vague' | 'casual' | 'specific'
}

export const RECOGNITION_RULES: RecognitionConfig[] = [
  { relationship: 'stranger', minVisits: 1, recognitionChance: 0, misrememberChance: 0.5, style: 'none' },
  { relationship: 'familiar', minVisits: 3, recognitionChance: 0.3, misrememberChance: 0.3, style: 'vague' },
  { relationship: 'regular', minVisits: 6, recognitionChance: 0.6, misrememberChance: 0.2, style: 'casual' },
  { relationship: 'favorite', minVisits: 16, recognitionChance: 0.8, misrememberChance: 0.1, style: 'specific' },
  { relationship: 'nemesis', minVisits: 16, recognitionChance: 0.8, misrememberChance: 0.1, style: 'specific' },
]

// ============================================
// NOTABILITY SCORING
// ============================================

export interface NotabilityScore {
  total: number                        // 0-100, >= 50 = notable
  chaosContribution: number            // 0-30
  rantContribution: number             // 0-30
  lengthContribution: number           // 0-15
  moodContribution: number             // 0-15
  targetContribution: number           // 0-10
}

// ============================================
// PERSONALITY DRIFT
// ============================================

export interface DriftEvent {
  trait: keyof Pick<PersonalityEvolution, 'aggression' | 'paranoia' | 'grandiosity' | 'philosophicalDepth'>
  amount: number
  reason: string
}

export const DRIFT_CAPS = {
  min: -20,
  max: 20,
}

export const DRIFT_DECAY = 0.1  // Per session decay toward 0

// ============================================
// FLUSH CONFIG
// ============================================

export const FLUSH_CONFIG = {
  intervalMs: 30000,                   // 30 second flush interval
  maxDirtyBeforeFlush: 10,             // Force flush if this many dirty records
}

// ============================================
// KV KEY PATTERNS
// ============================================

export const KV_KEYS = {
  chatter: (username: string) => `chatter:${username.toLowerCase()}`,
  moment: (id: string) => `moment:${id}`,
  momentsRecent: 'moments:recent',      // List of last 50 moment IDs
  fact: (id: string) => `fact:${id}`,
  factsActive: 'facts:active',          // List of active fact IDs
  truth: (id: string) => `truth:${id}`,
  truthsActive: 'truths:active',        // List of active truth IDs
  personality: 'phil:personality',
}

// Max items in lists
export const KV_LIMITS = {
  recentMoments: 50,
  activeFacts: 100,
  activeTruths: 50,
  notableQuotes: 5,
  notableRoasts: 3,
  corruptedFacts: 10,
  emergentGags: 20,
  selfAwareMoments: 10,
  favoriteTopics: 10,
  hatedTopics: 10,
}
