'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface InactivityCheckProps {
  inactivityTimeout?: number  // ms before showing prompt (default: 5 min)
  countdownDuration?: number  // seconds to respond (default: 60)
  onTimeout: () => void       // Called when user doesn't respond
  enabled?: boolean           // Can disable the check
}

export default function InactivityCheck({
  inactivityTimeout = 5 * 60 * 1000, // 5 minutes
  countdownDuration = 60,             // 60 seconds
  onTimeout,
  enabled = true,
}: InactivityCheckProps) {
  const [showPrompt, setShowPrompt] = useState(false)
  const [countdown, setCountdown] = useState(countdownDuration)

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Start the inactivity timer
  const startInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }

    if (!enabled) return

    console.log('[InactivityCheck] Starting timer for', inactivityTimeout, 'ms')
    inactivityTimerRef.current = setTimeout(() => {
      console.log('[InactivityCheck] Timer fired! Showing prompt')
      setShowPrompt(true)
      setCountdown(countdownDuration)
    }, inactivityTimeout)
  }, [enabled, inactivityTimeout, countdownDuration])

  // Handle user confirming they're still there
  const handleStillHere = useCallback(() => {
    console.log('[InactivityCheck] User confirmed still here')
    setShowPrompt(false)
    setCountdown(countdownDuration)
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    startInactivityTimer()
  }, [countdownDuration, startInactivityTimer])

  // Set up activity listeners - only reset timer when prompt is NOT showing
  useEffect(() => {
    if (!enabled) return

    // Note: mousemove is intentionally excluded - it's too sensitive
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']

    const handleActivity = () => {
      // Only reset timer if prompt isn't showing (they need to click the button)
      if (!showPrompt) {
        console.log('[InactivityCheck] Activity detected, resetting timer')
        startInactivityTimer()
      }
    }

    // Add listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // Track visibility changes
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !showPrompt) {
        console.log('[InactivityCheck] Tab became visible, resetting timer')
        startInactivityTimer()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enabled, showPrompt, startInactivityTimer])

  // Initial timer start - runs once on mount
  useEffect(() => {
    if (!enabled) return

    console.log('[InactivityCheck] Component mounted, starting initial timer')
    startInactivityTimer()

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
      }
    }
    // Only run on mount/unmount, not when startInactivityTimer changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // Countdown timer when prompt is showing
  useEffect(() => {
    if (!showPrompt) return

    console.log('[InactivityCheck] Prompt showing, starting countdown')
    countdownTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          console.log('[InactivityCheck] Countdown finished, calling onTimeout')
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current)
          }
          onTimeout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
      }
    }
  }, [showPrompt, onTimeout])

  if (!showPrompt) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-stream-dark border border-stream-border rounded-xl p-8 max-w-md mx-4 text-center shadow-2xl">
        <div className="text-6xl mb-4">😴</div>
        <h2 className="text-white text-2xl font-bold mb-2">Still watching?</h2>
        <p className="text-stream-muted mb-6">
          Phil's been chatting but you seem away. Click below to keep watching, or we'll disconnect to save resources.
        </p>

        <div className="mb-6">
          <div className="text-4xl font-mono text-white mb-2">{countdown}</div>
          <div className="w-full bg-stream-gray rounded-full h-2">
            <div
              className="bg-live-red h-2 rounded-full transition-all duration-1000"
              style={{ width: `${(countdown / countdownDuration) * 100}%` }}
            />
          </div>
        </div>

        <button
          onClick={handleStillHere}
          className="w-full bg-live-red hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          I'm still here!
        </button>
      </div>
    </div>
  )
}
