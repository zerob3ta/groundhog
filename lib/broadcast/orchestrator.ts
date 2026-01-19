// Broadcast Orchestrator - Server-side timer logic for Phil/chatters
// Manages the shared experience: chatter generation, dead air responses, season decay

import { getBroadcastState } from './state'
import type { BroadcastMessage, BroadcastEvent } from './types'
import type { ChatterType } from '@/lib/chatters'
import {
  processPhilMessage,
  processIncomingMessage,
  applyWinterTrigger,
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
import { checkAndApplyShock } from '@/lib/shock-system'
import { PHIL_DEAD_AIR_FILLERS } from '@/lib/phil-corpus'
import { generateChatterMessage } from '@/lib/chatter-generator'
import { generatePhilResponse } from '@/lib/phil-generator'

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

class BroadcastOrchestrator {
  private static instance: BroadcastOrchestrator | null = null

  // Timer references
  private chatterTimer: NodeJS.Timeout | null = null
  private deadAirTimer: NodeJS.Timeout | null = null
  private seasonDecayTimer: NodeJS.Timeout | null = null
  private shockTimer: NodeJS.Timeout | null = null
  private pruneTimer: NodeJS.Timeout | null = null
  private viewerFluctuationTimer: NodeJS.Timeout | null = null
  private respondToChatterTimer: NodeJS.Timeout | null = null
  private rantTimer: NodeJS.Timeout | null = null

  // Processing state
  private isGeneratingPhilResponse: boolean = false
  private isGeneratingChatter: boolean = false
  private philResponseQueue: BroadcastMessage[] = []
  private lastPhilResponseTime: number = 0
  private readonly MIN_RESPONSE_COOLDOWN = 5000 // 5 seconds between Phil responses

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
  start(): void {
    const state = getBroadcastState()
    if (state.isOrchestratorRunning()) {
      console.log('[Orchestrator] Already running')
      return
    }

    console.log('[Orchestrator] Starting...')
    state.setOrchestratorRunning(true)

    // Reset the last Phil message time to prevent immediate dead air trigger
    state.resetLastPhilMessageTime()

    this.startChatterTimer()
    this.startDeadAirTimer()
    this.startSeasonDecayTimer()
    this.startShockTimer()
    this.startPruneTimer()
    this.startViewerFluctuationTimer()
    this.startRantTimer()
  }

  // Stop all timers
  stop(): void {
    const state = getBroadcastState()
    console.log('[Orchestrator] Stopping...')

    if (this.chatterTimer) clearTimeout(this.chatterTimer)
    if (this.deadAirTimer) clearInterval(this.deadAirTimer)
    if (this.seasonDecayTimer) clearInterval(this.seasonDecayTimer)
    if (this.shockTimer) clearInterval(this.shockTimer)
    if (this.pruneTimer) clearInterval(this.pruneTimer)
    if (this.viewerFluctuationTimer) clearInterval(this.viewerFluctuationTimer)
    if (this.respondToChatterTimer) clearTimeout(this.respondToChatterTimer)
    if (this.rantTimer) clearTimeout(this.rantTimer)

    this.chatterTimer = null
    this.deadAirTimer = null
    this.seasonDecayTimer = null
    this.shockTimer = null
    this.pruneTimer = null
    this.viewerFluctuationTimer = null
    this.respondToChatterTimer = null
    this.rantTimer = null

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

      // Broadcast to all clients
      await this.broadcast({ type: 'message', data: chatterMessage })

      console.log(`[Chatter] ${chatter.username}: ${message.slice(0, 50)}...`)

      // Maybe trigger Phil response
      const chatterCount = state.getChattersSincePhil() + 1
      const responseChance = Math.min(0.7, 0.25 + chatterCount * 0.1)

      if (Math.random() < responseChance && !this.isGeneratingPhilResponse) {
        const delay = 1500 + Math.random() * 2000
        // Track this timeout so we can cancel it when stopping/sleeping
        if (this.respondToChatterTimer) clearTimeout(this.respondToChatterTimer)
        this.respondToChatterTimer = setTimeout(() => this.respondToChatters(), delay)
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

    // Cooldown check
    const timeSinceLastResponse = Date.now() - this.lastPhilResponseTime
    if (timeSinceLastResponse < this.MIN_RESPONSE_COOLDOWN) {
      console.log(`[Rant] Skipping rant - cooldown`)
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

      // Generate Phil's rant
      const { text: fullText } = await generatePhilResponse(
        conversationHistory,
        sessionState
      )

      const filteredText = filterStageDirections(fullText)
      if (!filteredText) return

      await this.addPhilMessage(filteredText, null)

      // Update rant tracking state
      state.updateSessionState(s => processRant(s, topic.topic, topic.category))

      console.log(`[Rant] Completed ${config.spiciness} ${topic.category} rant (source: ${triggerSource})`)

    } catch (error) {
      console.error('[Orchestrator] Rant generation error:', error)
    } finally {
      this.isGeneratingPhilResponse = false
      state.setPhilTyping(false)
      await this.broadcast({ type: 'typing', data: { isTyping: false } })
    }
  }

  // ======================
  // Phil Responses
  // ======================

  private startDeadAirTimer(): void {
    const config = getBroadcastState().getConfig()

    this.deadAirTimer = setInterval(async () => {
      // Get fresh state reference
      const state = getBroadcastState()
      if (!state.isOrchestratorRunning() || state.getIsSleeping()) {
        console.log('[Orchestrator] Dead air timer skipped - not running or sleeping')
        return
      }
      if (this.isGeneratingPhilResponse) return

      const timeSincePhil = Date.now() - state.getLastPhilMessageTime()
      if (timeSincePhil > config.deadAirThresholdMs) {
        await this.generateDeadAirResponse()
      }
    }, config.deadAirCheckMs)
  }

  private async generateDeadAirResponse(): Promise<void> {
    const state = getBroadcastState()

    // Double-check we should still be generating
    if (state.getIsSleeping() || !state.isOrchestratorRunning()) return
    if (this.isGeneratingPhilResponse) return

    // Cooldown check - prevent rapid-fire responses
    const timeSinceLastResponse = Date.now() - this.lastPhilResponseTime
    if (timeSinceLastResponse < this.MIN_RESPONSE_COOLDOWN) {
      console.log(`[Orchestrator] Skipping dead air - cooldown (${timeSinceLastResponse}ms < ${this.MIN_RESPONSE_COOLDOWN}ms)`)
      return
    }

    // Check if we should do a rant instead of normal dead air filler
    const sessionState = state.getSessionState()
    const chaosLevel = Math.abs(sessionState.phil.season - 50) / 50
    if (shouldTriggerRant(sessionState, 'dead_air', chaosLevel)) {
      console.log('[Orchestrator] Dead air triggering rant instead of filler')
      await this.generateRantResponse(undefined, 'dead_air')
      return
    }

    this.isGeneratingPhilResponse = true

    state.setPhilTyping(true)
    await this.broadcast({ type: 'typing', data: { isTyping: true } })

    try {
      const messages = state.getMessages()
      const conversationHistory = this.buildConversationHistory(messages)

      // Build dead air prompt
      const deadAirPrompt = this.getDeadAirPrompt(messages)
      conversationHistory.push({ role: 'user', content: deadAirPrompt })

      // Apply silence-based winter trigger
      state.updateSessionState(s => applyWinterTrigger(s, 'silence'))

      // Generate Phil's response directly (no HTTP call)
      const { text: fullText } = await generatePhilResponse(
        conversationHistory,
        state.getSessionState()
      )

      const filteredText = filterStageDirections(fullText)
      if (!filteredText) return

      await this.addPhilMessage(filteredText, null)

    } catch (error) {
      console.error('[Orchestrator] Dead air response error:', error)
    } finally {
      this.isGeneratingPhilResponse = false
      state.setPhilTyping(false)
      await this.broadcast({ type: 'typing', data: { isTyping: false } })
    }
  }

  private async respondToChatters(): Promise<void> {
    const state = getBroadcastState()

    // Don't respond if sleeping or orchestrator stopped
    if (state.getIsSleeping() || !state.isOrchestratorRunning()) return
    if (this.isGeneratingPhilResponse) return

    // Cooldown check - prevent rapid-fire responses
    const timeSinceLastResponse = Date.now() - this.lastPhilResponseTime
    if (timeSinceLastResponse < this.MIN_RESPONSE_COOLDOWN) {
      console.log(`[Orchestrator] Skipping chatter response - cooldown`)
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

      // Generate Phil's response directly (no HTTP call)
      const { text: fullText } = await generatePhilResponse(
        conversationHistory,
        state.getSessionState()
      )

      const filteredText = filterStageDirections(fullText)
      if (!filteredText) return

      await this.addPhilMessage(filteredText, null)

    } catch (error) {
      console.error('[Orchestrator] Chatter response error:', error)
    } finally {
      this.isGeneratingPhilResponse = false
      state.setPhilTyping(false)
      await this.broadcast({ type: 'typing', data: { isTyping: false } })
    }
  }

  // Handle user message and generate Phil's response
  async handleUserMessage(displayName: string, text: string): Promise<void> {
    const state = getBroadcastState()

    // Don't process messages if Phil is sleeping
    if (state.getIsSleeping()) return

    // Add user message
    const userMessage: BroadcastMessage = {
      id: `user_${Date.now()}`,
      type: 'user',
      sender: displayName,
      text,
      timestamp: Date.now(),
    }

    state.addMessage(userMessage)

    // Process incoming user message in state
    state.updateSessionState(s => processIncomingMessage(s, 'user', undefined, displayName, text))

    // Broadcast user message
    await this.broadcast({ type: 'message', data: userMessage })

    // Generate Phil's response
    await this.generatePhilResponseToUser(displayName, text)
  }

  private async generatePhilResponseToUser(displayName: string, userText: string): Promise<void> {
    const state = getBroadcastState()

    // Don't respond if Phil is sleeping
    if (state.getIsSleeping()) return

    if (this.isGeneratingPhilResponse) {
      // Queue this request
      return
    }

    // Check if message triggers a rant
    const rantCategory = detectRantTrigger(userText)
    if (rantCategory) {
      const sessionState = state.getSessionState()
      const chaosLevel = Math.abs(sessionState.phil.season - 50) / 50

      if (shouldTriggerRant(sessionState, 'chat', chaosLevel)) {
        console.log(`[Rant] User message triggered ${rantCategory} rant: "${userText.slice(0, 50)}..."`)
        await this.generateRantResponse(rantCategory, 'chat')
        return
      }
    }

    this.isGeneratingPhilResponse = true

    state.setPhilTyping(true)
    await this.broadcast({ type: 'typing', data: { isTyping: true } })

    try {
      const messages = state.getMessages()
      const conversationHistory = this.buildConversationHistory(messages)

      // Generate Phil's response directly (no HTTP call)
      const { text: fullText } = await generatePhilResponse(
        conversationHistory,
        state.getSessionState(),
        userText
      )

      const filteredText = filterStageDirections(fullText)
      if (!filteredText) return

      await this.addPhilMessage(filteredText, displayName)

    } catch (error) {
      console.error('[Orchestrator] Phil response error:', error)
    } finally {
      this.isGeneratingPhilResponse = false
      state.setPhilTyping(false)
      await this.broadcast({ type: 'typing', data: { isTyping: false } })
    }
  }

  private async addPhilMessage(text: string, respondingTo: string | null): Promise<void> {
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
    const history: { role: string; content: string }[] = []
    let currentChatBundle: string[] = []

    const flushChatBundle = () => {
      if (currentChatBundle.length > 0) {
        history.push({ role: 'user', content: currentChatBundle.join('\n') })
        currentChatBundle = []
      }
    }

    // Skip intro message
    for (const msg of messages.slice(1)) {
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

  private getDeadAirPrompt(messages: BroadcastMessage[]): string {
    const messagesSincePhil: BroadcastMessage[] = []
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'phil') break
      messagesSincePhil.unshift(messages[i])
    }

    const lastNonPhilMessage = messages.filter(m => m.type !== 'phil').pop()
    const timeSinceLastMessage = lastNonPhilMessage
      ? Date.now() - lastNonPhilMessage.timestamp
      : 60000
    const chatIsActuallyDead = timeSinceLastMessage > 15000

    const allChatters = messages
      .filter(m => m.type === 'chatter')
      .map(m => ({ username: m.sender, text: m.text }))

    const recentChatters = messagesSincePhil
      .filter(m => m.type === 'chatter')
      .map(m => ({ username: m.sender, text: m.text }))

    const prompts: string[] = []

    if (recentChatters.length > 0) {
      const chatter = recentChatters[Math.floor(Math.random() * recentChatters.length)]
      prompts.push(
        `[SYSTEM: ${chatter.username} said "${chatter.text}" and you haven't responded. React to it - roast them, answer them, or call them out. Keep it short.]`
      )
    }

    if (allChatters.length > 2) {
      const oldChatter = allChatters[Math.floor(Math.random() * Math.min(allChatters.length - 2, 5))]
      prompts.push(
        `[SYSTEM: You're still thinking about what ${oldChatter.username} said earlier ("${oldChatter.text.slice(0, 50)}..."). Circle back to it. "You know what, that thing ${oldChatter.username} said..." or "Still thinking about..."]`
      )
    }

    prompts.push(
      `[SYSTEM: Go on a brief tangent. Something reminded you of a memory, an opinion you have, or a story. Trail off mid-thought if you want. One or two sentences max.]`
    )

    prompts.push(
      `[SYSTEM: Mutter about your current situation - the shadow, Phyllis, the burrow, 147 years of this, whatever's on your mind. One short comment to yourself.]`
    )

    if (chatIsActuallyDead && messagesSincePhil.length === 0) {
      prompts.push(
        `[SYSTEM: The chat has actually gone quiet. Comment on the silence - "${PHIL_DEAD_AIR_FILLERS[Math.floor(Math.random() * PHIL_DEAD_AIR_FILLERS.length)]}" or something similar. Be annoyed or bemused.]`
      )
    }

    if (recentChatters.length > 0 && Math.random() < 0.6) {
      return prompts[0]
    }

    return prompts[Math.floor(Math.random() * prompts.length)]
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
