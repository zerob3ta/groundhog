'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import {
  createInitialSessionState,
  type SessionState,
  getSeasonLevel,
  getEnergyLevel,
  logStateChange,
} from './session-state'

interface SessionDisplayState {
  winter: number
  spring: number
  energy: number
  mood: string
}

interface SessionContextValue {
  // The full session state ref (for mutations)
  sessionState: SessionState
  // Display state (triggers re-renders)
  displayState: SessionDisplayState
  // Update the session state
  updateSessionState: (updater: (state: SessionState) => SessionState) => void
  // Direct setter for when you've already mutated
  syncDisplayState: (state: SessionState) => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  // Use useState for the full state to ensure re-renders propagate
  const [sessionState, setSessionState] = useState<SessionState>(createInitialSessionState)

  // Display state for the meter (subset of full state)
  const [displayState, setDisplayState] = useState<SessionDisplayState>({
    winter: 50,
    spring: 50,
    energy: 85,
    mood: sessionState.phil.mood,
  })

  // Update session state and sync display
  const updateSessionState = useCallback((updater: (state: SessionState) => SessionState) => {
    setSessionState(prev => {
      const newState = updater(prev)
      // Sync display state
      setDisplayState({
        winter: newState.phil.winter,
        spring: newState.phil.spring,
        energy: newState.phil.energy,
        mood: newState.phil.mood,
      })
      return newState
    })
  }, [])

  // Sync display from external state
  const syncDisplayState = useCallback((state: SessionState) => {
    setDisplayState({
      winter: state.phil.winter,
      spring: state.phil.spring,
      energy: state.phil.energy,
      mood: state.phil.mood,
    })
  }, [])

  return (
    <SessionContext.Provider
      value={{
        sessionState,
        displayState,
        updateSessionState,
        syncDisplayState,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}

// Hook for just the display state (for the meter)
export function useSessionDisplay() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSessionDisplay must be used within a SessionProvider')
  }
  return context.displayState
}
