// Broadcast system types for shared Phil livestream

import type { Chatter } from '@/lib/chatters'
import type { SessionState } from '@/lib/session-state'

// Message types in the broadcast
export interface BroadcastMessage {
  id: string
  type: 'phil' | 'user' | 'chatter' | 'system'
  sender: string
  text: string
  timestamp: number
  audioUrl?: string  // For Phil messages with TTS
  chatter?: Chatter  // For chatter messages
}

// Connected client info
export interface ConnectedClient {
  id: string
  displayName: string | null
  controller: ReadableStreamDefaultController
  lastHeartbeat: number
  connectedAt: number
}

// Events sent via SSE
export type BroadcastEvent =
  | { type: 'message'; data: BroadcastMessage }
  | { type: 'messages'; data: BroadcastMessage[] }  // Batch of messages (for initial load)
  | { type: 'heartbeat'; data: { timestamp: number; viewers: number } }
  | { type: 'state'; data: BroadcastStateSnapshot }
  | { type: 'typing'; data: { isTyping: boolean } }
  | { type: 'user_joined'; data: { displayName: string; timestamp: number } }
  | { type: 'audio'; data: { messageId: string; audioUrl: string } }

// State snapshot sent to clients
export interface BroadcastStateSnapshot {
  viewers: number
  season: number // 0-100: 0=full winter, 50=baseline, 100=full spring
  mood: string
  isPhilTyping: boolean
  isSleeping: boolean  // Phil is in sleep mode - stream paused
}

// Orchestrator configuration
export interface OrchestratorConfig {
  chatterIntervalMs: [number, number]  // [min, max] for random interval
  deadAirCheckMs: number               // How often to check for dead air
  deadAirThresholdMs: number           // How long before Phil speaks unprompted
  heartbeatIntervalMs: number          // SSE heartbeat interval
  maxMessageHistory: number            // Cap on message history
  audioCacheTtlMs: number              // How long to cache audio blobs
  clientTimeoutMs: number              // Client considered stale after this
  fakeViewerRange: [number, number]    // [min, max] fake viewers to add
}

// Default orchestrator config
export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  chatterIntervalMs: [3500, 7500],     // 3.5-7.5 seconds between chatters
  deadAirCheckMs: 3000,                // Check every 3 seconds
  deadAirThresholdMs: 15000,           // 15 seconds of silence triggers Phil
  heartbeatIntervalMs: 15000,          // 15 second heartbeats
  maxMessageHistory: 200,              // Keep last 200 messages
  audioCacheTtlMs: 300000,             // 5 minute audio cache
  clientTimeoutMs: 30000,              // 30 second client timeout
  fakeViewerRange: [15, 45],           // Add 15-45 fake viewers
}

// User registration request
export interface UserRegistration {
  clientId: string
  displayName: string
}

// Chat message from user
export interface UserChatRequest {
  clientId: string
  displayName: string
  text: string
}

// Audio cache entry
export interface CachedAudio {
  messageId: string
  audioBlob: Uint8Array
  createdAt: number
}
