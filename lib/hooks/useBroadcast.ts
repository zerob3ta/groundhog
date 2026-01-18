'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { BroadcastMessage, BroadcastEvent, BroadcastStateSnapshot } from '@/lib/broadcast/types'
import type { Chatter } from '@/lib/chatters'

// Extended message type for client-side with Date objects
export interface ClientMessage {
  id: string
  sender: 'user' | 'phil' | 'chatter'
  senderName: string  // The actual display name (username)
  text: string
  timestamp: Date
  chatter?: Chatter
  audioUrl?: string
}

interface UseBroadcastResult {
  // Connection state
  isConnected: boolean
  clientId: string | null
  error: string | null

  // Messages
  messages: ClientMessage[]

  // State snapshot
  viewers: number
  season: number // 0-100: 0=full winter, 50=baseline, 100=full spring
  mood: string
  isPhilTyping: boolean
  isSleeping: boolean

  // User state
  displayName: string | null
  setDisplayName: (name: string) => Promise<{ success: boolean; error?: string }>

  // Actions
  sendMessage: (text: string) => Promise<boolean>
  reconnect: () => void
  disconnect: () => void
}

// Convert broadcast message to client message
function toClientMessage(msg: BroadcastMessage): ClientMessage {
  return {
    id: msg.id,
    sender: msg.type === 'phil' ? 'phil' : msg.type === 'chatter' ? 'chatter' : 'user',
    senderName: msg.sender,  // Preserve the actual display name
    text: msg.text,
    timestamp: new Date(msg.timestamp),
    chatter: msg.chatter,
    audioUrl: msg.audioUrl,
  }
}

export function useBroadcast(): UseBroadcastResult {
  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Messages
  const [messages, setMessages] = useState<ClientMessage[]>([])

  // State snapshot
  const [viewers, setViewers] = useState(1)
  const [season, setSeason] = useState(50) // 0-100: 0=full winter, 50=baseline, 100=full spring
  const [mood, setMood] = useState('neutral')
  const [isPhilTyping, setIsPhilTyping] = useState(false)
  const [isSleeping, setIsSleeping] = useState(false)

  // User state
  const [displayName, setDisplayNameState] = useState<string | null>(null)

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)

  // Audio state for Phil
  const audioQueueRef = useRef<{ messageId: string; audioUrl: string }[]>([])
  const isPlayingAudioRef = useRef(false)

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    console.log('[Broadcast] Connecting to stream...')
    const eventSource = new EventSource('/api/stream')
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log('[Broadcast] Connected')
      setIsConnected(true)
      setError(null)
      reconnectAttemptsRef.current = 0
    }

    eventSource.onerror = (e) => {
      console.error('[Broadcast] Connection error:', e)
      setIsConnected(false)
      setError('Connection lost')

      // Schedule reconnect with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000)
      reconnectAttemptsRef.current++

      console.log(`[Broadcast] Reconnecting in ${delay}ms...`)
      reconnectTimeoutRef.current = setTimeout(connect, delay)
    }

    // Handle different event types
    eventSource.addEventListener('state', (e) => {
      try {
        const data = JSON.parse(e.data) as BroadcastStateSnapshot & { clientId?: string }
        console.log('[Broadcast] Received state event:', data)
        if (data.clientId) {
          console.log('[Broadcast] Setting clientId:', data.clientId)
          setClientId(data.clientId)
        }
        setViewers(data.viewers)
        setSeason(data.season)
        setMood(data.mood)
        setIsPhilTyping(data.isPhilTyping)
        setIsSleeping(data.isSleeping)
      } catch (err) {
        console.error('[Broadcast] Failed to parse state:', err)
      }
    })

    eventSource.addEventListener('messages', (e) => {
      try {
        const data = JSON.parse(e.data) as BroadcastMessage[]
        setMessages(data.map(toClientMessage))
      } catch (err) {
        console.error('[Broadcast] Failed to parse messages:', err)
      }
    })

    eventSource.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data) as BroadcastMessage
        setMessages(prev => [...prev, toClientMessage(data)])
      } catch (err) {
        console.error('[Broadcast] Failed to parse message:', err)
      }
    })

    eventSource.addEventListener('heartbeat', (e) => {
      try {
        const data = JSON.parse(e.data) as { timestamp: number; viewers: number }
        setViewers(data.viewers)
      } catch (err) {
        console.error('[Broadcast] Failed to parse heartbeat:', err)
      }
    })

    eventSource.addEventListener('typing', (e) => {
      try {
        const data = JSON.parse(e.data) as { isTyping: boolean }
        setIsPhilTyping(data.isTyping)
      } catch (err) {
        console.error('[Broadcast] Failed to parse typing:', err)
      }
    })

    eventSource.addEventListener('audio', (e) => {
      try {
        const data = JSON.parse(e.data) as { messageId: string; audioUrl: string }
        // Update message with audio URL
        setMessages(prev =>
          prev.map(msg =>
            msg.id === data.messageId ? { ...msg, audioUrl: data.audioUrl } : msg
          )
        )
        // Queue audio for playback
        audioQueueRef.current.push(data)
      } catch (err) {
        console.error('[Broadcast] Failed to parse audio:', err)
      }
    })

    eventSource.addEventListener('user_joined', (e) => {
      try {
        const data = JSON.parse(e.data) as { displayName: string; timestamp: number }
        console.log(`[Broadcast] User joined: ${data.displayName}`)
      } catch (err) {
        console.error('[Broadcast] Failed to parse user_joined:', err)
      }
    })
  }, [])

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsConnected(false)
  }, [])

  // Reconnect manually
  const reconnect = useCallback(() => {
    disconnect()
    reconnectAttemptsRef.current = 0
    connect()
  }, [connect, disconnect])

  // Set display name
  const setDisplayName = useCallback(async (name: string): Promise<{ success: boolean; error?: string }> => {
    console.log('[Broadcast] setDisplayName called with:', name, 'clientId:', clientId)
    if (!clientId) {
      console.error('[Broadcast] Cannot set display name: no clientId')
      return { success: false, error: 'Not connected. Please wait for connection.' }
    }

    try {
      const response = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, displayName: name }),
      })

      const data = await response.json()

      if (response.ok) {
        setDisplayNameState(name)
        return { success: true }
      }
      return { success: false, error: data.error || 'Failed to set display name' }
    } catch (err) {
      console.error('[Broadcast] Failed to set display name:', err)
      return { success: false, error: 'Network error. Please try again.' }
    }
  }, [clientId])

  // Send message
  const sendMessage = useCallback(async (text: string): Promise<boolean> => {
    if (!clientId || !displayName) {
      setError('Must set display name before chatting')
      return false
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          displayName,
          text,
          broadcast: true, // Flag to indicate this is a broadcast message
        }),
      })

      return response.ok
    } catch (err) {
      console.error('[Broadcast] Failed to send message:', err)
      return false
    }
  }, [clientId, displayName])

  // Connect on mount
  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  // Load display name from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('phil_displayName')
    if (stored) {
      setDisplayNameState(stored)
    }
  }, [])

  // Re-register stored display name when connection is established
  useEffect(() => {
    if (!isConnected || !clientId) return

    const stored = localStorage.getItem('phil_displayName')
    if (stored && !displayName) {
      // We have a stored name but it's not set in state yet - restore it
      setDisplayNameState(stored)
    }

    // If we have a display name (from state or localStorage), register it with the server
    const nameToRegister = displayName || stored
    if (nameToRegister && clientId) {
      console.log('[Broadcast] Re-registering display name:', nameToRegister)
      fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, displayName: nameToRegister }),
      }).catch(err => {
        console.error('[Broadcast] Failed to re-register display name:', err)
      })
    }
  }, [isConnected, clientId, displayName])

  // Save display name to localStorage when it changes
  useEffect(() => {
    if (displayName) {
      localStorage.setItem('phil_displayName', displayName)
    }
  }, [displayName])

  return {
    isConnected,
    clientId,
    error,
    messages,
    viewers,
    season,
    mood,
    isPhilTyping,
    isSleeping,
    displayName,
    setDisplayName,
    sendMessage,
    reconnect,
    disconnect,
  }
}
