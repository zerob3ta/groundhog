'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useBroadcast, type ClientMessage } from '@/lib/hooks/useBroadcast'
export type { ClientMessage } from '@/lib/hooks/useBroadcast'

interface BroadcastContextValue {
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

const BroadcastContext = createContext<BroadcastContextValue | null>(null)

export function BroadcastProvider({ children }: { children: ReactNode }) {
  const broadcastState = useBroadcast()

  return (
    <BroadcastContext.Provider value={broadcastState}>
      {children}
    </BroadcastContext.Provider>
  )
}

export function useBroadcastContext() {
  const context = useContext(BroadcastContext)
  if (!context) {
    throw new Error('useBroadcastContext must be used within a BroadcastProvider')
  }
  return context
}

// Hook for just the viewer count
export function useBroadcastViewers() {
  const context = useContext(BroadcastContext)
  return context?.viewers ?? 1
}

// Hook for just the session display state
export function useBroadcastDisplay() {
  const context = useContext(BroadcastContext)
  return {
    season: context?.season ?? 50,
    mood: context?.mood ?? 'neutral',
  }
}
