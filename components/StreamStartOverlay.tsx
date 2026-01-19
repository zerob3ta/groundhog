'use client'

import { useState, useEffect } from 'react'

interface StreamStartOverlayProps {
  onStart: () => void
}

export default function StreamStartOverlay({ onStart }: StreamStartOverlayProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isAnimating, setIsAnimating] = useState(false)

  // Check if we've already started (e.g., page refresh with session)
  useEffect(() => {
    const hasStarted = sessionStorage.getItem('streamStarted')
    if (hasStarted === 'true') {
      setIsVisible(false)
      onStart()
    }
  }, [onStart])

  const handleStart = () => {
    // Create AudioContext with user gesture to unlock audio on mobile
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      // Resume if suspended
      if (audioContext.state === 'suspended') {
        audioContext.resume()
      }
      // Close it - the actual playback will create its own
      audioContext.close()
    } catch {
      // AudioContext not supported, continue anyway
    }

    // Mark as started for this session
    sessionStorage.setItem('streamStarted', 'true')

    // Animate out
    setIsAnimating(true)
    setTimeout(() => {
      setIsVisible(false)
      onStart()
    }, 300)
  }

  if (!isVisible) return null

  return (
    <div
      className={`fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300 ${
        isAnimating ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="text-center p-8 max-w-md mx-4">
        {/* Phil icon/emoji */}
        <div className="text-8xl mb-6 animate-bounce">
          🐿️
        </div>

        {/* Title */}
        <h1 className="text-white text-3xl font-bold mb-3">
          Punxsutawney Phil
        </h1>
        <p className="text-stream-muted text-lg mb-2">
          Live from Gobbler&apos;s Knob
        </p>

        {/* LIVE badge */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2 bg-live-red/20 border border-live-red/50 px-4 py-2 rounded-full">
            <span className="w-2 h-2 bg-live-red rounded-full animate-pulse" />
            <span className="text-live-red font-semibold text-sm uppercase tracking-wide">
              Live Now
            </span>
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          className="w-full bg-live-red hover:bg-red-600 text-white font-semibold py-4 px-8 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-live-red/25"
        >
          <div className="flex items-center justify-center gap-3">
            <svg
              className="w-6 h-6"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z"/>
            </svg>
            <span className="text-lg">Watch Livestream</span>
          </div>
        </button>

        {/* Subtitle */}
        <p className="text-stream-muted text-sm mt-4">
          Tap to enable audio and join the stream
        </p>
      </div>
    </div>
  )
}
