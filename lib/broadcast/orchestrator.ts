// Broadcast Orchestrator - Server-side timer logic for Phil/chatters
// Manages the shared experience: chatter generation, Phil responses, season decay
//
// RESPONSE MODEL:
// - Phil responds to ALL pending user messages in a batch (priority 1)
// - Phil responds to accumulated chatter messages probabilistically (priority 2)
// - No dead air filler - chatters fill the space naturally

import { getBroadcastState } from './state'
import type { BroadcastMessage, BroadcastEvent } from './types'
import type { ChatterType } from '@/lib/chatters'
import {
  processPhilMessage,
  processIncomingMessage,
  applySeasonDecay,
  trackChatterMessage,
  processRant,
} from '@/lib/state-updates'
import {
  shouldTriggerRant,
  selectRantTopic,
  getRantConfig,
  buildRantPrompt,
  getRantInterval,
  detectRantTrigger,
  type RantCategory,
} from '@/lib/rants'
import {
  analyzePhilMessage as analyzeForRant,
  type RantAnalysis,
} from '@/lib/rant-detector'
import { checkAndApplyShock } from '@/lib/shock-system'
import { generateChatterMessage } from '@/lib/chatter-generator'
import { generatePhilResponse } from '@/lib/phil-generator'
import { type MemoryManager, buildMemoryPrompt } from '@/lib/memory'

// Filter out stage directions from Phil's responses
function filterStageDirections(text: string): string {
  let filtered = text.replace(/\*[^*]+\*/g, '')
  const stagePatterns = [
    /\((?:sighs?|pauses?|laughs?|chuckles?|grins?|smiles?|frowns?|shakes? head|nods?|shrugs?|looks? (?:away|around|at|down|up)|stares?|blinks?|yawns?|stretches?|leans?|stands?|sits?|walks?|turns?|points?|gestures?|waves?|rolls? eyes?|raises? (?:eyebrow|hand)|clears? throat|coughs?|snorts?|mutters?|whispers?|trails? off|beat|long pause|short pause|silence|quietly|sarcastically|deadpan|flatly)[^)]*\)/gi,
  ]
  for (const pattern of stagePatterns) {
    filtered = filtered.replace(pattern, '')
  }
  filtered = filtered.replace(/\[(?:pause|beat|silence|sighs?|laughs?)[^\]]*\]/gi, '')
  filtered = filtered.replace(/\s+/g, ' ').trim()
  filtered = filtered.replace(/^\s*[,;]\s*/, '').replace(/\s*[,;]\s*$/, '')
  return filtered
}

// Use globalThis to persist across hot reloads in Next.js dev mode
const globalForOrchestrator = globalThis as unknown as {
  orchestrator: BroadcastOrchestrator | undefined
}

// Track a pending user message for batch response
interface PendingUserMessage {
  messageId: string
  displayName: string
  text: string
  timestamp: number
}

class BroadcastOrchestrator {
  private static instance: BroadcastOrchestrator | null = null

  // Timer references
  private chatterTimer: NodeJS.Timeout | null = null
  private seasonDecayTimer: NodeJS.Timeout | null = null
  private shockTimer: NodeJS.Timeout | null = null
  private pruneTimer: NodeJS.Timeout | null = null
  private viewerFluctuationTimer: NodeJS.Timeout | null = null
  private respondToChatterTimer: NodeJS.Timeout | null = null
  private rantTimer: NodeJS.Timeout | null = null
  private batchResponseTimer: NodeJS.Timeout | null = null

  // Processing state
  private isGeneratingPhilResponse: boolean = false
  private isGeneratingChatter: boolean = false
  private lastPhilResponseTime: number = 0
  private lastResponseType: 'user' | 'rant' | 'chatter' = 'chatter'
  private lastRantAnalysis: RantAnalysis | null = null
  private pendingReactiveChatters: number = 0

  // Batch response tracking
  private pendingUserMessages: PendingUserMessage[] = []  // All unresponded user messages
  private lastPhilRespondedToMessageId: string | null = null  // Last message Phil addressed
  private chattersSinceLastPhilResponse: number = 0  // Chatters accumulated since Phil spoke

  // Priority-based cooldowns (ms)
  private readonly COOLDOWNS = {
    user: 800,      // Real human typed something - respond fast
    rant: 1500,     // Rant trigger - slightly longer to build tension
    chatter: 2500,  // Random chatter engagement
  }

  // Batch response delay (how long to wait for more messages before responding)
  private readonly BATCH_DELAY = 500  // ms to wait for more messages to batch

  // Broadcast function (set by stream route)
  private broadcastFn: ((event: BroadcastEvent) => Promise<void>) | null = null

  private constructor() {}

  static getInstance(): BroadcastOrchestrator {
    // Use globalThis for persistence across hot reloads
    if (!globalForOrchestrator.orchestrator) {
      globalForOrchestrator.orchestrator = new BroadcastOrchestrator()
      console.log('[Orchestrator] Created new instance')
    }
    return globalForOrchestrator.orchestrator
  }

  setBroadcastFunction(fn: (event: BroadcastEvent) => Promise<void>): void {
    this.broadcastFn = fn
  }

  // Start all timers
  async start(): Promise<void> {
    const state = getBroadcastState()
    if (state.isOrchestratorRunning()) {
      console.log('[Orchestrator] Already running')
      return
    }

    console.log('[Orchestrator] Starting...')
    state.setOrchestratorRunning(true)

    // Initialize memory system
    await state.initializeMemory()

    // Reset tracking state
    this.pendingUserMessages = []
    this.chattersSinceLastPhilResponse = 0
    this.lastPhilRespondedToMessageId = null

    this.startChatterTimer()
    this.startSeasonDecayTimer()
    this.startShockTimer()
    this.startPruneTimer()
    this.startViewerFluctuationTimer()
    this.startRantTimer()
  }

  // Stop all timers
  async stop(): Promise<void> {
    const state = getBroadcastState()
    console.log('[Orchestrator] Stopping...')

    if (this.chatterTimer) clearTimeout(this.chatterTimer)
    if (this.seasonDecayTimer) clearInterval(this.seasonDecayTimer)
    if (this.shockTimer) clearInterval(this.shockTimer)
    if (this.pruneTimer) clearInterval(this.pruneTimer)
    if (this.viewerFluctuationTimer) clearInterval(this.viewerFluctuationTimer)
    if (this.respondToChatterTimer) clearTimeout(this.respondToChatterTimer)
    if (this.rantTimer) clearTimeout(this.rantTimer)
    if (this.batchResponseTimer) clearTimeout(this.batchResponseTimer)

    this.chatterTimer = null
    this.seasonDecayTimer = null
    this.shockTimer = null
    this.pruneTimer = null
    this.viewerFluctuationTimer = null
    this.respondToChatterTimer = null
    this.rantTimer = null
    this.batchResponseTimer = null

    // Clear pending messages
    this.pendingUserMessages = []

    // End memory session and flush data
    await state.endMemorySession()

    state.setOrchestratorRunning(false)
  }

  // ======================
  // Chatter Generation
  // ======================

  private startChatterTimer(): void {
    const scheduleNext = () => {
      const state = getBroadcastState()
      const config = state.getConfig()
      const [min, max] = config.chatterIntervalMs
      const delay = min + Math.random() * (max - min)

      this.chatterTimer = setTimeout(async () => {
        // Get fresh state reference
        const currentState = getBroadcastState()
        if (!currentState.isOrchestratorRunning() || currentState.getIsSleeping()) {
          console.log('[Orchestrator] Chatter timer skipped - not running or sleeping')
          return
        }

        await this.generateChatter()
        scheduleNext()
      }, delay)
    }

    scheduleNext()
  }

  private async generateChatter(): Promise<void> {
    const state = getBroadcastState()

    // Double-check we should still be generating
    if (state.getIsSleeping() || !state.isOrchestratorRunning()) return
    if (this.isGeneratingChatter) return

    this.isGeneratingChatter = true

    try {
      // Get recent messages for context
      const recentMessages = state.getRecentMessages(8).map(m => ({
        role: m.type === 'phil' ? 'assistant' : 'user',
        content: m.text,
        sender: m.type === 'chatter' ? m.sender : m.type,
      }))

      // Generate chatter message directly (no HTTP call)
      const { chatter, message } = await generateChatterMessage(
        recentMessages,
        state.getSessionState()
      )

      // Create and store message
      const chatterMessage: BroadcastMessage = {
        id: `chatter_${Date.now()}`,
        type: 'chatter',
        sender: chatter.username,
        text: message,
        timestamp: Date.now(),
        chatter,
      }

      state.addMessage(chatterMessage)

      // Update session state with chatter tracking
      state.updateSessionState(s => {
        let newState = processIncomingMessage(s, 'chatter', chatter.type)
        newState = trackChatterMessage(newState, chatter.type as ChatterType, message)
        return newState
      })

      // Track chatters since Phil last spoke
      this.chattersSinceLastPhilResponse++

      // Broadcast to all clients
      await this.broadcast({ type: 'message', data: chatterMessage })

      console.log(`[Chatter] ${chatter.username}: ${message.slice(0, 50)}...`)

      // Maybe trigger Phil response to chatters (only if no pending user messages)
      if (this.pendingUserMessages.length === 0 && !this.isGeneratingPhilResponse) {
        // Probability increases with more chatters, but stays reasonable
        const responseChance = Math.min(0.5, 0.15 + this.chattersSinceLastPhilResponse * 0.08)

        if (Math.random() < responseChance) {
          const delay = 1000 + Math.random() * 1500
          // Track this timeout so we can cancel it when stopping/sleeping
          if (this.respondToChatterTimer) clearTimeout(this.respondToChatterTimer)
          this.respondToChatterTimer = setTimeout(() => this.respondToChatters(), delay)
        }
      }

    } catch (error) {
      console.error('[Orchestrator] Chatter generation error:', error)
    } finally {
      this.isGeneratingChatter = false
    }
  }

  // ======================
  // Rant System
  // ======================

  private startRantTimer(): void {
    const scheduleNextRant = () => {
      const state = getBroadcastState()
      const sessionState = state.getSessionState()
      const chaosLevel = Math.abs(sessionState.phil.season - 50) / 50

      // Get chaos-adjusted interval
      const [minDelay, maxDelay] = getRantInterval(chaosLevel)
      const delay = minDelay + Math.random() * (maxDelay - minDelay)

      console.log(`[Rant] Next rant check in ${Math.round(delay / 1000)}s (chaos: ${Math.round(chaosLevel * 100)}%)`)

      this.rantTimer = setTimeout(async () => {
        const currentState = getBroadcastState()
        if (!currentState.isOrchestratorRunning() || currentState.getIsSleeping()) {
          scheduleNextRant()
          return
        }

        const currentSessionState = currentState.getSessionState()
        const currentChaos = Math.abs(currentSessionState.phil.season - 50) / 50

        // Check if we should trigger an autonomous rant
        if (shouldTriggerRant(currentSessionState, 'autonomous', currentChaos)) {
          await this.generateRantResponse()
        }

        scheduleNextRant()
      }, delay)
    }

    scheduleNextRant()
  }

  private async generateRantResponse(
    triggeredCategory?: RantCategory,
    triggerSource: 'autonomous' | 'dead_air' | 'chat' = 'autonomous'
  ): Promise<void> {
    const state = getBroadcastState()

    if (state.getIsSleeping() || !state.isOrchestratorRunning()) return
    if (this.isGeneratingPhilResponse) return

    // Cooldown check - use rant cooldown
    const timeSinceLastResponse = Date.now() - this.lastPhilResponseTime
    const cooldown = this.COOLDOWNS.rant
    if (timeSinceLastResponse < cooldown) {
      console.log(`[Rant] Skipping rant - cooldown (${timeSinceLastResponse}ms < ${cooldown}ms)`)
      return
    }

    const sessionState = state.getSessionState()
    const chaosLevel = Math.abs(sessionState.phil.season - 50) / 50

    // Select topic (use triggered category if provided)
    const topic = selectRantTopic(triggeredCategory, sessionState.phil.recentRantTopics)
    const config = getRantConfig(chaosLevel)

    console.log(`[Rant] Generating ${config.spiciness} rant about ${topic.category}: ${topic.topic}`)

    this.isGeneratingPhilResponse = true
    state.setPhilTyping(true)
    await this.broadcast({ type: 'typing', data: { isTyping: true } })

    try {
      const messages = state.getMessages()
      const conversationHistory = this.buildConversationHistory(messages)

      // Build rant prompt
      const rantPrompt = buildRantPrompt(topic, config, sessionState)
      conversationHistory.push({ role: 'user', content: rantPrompt })

      // Build memory context for rant
      const memoryManager = state.getMemoryManager()
      const memoryContext = await buildMemoryPrompt(memoryManager, undefined, sessionState)

      // Generate Phil's rant
      const { text: fullText } = await generatePhilResponse(
        conversationHistory,
        sessionState,
        undefined,
        memoryContext
      )

      const filteredText = filterStageDirections(fullText)
      if (!filteredText) return

      await this.addPhilMessage(filteredText, null, 'rant')

      // Update rant tracking state
      state.updateSessionState(s => processRant(s, topic.topic, topic.category))

      console.log(`[Rant] Completed ${config.spiciness} ${topic.category} rant (source: ${triggerSource})`)

    } catch (error) {
      console.error('[Orchestrator] Rant generation error:', error)
    } finally {
      this.isGeneratingPhilResponse = false
      state.setPhilTyping(false)
      await this.broadcast({ type: 'typing', data: { isTyping: false } })

      // Check for pending messages
      this.scheduleNextResponse()
    }
  }

  // ======================
  // Phil Responses (Batch Model)
  // ======================

  /**
   * Schedule the next Phil response based on what's pending.
   * Called after Phil finishes speaking to immediately handle any backed-up messages.
   */
  private scheduleNextResponse(): void {
    const state = getBroadcastState()
    if (state.getIsSleeping() || !state.isOrchestratorRunning()) return
    if (this.isGeneratingPhilResponse) return

    // Priority 1: Respond to pending user messages
    if (this.pendingUserMessages.length > 0) {
      // Small delay to prevent stack overflow
      setTimeout(() => this.respondToUsers(), 50)
      return
    }

    // Priority 2: Respond to chatters if enough have accumulated
    if (this.chattersSinceLastPhilResponse >= 3) {
      setTimeout(() => this.respondToChatters(), 100)
    }
  }

  private async respondToChatters(): Promise<void> {
    const state = getBroadcastState()

    // Don't respond if sleeping or orchestrator stopped
    if (state.getIsSleeping() || !state.isOrchestratorRunning()) return
    if (this.isGeneratingPhilResponse) return

    // PRIORITY: Skip if there are pending user messages waiting
    if (this.pendingUserMessages.length > 0) {
      console.log('[Orchestrator] Skipping chatter response - user messages pending')
      this.scheduleNextResponse()
      return
    }

    // Cooldown check
    const timeSinceLastResponse = Date.now() - this.lastPhilResponseTime
    if (timeSinceLastResponse < this.COOLDOWNS.chatter) {
      return
    }

    this.isGeneratingPhilResponse = true
    state.setPhilTyping(true)
    await this.broadcast({ type: 'typing', data: { isTyping: true } })

    try {
      const messages = state.getMessages()
      const conversationHistory = this.buildConversationHistory(messages)

      // Add instruction for Phil to react to chatters
      conversationHistory.push({
        role: 'user',
        content: '[SYSTEM: React to the chatters above. No user message - just respond to the chat. Keep it short, roast someone or make a comment about the chat.]',
      })

      // Build memory context (no specific user for chatter responses)
      const memoryManager = state.getMemoryManager()
      const sessionState = state.getSessionState()
      const memoryContext = await buildMemoryPrompt(memoryManager, undefined, sessionState)

      // Generate Phil's response directly (no HTTP call)
      const { text: fullText } = await generatePhilResponse(
        conversationHistory,
        sessionState,
        undefined,
        memoryContext
      )

      const filteredText = filterStageDirections(fullText)
      if (!filteredText) return

      await this.addPhilMessage(filteredText, null, 'chatter')

    } catch (error) {
      console.error('[Orchestrator] Chatter response error:', error)
    } finally {
      this.isGeneratingPhilResponse = false
      state.setPhilTyping(false)
      await this.broadcast({ type: 'typing', data: { isTyping: false } })

      // Check for more pending work
      this.scheduleNextResponse()
    }
  }

  /**
   * Respond to ALL pending user messages in a batch.
   * This is the new model - Phil addresses everyone who's waiting.
   */
  private async respondToUsers(): Promise<void> {
    const state = getBroadcastState()

    if (state.getIsSleeping() || !state.isOrchestratorRunning()) return
    if (this.isGeneratingPhilResponse) return
    if (this.pendingUserMessages.length === 0) return

    // Cooldown check
    const timeSinceLastResponse = Date.now() - this.lastPhilResponseTime
    if (timeSinceLastResponse < this.COOLDOWNS.user) {
      // Reschedule after cooldown
      setTimeout(() => this.respondToUsers(), this.COOLDOWNS.user - timeSinceLastResponse + 10)
      return
    }

    // Grab all pending user messages and clear the queue
    const usersToRespond = [...this.pendingUserMessages]
    this.pendingUserMessages = []

    // Check if any message triggers a rant
    for (const pending of usersToRespond) {
      const rantCategory = detectRantTrigger(pending.text)
      if (rantCategory) {
        const sessionState = state.getSessionState()
        const chaosLevel = Math.abs(sessionState.phil.season - 50) / 50
        if (shouldTriggerRant(sessionState, 'chat', chaosLevel)) {
          console.log(`[Rant] User message triggered ${rantCategory} rant: "${pending.text.slice(0, 50)}..."`)
          // Put back other users (they'll be responded to after rant)
          const otherUsers = usersToRespond.filter(u => u.messageId !== pending.messageId)
          this.pendingUserMessages = otherUsers
          await this.generateRantResponse(rantCategory, 'chat')
          return
        }
      }
    }

    this.isGeneratingPhilResponse = true
    state.setPhilTyping(true)
    await this.broadcast({ type: 'typing', data: { isTyping: true } })

    try {
      const messages = state.getMessages()
      const conversationHistory = this.buildConversationHistory(messages)

      // Build the batch user prompt
      const userNames = usersToRespond.map(u => u.displayName)
      const memoryManager = state.getMemoryManager()
      const sessionState = state.getSessionState()

      // If multiple users, build a batch prompt
      if (usersToRespond.length > 1) {
        const batchPrompt = `[SYSTEM: Multiple people are waiting for your response. Address them all in one message - you can mention each by name or respond to the group. Users waiting: ${userNames.join(', ')}]`
        conversationHistory.push({ role: 'user', content: batchPrompt })
      }

      // Build memory context for the first user with current state
      const memoryContext = await buildMemoryPrompt(memoryManager, usersToRespond[0].displayName, sessionState)

      // Generate Phil's response
      const { text: fullText } = await generatePhilResponse(
        conversationHistory,
        sessionState,
        usersToRespond.length === 1 ? usersToRespond[0].text : undefined,
        memoryContext
      )

      const filteredText = filterStageDirections(fullText)
      if (!filteredText) return

      // Track all users as being responded to
      const lastMessageId = usersToRespond[usersToRespond.length - 1].messageId
      this.lastPhilRespondedToMessageId = lastMessageId

      await this.addPhilMessage(filteredText, userNames.join(', '), 'user')

      console.log(`[Phil] Responded to ${usersToRespond.length} user(s): ${userNames.join(', ')}`)

    } catch (error) {
      console.error('[Orchestrator] User batch response error:', error)
    } finally {
      this.isGeneratingPhilResponse = false
      state.setPhilTyping(false)
      await this.broadcast({ type: 'typing', data: { isTyping: false } })

      // Check for more pending work
      this.scheduleNextResponse()
    }
  }

  // Handle user message - adds to batch queue and triggers response
  async handleUserMessage(displayName: string, text: string): Promise<void> {
    const state = getBroadcastState()

    // Don't process messages if Phil is sleeping
    if (state.getIsSleeping()) return

    // PRIORITY: Cancel any pending chatter response - user messages take priority
    if (this.respondToChatterTimer) {
      clearTimeout(this.respondToChatterTimer)
      this.respondToChatterTimer = null
    }

    // Create and add user message
    const messageId = `user_${Date.now()}`
    const userMessage: BroadcastMessage = {
      id: messageId,
      type: 'user',
      sender: displayName,
      text,
      timestamp: Date.now(),
    }

    state.addMessage(userMessage)

    // Process incoming user message in state
    state.updateSessionState(s => processIncomingMessage(s, 'user', undefined, displayName, text))

    // Track user interaction in memory
    const memoryManager = state.getMemoryManager()
    await memoryManager.trackChatterInteraction(displayName, text)

    // Broadcast user message
    await this.broadcast({ type: 'message', data: userMessage })

    // Add to pending queue
    this.pendingUserMessages.push({
      messageId,
      displayName,
      text,
      timestamp: Date.now(),
    })

    console.log(`[Orchestrator] User message queued from ${displayName} (${this.pendingUserMessages.length} pending)`)

    // Schedule batch response with small delay to allow for batching
    if (this.batchResponseTimer) {
      clearTimeout(this.batchResponseTimer)
    }

    // If Phil is already generating, the response will be picked up by scheduleNextResponse
    if (!this.isGeneratingPhilResponse) {
      this.batchResponseTimer = setTimeout(() => {
        this.respondToUsers()
      }, this.BATCH_DELAY)
    }
  }

  private async addPhilMessage(text: string, respondingTo: string | null, responseType: 'user' | 'rant' | 'chatter' = 'chatter'): Promise<void> {
    const state = getBroadcastState()

    const philMessage: BroadcastMessage = {
      id: `phil_${Date.now()}`,
      type: 'phil',
      sender: 'Phil',
      text,
      timestamp: Date.now(),
    }

    state.addMessage(philMessage)

    // Track when Phil last responded (for cooldown)
    this.lastPhilResponseTime = Date.now()
    this.lastResponseType = responseType

    // Reset chatter counter since Phil just spoke
    this.chattersSinceLastPhilResponse = 0

    // Update session state
    state.updateSessionState(s => processPhilMessage(s, text, 'neutral'))

    // Broadcast message with audio URL (audio generated lazily on-demand)
    await this.broadcast({ type: 'message', data: philMessage })

    // Broadcast audio URL - client will fetch and trigger lazy generation
    await this.broadcast({
      type: 'audio',
      data: {
        messageId: philMessage.id,
        audioUrl: `/api/audio/${philMessage.id}`,
      },
    })

    // Broadcast updated state
    await this.broadcast({ type: 'state', data: state.getStateSnapshot() })

    console.log(`[Phil] ${text.slice(0, 60)}...`)

    // Analyze for rant and trigger reactive chatters
    const knownUsernames = state.getMessages()
      .filter(m => m.type === 'chatter' || m.type === 'user')
      .map(m => m.sender)
    const rantAnalysis = analyzeForRant(text, knownUsernames)

    // Memory: Check for notable moments and track chatter interactions
    const memoryManager = state.getMemoryManager()
    const sessionState = state.getSessionState()

    // Build set of fake chatter usernames to filter out from memory operations
    const fakeChatterNames = new Set(
      state.getMessages()
        .filter(m => m.type === 'chatter')
        .map(m => m.sender.toLowerCase())
    )

    // First, check and capture any pending aftermath from previous notable moments
    const recentMessages = state.getMessages().filter(m => m.timestamp > Date.now() - 30000)
    memoryManager.checkAndCaptureAftermath(recentMessages)

    // Check if this message is notable enough to save (exclude fake chatters from involvedUsers)
    const moment = memoryManager.checkAndSaveMoment(
      text, sessionState, rantAnalysis, respondingTo || undefined, fakeChatterNames
    )

    // If this message created a notable moment, mark it for aftermath capture
    if (moment) {
      memoryManager.setPendingAftermath(moment.id)
    }

    // Track roasted users in memory (only real users, not fake chatters)
    if (rantAnalysis.mentionedUsers?.length) {
      for (const username of rantAnalysis.mentionedUsers) {
        // Only track real users, not fake chatters
        if (!fakeChatterNames.has(username.toLowerCase())) {
          memoryManager.trackChatterInteraction(username, '', true, text.slice(0, 100))
        }
      }
    }

    if (rantAnalysis.isRant) {
      this.lastRantAnalysis = rantAnalysis
      console.log(`[Rant Detected] ${rantAnalysis.intensity} ${rantAnalysis.sentiment} rant about ${rantAnalysis.topics.join(', ') || 'general'}: "${rantAnalysis.keyQuote.slice(0, 40)}..."`)

      // Trigger 2-4 reactive chatters
      const numReactiveChatters = 2 + Math.floor(Math.random() * 3)
      this.pendingReactiveChatters = numReactiveChatters
      this.triggerReactiveChatters(rantAnalysis, numReactiveChatters)
    } else {
      this.lastRantAnalysis = null
    }
  }

  // Trigger reactive chatters after a rant
  private triggerReactiveChatters(rantAnalysis: RantAnalysis, count: number): void {
    const state = getBroadcastState()

    if (count <= 0) return
    if (state.getIsSleeping() || !state.isOrchestratorRunning()) return

    // Stagger the chatters 1-2 seconds apart
    const delay = 1000 + Math.random() * 1000

    setTimeout(async () => {
      if (state.getIsSleeping() || !state.isOrchestratorRunning()) return
      if (this.isGeneratingChatter) {
        // Try again in a bit
        this.triggerReactiveChatters(rantAnalysis, count)
        return
      }

      await this.generateReactiveChatter(rantAnalysis)
      this.pendingReactiveChatters = count - 1

      // Trigger next reactive chatter
      if (count > 1) {
        this.triggerReactiveChatters(rantAnalysis, count - 1)
      }
    }, delay)
  }

  // Generate a chatter that reacts to Phil's rant
  private async generateReactiveChatter(rantAnalysis: RantAnalysis): Promise<void> {
    const state = getBroadcastState()

    if (state.getIsSleeping() || !state.isOrchestratorRunning()) return
    if (this.isGeneratingChatter) return

    this.isGeneratingChatter = true

    try {
      const recentMessages = state.getRecentMessages(8).map(m => ({
        role: m.type === 'phil' ? 'assistant' : 'user',
        content: m.text,
        sender: m.type === 'chatter' ? m.sender : m.type,
      }))

      // Generate chatter message with rant context
      const { chatter, message } = await generateChatterMessage(
        recentMessages,
        state.getSessionState(),
        undefined, // No preferred chatter
        rantAnalysis // Pass rant analysis for context
      )

      const chatterMessage: BroadcastMessage = {
        id: `chatter_${Date.now()}`,
        type: 'chatter',
        sender: chatter.username,
        text: message,
        timestamp: Date.now(),
        chatter,
      }

      state.addMessage(chatterMessage)

      state.updateSessionState(s => {
        let newState = processIncomingMessage(s, 'chatter', chatter.type)
        newState = trackChatterMessage(newState, chatter.type as ChatterType, message)
        return newState
      })

      await this.broadcast({ type: 'message', data: chatterMessage })

      console.log(`[Reactive Chatter] ${chatter.username} reacting to rant: ${message.slice(0, 50)}...`)

    } catch (error) {
      console.error('[Orchestrator] Reactive chatter error:', error)
    } finally {
      this.isGeneratingChatter = false
    }
  }

  // ======================
  // Session State Timers
  // ======================

  private startSeasonDecayTimer(): void {
    this.seasonDecayTimer = setInterval(() => {
      const state = getBroadcastState()
      if (!state.isOrchestratorRunning()) return

      // Apply season decay during idle time
      state.updateSessionState(s => applySeasonDecay(s))
    }, 10000) // Every 10 seconds
  }

  private startShockTimer(): void {
    this.shockTimer = setInterval(() => {
      const state = getBroadcastState()
      if (!state.isOrchestratorRunning()) return

      state.updateSessionState(s => {
        const newState = checkAndApplyShock(s)
        if (newState !== s) {
          console.log('[Shock] Applied shock event')
        }
        return newState
      })
    }, 30000) // Every 30 seconds
  }

  private startPruneTimer(): void {
    this.pruneTimer = setInterval(() => {
      const state = getBroadcastState()

      // Prune stale clients
      const stale = state.pruneStaleClients()
      if (stale.length > 0) {
        console.log(`[Orchestrator] Pruned ${stale.length} stale clients`)
      }

      // Prune audio cache
      const prunedAudio = state.pruneAudioCache()
      if (prunedAudio > 0) {
        console.log(`[Orchestrator] Pruned ${prunedAudio} cached audio entries`)
      }
    }, 30000) // Every 30 seconds
  }

  private startViewerFluctuationTimer(): void {
    this.viewerFluctuationTimer = setInterval(() => {
      const state = getBroadcastState()
      if (!state.isOrchestratorRunning()) return

      // Fluctuate fake viewer count
      state.fluctuateFakeViewers()
    }, 8000) // Every 8 seconds
  }

  // ======================
  // Helpers
  // ======================

  private buildConversationHistory(messages: BroadcastMessage[]): { role: string; content: string }[] {
    const MAX_MESSAGES = 15
    const RECENT_VERBATIM = 5

    // Skip intro message
    const relevantMessages = messages.slice(1)

    // If we have fewer messages than the cap, use the old behavior
    if (relevantMessages.length <= MAX_MESSAGES) {
      return this.buildConversationHistorySimple(relevantMessages)
    }

    // Split into older and recent messages
    const recentMessages = relevantMessages.slice(-RECENT_VERBATIM)
    const olderMessages = relevantMessages.slice(0, -RECENT_VERBATIM)

    // Build summary of older messages
    const summary = this.buildContextSummary(olderMessages)

    // Build history with summary + recent verbatim
    const history: { role: string; content: string }[] = []

    // Add summary as context
    if (summary) {
      history.push({
        role: 'user',
        content: `[CONVERSATION SUMMARY - Older messages]\n${summary}\n[END SUMMARY - Recent messages follow]`,
      })
    }

    // Add recent messages verbatim
    let currentChatBundle: string[] = []
    const flushChatBundle = () => {
      if (currentChatBundle.length > 0) {
        history.push({ role: 'user', content: currentChatBundle.join('\n') })
        currentChatBundle = []
      }
    }

    for (const msg of recentMessages) {
      if (msg.type === 'phil') {
        flushChatBundle()
        history.push({ role: 'assistant', content: msg.text })
      } else if (msg.type === 'chatter') {
        currentChatBundle.push(`[${msg.sender}]: ${msg.text}`)
      } else if (msg.type === 'user') {
        currentChatBundle.push(`[${msg.sender} - respond to this person]: ${msg.text}`)
      }
    }

    flushChatBundle()

    console.log(`[Context] Built history: ${summary ? 'summary + ' : ''}${recentMessages.length} recent (total ${relevantMessages.length} messages compressed to ~${history.length} entries)`)

    return history
  }

  // Simple history builder for small message counts
  private buildConversationHistorySimple(messages: BroadcastMessage[]): { role: string; content: string }[] {
    const history: { role: string; content: string }[] = []
    let currentChatBundle: string[] = []

    const flushChatBundle = () => {
      if (currentChatBundle.length > 0) {
        history.push({ role: 'user', content: currentChatBundle.join('\n') })
        currentChatBundle = []
      }
    }

    for (const msg of messages) {
      if (msg.type === 'phil') {
        flushChatBundle()
        history.push({ role: 'assistant', content: msg.text })
      } else if (msg.type === 'chatter') {
        currentChatBundle.push(`[${msg.sender}]: ${msg.text}`)
      } else if (msg.type === 'user') {
        currentChatBundle.push(`[${msg.sender} - respond to this person]: ${msg.text}`)
      }
    }

    flushChatBundle()
    return history
  }

  // Build a summary of older messages for context
  private buildContextSummary(messages: BroadcastMessage[]): string {
    const activeChatters = new Map<string, { count: number; type: string; lastMessage: string }>()
    const topics: string[] = []
    const philMoods: string[] = []
    let userMessages: { sender: string; text: string }[] = []

    for (const msg of messages) {
      if (msg.type === 'chatter' && msg.chatter) {
        const existing = activeChatters.get(msg.sender) || { count: 0, type: msg.chatter.type, lastMessage: '' }
        activeChatters.set(msg.sender, {
          count: existing.count + 1,
          type: msg.chatter.type,
          lastMessage: msg.text.slice(0, 50),
        })
      } else if (msg.type === 'user') {
        userMessages.push({ sender: msg.sender, text: msg.text })
      } else if (msg.type === 'phil') {
        // Extract topics/mood from Phil's messages
        const text = msg.text.toLowerCase()
        if (text.includes('shadow') || text.includes('prediction')) topics.push('shadow/predictions')
        if (text.includes('chuck') || text.includes('staten')) topics.push('rival groundhogs')
        if (text.includes('inner circle') || text.includes('handler')) topics.push('Inner Circle')
        if (text.includes('phyllis') || text.includes('wife')) topics.push('Phyllis')
        if (text.includes('!') || text.includes('?!')) philMoods.push('heated')
      }
    }

    const lines: string[] = []

    // Active chatters
    const sortedChatters = Array.from(activeChatters.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)

    if (sortedChatters.length > 0) {
      const chatterSummary = sortedChatters
        .map(([name, data]) => `${name}(${data.type}, ${data.count}msg)`)
        .join(', ')
      lines.push(`Active chatters: ${chatterSummary}`)
    }

    // User messages (important - real humans)
    if (userMessages.length > 0) {
      const recentUsers = userMessages.slice(-3)
      lines.push(`Real users who chatted: ${recentUsers.map(u => `${u.sender}: "${u.text.slice(0, 30)}..."`).join('; ')}`)
    }

    // Topics discussed
    const uniqueTopics = Array.from(new Set(topics))
    if (uniqueTopics.length > 0) {
      lines.push(`Topics discussed: ${uniqueTopics.join(', ')}`)
    }

    // Phil's general mood
    if (philMoods.length > 2) {
      lines.push(`Phil has been getting heated`)
    }

    return lines.join('\n')
  }

  private async broadcast(event: BroadcastEvent): Promise<void> {
    if (this.broadcastFn) {
      await this.broadcastFn(event)
    }
  }

  // Broadcast sleep state change to all clients
  async broadcastSleepState(isSleeping: boolean): Promise<void> {
    const state = getBroadcastState()
    await this.broadcast({
      type: 'state',
      data: state.getStateSnapshot(),
    })
  }
}

// Export singleton getter
export function getOrchestrator(): BroadcastOrchestrator {
  return BroadcastOrchestrator.getInstance()
}

// Export for testing
export { BroadcastOrchestrator }
