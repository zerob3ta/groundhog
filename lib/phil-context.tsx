'use client'

import { createContext, useContext, useState, useRef, ReactNode } from 'react'
import type { EmotionalState } from './emotion-system'

interface PhilContextType {
  isTalking: boolean
  setIsTalking: (talking: boolean) => void
  mouthOpen: number // 0 to 1
  setMouthOpen: (value: number) => void
  subtitle: string | null
  setSubtitle: (text: string | null) => void
  audioRef: React.MutableRefObject<HTMLAudioElement | null>
  analyserRef: React.MutableRefObject<AnalyserNode | null>
  // Emotional state for animation selection
  emotionalState: EmotionalState | null
  setEmotionalState: (state: EmotionalState | null) => void
}

const PhilContext = createContext<PhilContextType | null>(null)

// Default emotional state when none is set
const DEFAULT_EMOTIONAL_STATE: EmotionalState = {
  primary: 'content',
  intensity: 'subtle',
  physicalState: 'normal',
}

export function PhilProvider({ children }: { children: ReactNode }) {
  const [isTalking, setIsTalking] = useState(false)
  const [mouthOpen, setMouthOpen] = useState(0)
  const [subtitle, setSubtitle] = useState<string | null>(null)
  const [emotionalState, setEmotionalState] = useState<EmotionalState | null>(DEFAULT_EMOTIONAL_STATE)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  return (
    <PhilContext.Provider value={{
      isTalking,
      setIsTalking,
      mouthOpen,
      setMouthOpen,
      subtitle,
      setSubtitle,
      audioRef,
      analyserRef,
      emotionalState,
      setEmotionalState,
    }}>
      {children}
    </PhilContext.Provider>
  )
}

export function usePhil() {
  const context = useContext(PhilContext)
  if (!context) {
    throw new Error('usePhil must be used within a PhilProvider')
  }
  return context
}
