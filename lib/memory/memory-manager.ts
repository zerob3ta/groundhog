// Memory Manager - Orchestrates all memory operations
// Handles caching, dirty tracking, and flush coordination

import type { SessionState, CorruptedFact } from '../session-state'
import type { RantAnalysis } from '../rant-detector'
import type { BroadcastMessage } from '@/lib/broadcast/types'
import {
  type PersistentChatter,
  type NotableMoment,
  type PersistentFact,
  type PersonalityEvolution,
  type MemorySessionCache,
  type ChatterRelationship,
  type EmergentTruth,
  RECOGNITION_RULES,
  FLUSH_CONFIG,
  KV_LIMITS,
} from './types'
import * as kv from './kv-client'
import { checkAndCreateMoment } from './notability'
import { analyzeAftermath, isAftermathReady } from './aftermath'
import {
  decayTruth,
  shouldForgetTruth,
  getRelevantTruths,
  canStateAsFact,
  canBringUpAsTheory,
} from './truths'
import {
  createInitialPersonality,
  updatePersonalityEndOfSession,
} from './personality'

// Global singleton for memory manager
let memoryManager: MemoryManager | null = null

export class MemoryManager {
  private cache: MemorySessionCache
  private flushTimer: NodeJS.Timeout | null = null
  private isInitialized: boolean = false

  constructor() {
    this.cache = this.createEmptyCache()
  }

  private createEmptyCache(): MemorySessionCache {
    return {
      loadedChatters: new Map(),
      dirtyChatterUsernames: new Set(),
      recentMoments: [],
      newMoments: [],
      pendingAftermathMomentId: null,
      activeFacts: [],
      dirtyFactIds: new Set(),
      newFacts: [],
      activeTruths: [],
      dirtyTruthIds: new Set(),
      newTruths: [],
      personality: null,
      personalityDirty: false,
      sessionStartedAt: Date.now(),
      lastFlushAt: Date.now(),
      topicMentions: new Map(),
    }
  }

  /**
   * Initialize memory manager - load initial data from KV
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    if (!kv.isMemoryEnabled()) {
      console.log('[Memory] Memory system disabled - running without persistence')
      this.isInitialized = true
      return
    }

    console.log('[Memory] Initializing memory manager...')

    try {
      // Load personality
      const personality = await kv.getPersonality()
      this.cache.personality = personality || createInitialPersonality()
      console.log(`[Memory] Loaded personality: ${this.cache.personality.totalSessions} sessions`)

      // Load recent moments
      this.cache.recentMoments = await kv.getRecentMoments(10)
      console.log(`[Memory] Loaded ${this.cache.recentMoments.length} recent moments`)

      // Load active facts
      this.cache.activeFacts = await kv.getActiveFacts(30)
      console.log(`[Memory] Loaded ${this.cache.activeFacts.length} active facts`)

      // Load active truths
      this.cache.activeTruths = await kv.getActiveTruths(10)
      console.log(`[Memory] Loaded ${this.cache.activeTruths.length} active truths`)

      // Start flush timer
      this.startFlushTimer()

      this.isInitialized = true
      console.log('[Memory] Memory manager initialized')
    } catch (error) {
      console.error('[Memory] Initialization error:', error)
      this.isInitialized = true  // Continue without memory
    }
  }

  /**
   * Start the periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) return

    this.flushTimer = setInterval(async () => {
      await this.flush()
    }, FLUSH_CONFIG.intervalMs)
  }

  /**
   * Stop the flush timer
   */
  stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
  }

  /**
   * Flush dirty records to KV
   */
  async flush(): Promise<void> {
    if (!kv.isMemoryEnabled()) return

    const hasDirtyData =
      this.cache.dirtyChatterUsernames.size > 0 ||
      this.cache.newMoments.length > 0 ||
      this.cache.dirtyFactIds.size > 0 ||
      this.cache.newFacts.length > 0 ||
      this.cache.dirtyTruthIds.size > 0 ||
      this.cache.newTruths.length > 0 ||
      this.cache.personalityDirty

    if (!hasDirtyData) return

    console.log('[Memory] Flushing dirty records...')

    try {
      // Collect dirty chatters
      const dirtyChatters: PersistentChatter[] = []
      Array.from(this.cache.dirtyChatterUsernames).forEach(username => {
        const chatter = this.cache.loadedChatters.get(username.toLowerCase())
        if (chatter) dirtyChatters.push(chatter)
      })

      // Collect dirty facts
      const dirtyFacts: PersistentFact[] = []
      Array.from(this.cache.dirtyFactIds).forEach(id => {
        const fact = this.cache.activeFacts.find(f => f.id === id)
        if (fact) dirtyFacts.push(fact)
      })

      // Collect dirty truths
      const dirtyTruths: EmergentTruth[] = []
      Array.from(this.cache.dirtyTruthIds).forEach(id => {
        const truth = this.cache.activeTruths.find(t => t.id === id)
        if (truth) dirtyTruths.push(truth)
      })

      // Batch write
      await kv.batchWrite({
        chatters: dirtyChatters,
        moments: this.cache.newMoments,
        facts: [...this.cache.newFacts, ...dirtyFacts],
        truths: [...this.cache.newTruths, ...dirtyTruths],
        personality: this.cache.personalityDirty ? this.cache.personality! : undefined,
      })

      // Clear dirty flags
      this.cache.dirtyChatterUsernames.clear()
      this.cache.newMoments = []
      this.cache.dirtyFactIds.clear()
      this.cache.newFacts = []
      this.cache.dirtyTruthIds.clear()
      this.cache.newTruths = []
      this.cache.personalityDirty = false
      this.cache.lastFlushAt = Date.now()

    } catch (error) {
      console.error('[Memory] Flush error:', error)
    }
  }

  // ============================================
  // CHATTER OPERATIONS
  // ============================================

  /**
   * Get or load a chatter by username
   * Uses lazy loading - only fetches from KV when needed
   */
  async getChatter(username: string): Promise<PersistentChatter | null> {
    const key = username.toLowerCase()

    // Check cache first
    if (this.cache.loadedChatters.has(key)) {
      return this.cache.loadedChatters.get(key)!
    }

    // Load from KV if enabled
    if (kv.isMemoryEnabled()) {
      const chatter = await kv.getChatter(key)
      if (chatter) {
        this.cache.loadedChatters.set(key, chatter)
        return chatter
      }
    }

    return null
  }

  /**
   * Create or update a chatter record
   */
  async trackChatterInteraction(
    username: string,
    messageText: string,
    wasRoasted: boolean = false,
    roastText?: string,
  ): Promise<PersistentChatter> {
    const key = username.toLowerCase()
    let chatter = await this.getChatter(username)
    const now = Date.now()
    const isNewVisit = !chatter || (now - chatter.lastSeen > 3600000)  // 1 hour = new visit

    if (!chatter) {
      // Create new chatter
      chatter = {
        username: key,
        firstSeen: now,
        lastSeen: now,
        totalVisits: 1,
        totalInteractions: 1,
        relationship: 'stranger',
        relationshipScore: 0,
        philNickname: null,
        notableQuotes: [],
        notableRoasts: [],
        corruptedFacts: [],
        typicalBehavior: null,
      }
    } else {
      // Update existing chatter
      chatter.lastSeen = now
      chatter.totalInteractions++
      if (isNewVisit) {
        chatter.totalVisits++
      }
    }

    // Update relationship based on visits
    chatter.relationship = this.calculateRelationship(chatter)

    // Track notable quote (randomly, with limits)
    if (messageText.length > 10 && Math.random() < 0.1) {
      if (chatter.notableQuotes.length < KV_LIMITS.notableQuotes) {
        chatter.notableQuotes.push(messageText.slice(0, 100))
      } else if (Math.random() < 0.2) {
        // Replace oldest quote 20% of the time
        chatter.notableQuotes.shift()
        chatter.notableQuotes.push(messageText.slice(0, 100))
      }
    }

    // Track roasts
    if (wasRoasted && roastText) {
      if (chatter.notableRoasts.length < KV_LIMITS.notableRoasts) {
        chatter.notableRoasts.push(roastText.slice(0, 100))
      }
      // Roasts decrease relationship score
      chatter.relationshipScore = Math.max(-100, chatter.relationshipScore - 5)
    }

    // Save to cache and mark dirty
    this.cache.loadedChatters.set(key, chatter)
    this.cache.dirtyChatterUsernames.add(key)

    // Force flush if too many dirty records
    if (this.cache.dirtyChatterUsernames.size >= FLUSH_CONFIG.maxDirtyBeforeFlush) {
      await this.flush()
    }

    return chatter
  }

  /**
   * Calculate relationship level based on visits
   */
  private calculateRelationship(chatter: PersistentChatter): ChatterRelationship {
    const visits = chatter.totalVisits

    // Check for nemesis (many visits + very negative score)
    if (visits >= 16 && chatter.relationshipScore <= -50) {
      return 'nemesis'
    }

    // Check for favorite (many visits + positive score)
    if (visits >= 16 && chatter.relationshipScore >= 30) {
      return 'favorite'
    }

    // Standard progression
    if (visits >= 16) return 'regular'  // High visit count but neutral score
    if (visits >= 6) return 'regular'
    if (visits >= 3) return 'familiar'
    return 'stranger'
  }

  /**
   * Add a corrupted fact taught by a chatter
   */
  async trackCorruptedFact(username: string, fact: string): Promise<void> {
    const chatter = await this.getChatter(username)
    if (chatter) {
      if (chatter.corruptedFacts.length < KV_LIMITS.corruptedFacts) {
        chatter.corruptedFacts.push(fact)
        this.cache.dirtyChatterUsernames.add(username.toLowerCase())
      }
    }
  }

  /**
   * Update Phil's nickname for a chatter
   */
  async setChatterNickname(username: string, nickname: string): Promise<void> {
    const chatter = await this.getChatter(username)
    if (chatter) {
      chatter.philNickname = nickname
      this.cache.dirtyChatterUsernames.add(username.toLowerCase())
    }
  }

  /**
   * Get recognition context for a chatter
   */
  async getRecognitionContext(username: string): Promise<{
    shouldRecognize: boolean
    style: 'none' | 'vague' | 'casual' | 'specific'
    shouldMisremember: boolean
    chatter: PersistentChatter | null
  }> {
    const chatter = await this.getChatter(username)

    if (!chatter) {
      return {
        shouldRecognize: false,
        style: 'none',
        shouldMisremember: false,
        chatter: null,
      }
    }

    const rule = RECOGNITION_RULES.find(r => r.relationship === chatter.relationship) ||
                 RECOGNITION_RULES[0]

    const shouldRecognize = Math.random() < rule.recognitionChance
    const shouldMisremember = shouldRecognize && Math.random() < rule.misrememberChance

    return {
      shouldRecognize,
      style: rule.style,
      shouldMisremember,
      chatter,
    }
  }

  // ============================================
  // MOMENT OPERATIONS
  // ============================================

  /**
   * Check and potentially save a notable moment
   * @param excludeUsernames - Set of usernames to exclude from involvedUsers (e.g., fake chatters)
   */
  checkAndSaveMoment(
    message: string,
    state: SessionState,
    rantAnalysis: RantAnalysis | null,
    triggerUser?: string,
    excludeUsernames?: Set<string>,
  ): NotableMoment | null {
    const moment = checkAndCreateMoment(message, state, rantAnalysis, triggerUser, excludeUsernames)

    if (moment) {
      this.cache.newMoments.push(moment)
      this.cache.recentMoments.unshift(moment)
      this.cache.recentMoments = this.cache.recentMoments.slice(0, 10)
    }

    return moment
  }

  /**
   * Get recent moments for prompt context
   */
  getRecentMoments(): NotableMoment[] {
    return this.cache.recentMoments
  }

  /**
   * Increment times a moment was referenced
   */
  async markMomentReferenced(momentId: string): Promise<void> {
    const moment = this.cache.recentMoments.find(m => m.id === momentId)
    if (moment) {
      moment.timesReferenced++
      // Note: We don't persist this immediately, it'll be saved on next batch write
    }
  }

  // ============================================
  // FACT OPERATIONS
  // ============================================

  /**
   * Add or update a persistent fact
   */
  addOrUpdateFact(sessionFact: CorruptedFact): PersistentFact {
    const existingIndex = this.cache.activeFacts.findIndex(
      f => f.fact.toLowerCase() === sessionFact.fact.toLowerCase()
    )

    if (existingIndex >= 0) {
      // Reinforce existing fact
      const existing = this.cache.activeFacts[existingIndex]
      existing.reinforcements++
      existing.confidence = Math.min(100, existing.confidence + 10)
      this.cache.dirtyFactIds.add(existing.id)
      return existing
    }

    // Create new persistent fact
    const newFact: PersistentFact = {
      id: `fact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fact: sessionFact.fact,
      source: sessionFact.source,
      firstLearned: sessionFact.timestamp,
      confidence: sessionFact.confidence,
      reinforcements: 0,
      challenges: 0,
      timesStated: 0,
    }

    this.cache.activeFacts.push(newFact)
    this.cache.newFacts.push(newFact)

    console.log(`[Memory] New fact learned from ${newFact.source}: "${newFact.fact}"`)
    return newFact
  }

  /**
   * Challenge a fact (someone contradicted it)
   */
  challengeFact(factId: string): void {
    const fact = this.cache.activeFacts.find(f => f.id === factId)
    if (fact) {
      fact.challenges++
      fact.confidence = Math.max(0, fact.confidence - 15)
      this.cache.dirtyFactIds.add(fact.id)

      // Remove fact if confidence drops to 0
      if (fact.confidence <= 0) {
        this.cache.activeFacts = this.cache.activeFacts.filter(f => f.id !== factId)
        console.log(`[Memory] Fact forgotten: "${fact.fact}"`)
      }
    }
  }

  /**
   * Mark a fact as stated by Phil
   */
  markFactStated(factId: string): void {
    const fact = this.cache.activeFacts.find(f => f.id === factId)
    if (fact) {
      fact.timesStated++
      this.cache.dirtyFactIds.add(fact.id)
    }
  }

  /**
   * Get active facts for prompt context
   */
  getActiveFacts(): PersistentFact[] {
    return this.cache.activeFacts.filter(f => f.confidence >= 30)
  }

  /**
   * Sync session facts with persistent storage
   */
  syncSessionFacts(sessionFacts: CorruptedFact[]): void {
    for (const sessionFact of sessionFacts) {
      this.addOrUpdateFact(sessionFact)
    }
  }

  // ============================================
  // AFTERMATH OPERATIONS
  // ============================================

  /**
   * Set a moment as pending aftermath capture
   */
  setPendingAftermath(momentId: string): void {
    this.cache.pendingAftermathMomentId = momentId
  }

  /**
   * Check if there's a pending aftermath and capture it if ready
   */
  checkAndCaptureAftermath(messagesAfter: BroadcastMessage[]): void {
    if (!this.cache.pendingAftermathMomentId) return

    const moment = this.cache.recentMoments.find(
      m => m.id === this.cache.pendingAftermathMomentId
    )

    if (!moment) {
      this.cache.pendingAftermathMomentId = null
      return
    }

    if (!isAftermathReady(moment)) {
      return  // Not enough time has passed
    }

    // Capture the aftermath
    const aftermath = analyzeAftermath(moment, messagesAfter)
    moment.aftermath = aftermath

    console.log(`[Memory] Captured aftermath for moment ${moment.id}:`, {
      reaction: aftermath.audienceReaction,
      intensity: aftermath.reactionIntensity,
      feltLike: aftermath.feltLike,
    })

    // Clear pending
    this.cache.pendingAftermathMomentId = null
  }

  // ============================================
  // TRUTH OPERATIONS
  // ============================================

  /**
   * Add a new emergent truth
   */
  addTruth(truth: EmergentTruth): void {
    // Check for duplicate
    const existing = this.cache.activeTruths.find(
      t => t.truth.toLowerCase() === truth.truth.toLowerCase()
    )
    if (existing) {
      // Reinforce existing truth instead
      existing.timesReinforced++
      existing.confidence = Math.min(100, existing.confidence + 5)
      this.cache.dirtyTruthIds.add(existing.id)
      return
    }

    this.cache.activeTruths.push(truth)
    this.cache.newTruths.push(truth)
    console.log(`[Memory] New truth emerged: "${truth.truth}" (type: ${truth.type})`)
  }

  /**
   * Get truths relevant to current state/mood
   */
  getRelevantTruths(currentState: SessionState): EmergentTruth[] {
    return getRelevantTruths(
      this.cache.activeTruths,
      currentState,
      currentState.phil.mood
    )
  }

  /**
   * Get truths that Phil can state as fact
   */
  getFactLevelTruths(): EmergentTruth[] {
    return this.cache.activeTruths.filter(t => canStateAsFact(t))
  }

  /**
   * Get truths that Phil can bring up as theories
   */
  getTheoryLevelTruths(): EmergentTruth[] {
    return this.cache.activeTruths.filter(t => canBringUpAsTheory(t))
  }

  /**
   * Mark a truth as stated by Phil
   */
  markTruthStated(truthId: string): void {
    const truth = this.cache.activeTruths.find(t => t.id === truthId)
    if (truth) {
      truth.timesStated++
      truth.confidence = Math.min(100, truth.confidence + 2)
      truth.lastStated = Date.now()
      this.cache.dirtyTruthIds.add(truth.id)
    }
  }

  /**
   * Reinforce a truth (something confirmed it)
   */
  reinforceTruth(truthId: string): void {
    const truth = this.cache.activeTruths.find(t => t.id === truthId)
    if (truth) {
      truth.timesReinforced++
      truth.confidence = Math.min(100, truth.confidence + 5)
      truth.lastReinforced = Date.now()
      this.cache.dirtyTruthIds.add(truth.id)
    }
  }

  /**
   * Challenge a truth (something contradicted it)
   */
  challengeTruth(truthId: string): void {
    const truth = this.cache.activeTruths.find(t => t.id === truthId)
    if (truth) {
      truth.timesChallenged++
      truth.confidence = Math.max(0, truth.confidence - 10)
      truth.lastChallenged = Date.now()
      this.cache.dirtyTruthIds.add(truth.id)

      // Remove if forgotten
      if (shouldForgetTruth(truth)) {
        this.cache.activeTruths = this.cache.activeTruths.filter(t => t.id !== truthId)
        console.log(`[Memory] Truth forgotten: "${truth.truth}"`)
      }
    }
  }

  /**
   * Apply session decay to all truths
   */
  decayTruths(): void {
    for (const truth of this.cache.activeTruths) {
      const decayed = decayTruth(truth)
      if (decayed.confidence !== truth.confidence) {
        Object.assign(truth, decayed)
        this.cache.dirtyTruthIds.add(truth.id)
      }

      // Remove forgotten truths
      if (shouldForgetTruth(truth)) {
        this.cache.activeTruths = this.cache.activeTruths.filter(t => t.id !== truth.id)
        console.log(`[Memory] Truth faded away: "${truth.truth}"`)
      }
    }
  }

  /**
   * Track topic mentions for pattern detection
   */
  trackTopicMention(topic: string): void {
    const current = this.cache.topicMentions.get(topic) || 0
    this.cache.topicMentions.set(topic, current + 1)
  }

  /**
   * Get frequently mentioned topics this session
   */
  getFrequentTopics(minMentions: number = 3): string[] {
    const frequent: string[] = []
    this.cache.topicMentions.forEach((count, topic) => {
      if (count >= minMentions) {
        frequent.push(topic)
      }
    })
    return frequent
  }

  // ============================================
  // PERSONALITY OPERATIONS
  // ============================================

  /**
   * Get current personality
   */
  getPersonality(): PersonalityEvolution | null {
    return this.cache.personality
  }

  /**
   * Update personality at end of session
   */
  updatePersonality(sessionState: SessionState): void {
    if (!this.cache.personality) {
      this.cache.personality = createInitialPersonality()
    }

    this.cache.personality = updatePersonalityEndOfSession(
      this.cache.personality,
      sessionState,
      this.cache.newMoments,
    )
    this.cache.personalityDirty = true
  }

  // ============================================
  // SESSION LIFECYCLE
  // ============================================

  /**
   * Call at end of session to flush all data
   */
  async endSession(sessionState: SessionState): Promise<void> {
    console.log('[Memory] Ending session...')

    // Sync session facts to persistent storage
    this.syncSessionFacts(sessionState.corruptedKnowledge)

    // Apply decay to truths (they fade if not reinforced)
    this.decayTruths()

    // Update personality
    this.updatePersonality(sessionState)

    // Final flush
    await this.flush()

    // Stop timer
    this.stopFlushTimer()

    console.log('[Memory] Session ended')
  }

  /**
   * Reset for new session (keeps cached data, resets dirty flags)
   */
  async startNewSession(): Promise<void> {
    this.cache.sessionStartedAt = Date.now()
    this.cache.lastFlushAt = Date.now()
    this.cache.newMoments = []
    this.cache.newFacts = []
    this.cache.newTruths = []
    this.cache.dirtyChatterUsernames.clear()
    this.cache.dirtyFactIds.clear()
    this.cache.dirtyTruthIds.clear()
    this.cache.personalityDirty = false
    this.cache.pendingAftermathMomentId = null
    this.cache.topicMentions.clear()

    // Reload data if needed
    if (!this.isInitialized) {
      await this.initialize()
    }

    this.startFlushTimer()
  }
}

// Singleton getter
export function getMemoryManager(): MemoryManager {
  if (!memoryManager) {
    memoryManager = new MemoryManager()
  }
  return memoryManager
}

// Export for testing
export function resetMemoryManager(): void {
  if (memoryManager) {
    memoryManager.stopFlushTimer()
  }
  memoryManager = null
}
