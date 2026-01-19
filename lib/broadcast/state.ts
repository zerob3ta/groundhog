// Broadcast State - In-memory singleton for shared Phil state
// This holds all the shared state for the broadcast

import {
  type BroadcastMessage,
  type ConnectedClient,
  type BroadcastStateSnapshot,
  type CachedAudio,
  type OrchestratorConfig,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from './types'
import {
  createInitialSessionState,
  type SessionState,
} from '@/lib/session-state'
import { getMemoryManager, type MemoryManager } from '@/lib/memory'

// Use globalThis to persist across hot reloads in Next.js dev mode
const globalForBroadcast = globalThis as unknown as {
  broadcastState: BroadcastState | undefined
}

class BroadcastState {
  private static instance: BroadcastState | null = null

  // Message history
  private messages: BroadcastMessage[] = []

  // Connected clients
  private clients: Map<string, ConnectedClient> = new Map()

  // Session state (Phil's mood, energy, etc.)
  private sessionState: SessionState = createInitialSessionState()

  // Audio cache
  private audioCache: Map<string, CachedAudio> = new Map()

  // Track in-flight audio generation to prevent duplicate API calls
  private audioGenerating: Map<string, Promise<Uint8Array | null>> = new Map()

  // Phil's typing state
  private isPhilTyping: boolean = false

  // Sleep mode - Phil is sleeping, no chatting
  private isSleeping: boolean = false

  // Last activity timestamp (for dead air detection)
  private lastPhilMessageAt: number = Date.now()

  // Orchestrator running state
  private isRunning: boolean = false

  // Configuration
  private config: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG

  // Fake viewer count (randomized once per session)
  private fakeViewerCount: number = 0

  // Memory manager instance
  private memoryManager: MemoryManager

  // Memory initialization state
  private memoryInitialized: boolean = false

  // Phil's intro message
  private readonly INTRO_MESSAGE: BroadcastMessage = {
    id: 'intro',
    type: 'phil',
    sender: 'Phil',
    text: "Alright, alright, I'm here. Phil, live from the Knob, 147 years in the game. You're welcome. Go ahead, ask me something - but make it interesting, I've literally heard everything.",
    timestamp: Date.now(),
  }

  private constructor() {
    // Initialize with intro message
    this.messages = [this.INTRO_MESSAGE]
    // Randomize initial fake viewer count
    this.randomizeFakeViewers()
    // Get memory manager instance
    this.memoryManager = getMemoryManager()
  }

  // Randomize fake viewer count within configured range
  private randomizeFakeViewers(): void {
    const [min, max] = this.config.fakeViewerRange
    this.fakeViewerCount = Math.floor(min + Math.random() * (max - min))
  }

  static getInstance(): BroadcastState {
    // Use globalThis for persistence across hot reloads
    if (!globalForBroadcast.broadcastState) {
      globalForBroadcast.broadcastState = new BroadcastState()
      console.log('[BroadcastState] Created new instance')
    }
    return globalForBroadcast.broadcastState
  }

  // Reset for testing
  static resetInstance(): void {
    globalForBroadcast.broadcastState = undefined
  }

  // ======================
  // Client Management
  // ======================

  addClient(client: ConnectedClient): void {
    this.clients.set(client.id, client)
    console.log(`[Broadcast] Client connected: ${client.id} (${this.clients.size} total)`)
  }

  removeClient(clientId: string): void {
    this.clients.delete(clientId)
    console.log(`[Broadcast] Client disconnected: ${clientId} (${this.clients.size} remaining)`)
  }

  getClient(clientId: string): ConnectedClient | undefined {
    return this.clients.get(clientId)
  }

  updateClientDisplayName(clientId: string, displayName: string): boolean {
    const client = this.clients.get(clientId)
    if (client) {
      client.displayName = displayName
      return true
    }
    return false
  }

  updateClientHeartbeat(clientId: string): void {
    const client = this.clients.get(clientId)
    if (client) {
      client.lastHeartbeat = Date.now()
    }
  }

  getClientCount(): number {
    return this.clients.size
  }

  getAllClients(): ConnectedClient[] {
    return Array.from(this.clients.values())
  }

  // Prune stale clients
  pruneStaleClients(): string[] {
    const now = Date.now()
    const staleIds: string[] = []

    this.clients.forEach((client, id) => {
      if (now - client.lastHeartbeat > this.config.clientTimeoutMs) {
        staleIds.push(id)
      }
    })

    for (const id of staleIds) {
      this.removeClient(id)
    }

    return staleIds
  }

  // ======================
  // Message Management
  // ======================

  addMessage(message: BroadcastMessage): void {
    this.messages.push(message)

    // Cap at max history
    if (this.messages.length > this.config.maxMessageHistory) {
      this.messages = this.messages.slice(-this.config.maxMessageHistory)
    }

    // Track last Phil message time
    if (message.type === 'phil') {
      this.lastPhilMessageAt = message.timestamp
    }
  }

  getMessages(): BroadcastMessage[] {
    return [...this.messages]
  }

  getRecentMessages(count: number): BroadcastMessage[] {
    return this.messages.slice(-count)
  }

  getMessagesSince(timestamp: number): BroadcastMessage[] {
    return this.messages.filter(m => m.timestamp > timestamp)
  }

  getLastPhilMessageTime(): number {
    return this.lastPhilMessageAt
  }

  resetLastPhilMessageTime(): void {
    this.lastPhilMessageAt = Date.now()
  }

  // Get messages since Phil's last response (for dead air context)
  getMessagesSincePhil(): BroadcastMessage[] {
    const messages: BroadcastMessage[] = []
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].type === 'phil') break
      messages.unshift(this.messages[i])
    }
    return messages
  }

  // Count chatters since Phil's last message
  getChattersSincePhil(): number {
    let count = 0
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].type === 'phil') break
      if (this.messages[i].type === 'chatter') count++
    }
    return count
  }

  // ======================
  // Session State
  // ======================

  getSessionState(): SessionState {
    return this.sessionState
  }

  updateSessionState(updater: (state: SessionState) => SessionState): SessionState {
    this.sessionState = updater(this.sessionState)
    return this.sessionState
  }

  setSessionState(state: SessionState): void {
    this.sessionState = state
  }

  // Get snapshot for clients
  getStateSnapshot(): BroadcastStateSnapshot {
    return {
      viewers: this.clients.size + this.fakeViewerCount,
      season: this.sessionState.phil.season,
      mood: this.sessionState.phil.mood,
      isPhilTyping: this.isPhilTyping,
      isSleeping: this.isSleeping,
    }
  }

  // ======================
  // Sleep Mode
  // ======================

  setSleeping(sleeping: boolean): void {
    this.isSleeping = sleeping
    if (sleeping) {
      console.log('[BroadcastState] Phil is going to sleep')
    } else {
      console.log('[BroadcastState] Phil is waking up')
    }
  }

  getIsSleeping(): boolean {
    return this.isSleeping
  }

  // Reset session for fresh start when waking up
  resetSession(): void {
    this.messages = [this.INTRO_MESSAGE]
    this.sessionState = createInitialSessionState()
    this.isPhilTyping = false
    this.lastPhilMessageAt = Date.now()
    this.audioCache.clear()
    // Start new memory session
    this.memoryManager.startNewSession()
    console.log('[BroadcastState] Session reset for fresh start')
  }

  // ======================
  // Memory System
  // ======================

  // Initialize memory system (call on first orchestrator start)
  async initializeMemory(): Promise<void> {
    if (this.memoryInitialized) return

    await this.memoryManager.initialize()
    this.memoryInitialized = true
    console.log('[BroadcastState] Memory system initialized')
  }

  // Get memory manager for direct access
  getMemoryManager(): MemoryManager {
    return this.memoryManager
  }

  // End memory session (call on sleep or shutdown)
  async endMemorySession(): Promise<void> {
    if (!this.memoryInitialized) return

    await this.memoryManager.endSession(this.sessionState)
    console.log('[BroadcastState] Memory session ended')
  }

  // Occasionally fluctuate fake viewer count (call this periodically)
  fluctuateFakeViewers(): void {
    // Small random change: -2 to +3
    const change = Math.floor(Math.random() * 6) - 2
    const [min, max] = this.config.fakeViewerRange
    this.fakeViewerCount = Math.max(min, Math.min(max, this.fakeViewerCount + change))
  }

  // ======================
  // Phil Typing State
  // ======================

  setPhilTyping(isTyping: boolean): void {
    this.isPhilTyping = isTyping
  }

  getPhilTyping(): boolean {
    return this.isPhilTyping
  }

  // ======================
  // Audio Cache (Lazy Generation)
  // ======================

  cacheAudio(messageId: string, audioBlob: Uint8Array): void {
    this.audioCache.set(messageId, {
      messageId,
      audioBlob,
      createdAt: Date.now(),
    })
  }

  getAudio(messageId: string): CachedAudio | undefined {
    return this.audioCache.get(messageId)
  }

  // Get message by ID (needed for lazy audio generation)
  getMessage(messageId: string): BroadcastMessage | undefined {
    return this.messages.find(m => m.id === messageId)
  }

  // Check if audio is currently being generated
  isAudioGenerating(messageId: string): boolean {
    return this.audioGenerating.has(messageId)
  }

  // Get the in-flight generation promise (for waiting on)
  getAudioGenerationPromise(messageId: string): Promise<Uint8Array | null> | undefined {
    return this.audioGenerating.get(messageId)
  }

  // Start tracking audio generation
  setAudioGenerating(messageId: string, promise: Promise<Uint8Array | null>): void {
    this.audioGenerating.set(messageId, promise)
  }

  // Clear generation tracking (call when done)
  clearAudioGenerating(messageId: string): void {
    this.audioGenerating.delete(messageId)
  }

  // Prune old audio from cache
  pruneAudioCache(): number {
    const now = Date.now()
    let pruned = 0

    const toDelete: string[] = []
    this.audioCache.forEach((cached, id) => {
      if (now - cached.createdAt > this.config.audioCacheTtlMs) {
        toDelete.push(id)
      }
    })
    for (const id of toDelete) {
      this.audioCache.delete(id)
      pruned++
    }

    return pruned
  }

  // ======================
  // Orchestrator State
  // ======================

  isOrchestratorRunning(): boolean {
    return this.isRunning
  }

  setOrchestratorRunning(running: boolean): void {
    this.isRunning = running
  }

  getConfig(): OrchestratorConfig {
    return this.config
  }

  setConfig(config: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// Export singleton getter
export function getBroadcastState(): BroadcastState {
  return BroadcastState.getInstance()
}

// Export for testing
export { BroadcastState }
