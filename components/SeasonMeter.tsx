'use client'

import { useEffect, useState, useMemo } from 'react'

interface SeasonMeterProps {
  season: number // 0-100: 0=full winter, 50=baseline, 100=full spring
  mood?: string
}

export default function SeasonMeter({ season, mood = 'neutral' }: SeasonMeterProps) {
  const [mounted, setMounted] = useState(false)
  const [prevMood, setPrevMood] = useState(mood)
  const [isMoodShifting, setIsMoodShifting] = useState(false)

  // Calculate chaos = distance from baseline (50)
  // 0 = pure baseline Phil, 1 = maximum chaos
  const chaos = useMemo(() => {
    return Math.abs(season - 50) / 50
  }, [season])

  // Position on the slider - season value IS the position
  // 0 = full winter, 50 = balanced, 100 = full spring
  const sliderPosition = useMemo(() => {
    // Clamp to reasonable display range
    return Math.max(5, Math.min(95, season))
  }, [season])

  // Get the prediction headline - synced with slider position
  const prediction = useMemo(() => {
    // Calculate how far from center the slider is (0-50 range)
    const distanceFromCenter = Math.abs(sliderPosition - 50)
    // Convert to percentage (0-100 scale)
    const dominancePercent = Math.round(distanceFromCenter * 2)

    if (dominancePercent <= 10) {
      return {
        emoji: '⚖️',
        label: 'UNCERTAIN',
        value: null,
        color: 'text-purple-300',
      }
    }

    if (sliderPosition < 50) {
      // Winter dominant
      return {
        emoji: '❄️',
        label: 'MORE WINTER',
        value: dominancePercent,
        color: 'text-blue-300',
      }
    }

    // Spring dominant
    return {
      emoji: '☀️',
      label: 'EARLY SPRING',
      value: dominancePercent,
      color: 'text-amber-300',
    }
  }, [sliderPosition])

  // Get mood emoji
  const moodEmoji = useMemo(() => {
    const m = mood.toLowerCase()
    if (m === 'bored' || m === 'sleepy' || m === 'tired' || m === 'exhausted') return '😴'
    if (m === 'irritated' || m === 'annoyed' || m === 'frustrated' || m === 'hostile') return '😤'
    if (m === 'existential' || m === 'breaking') return '🌀'
    if (m === 'hyped' || m === 'manic' || m === 'engaged') return '🔥'
    if (m === 'feeling himself' || m === 'cocky' || m === 'legendary') return '😎'
    if (m === 'suspicious' || m === 'paranoid') return '👀'
    if (m === 'unhinged' || m === 'ranting') return '🤪'
    if (m === 'recovering' || m === 'relieved') return '😌'
    return '😐'
  }, [mood])

  // Detect mood shifts for animation
  useEffect(() => {
    if (mounted && mood !== prevMood) {
      setIsMoodShifting(true)
      setTimeout(() => setIsMoodShifting(false), 800)
      setPrevMood(mood)
    }
  }, [mood, prevMood, mounted])

  useEffect(() => {
    setMounted(true)
    setPrevMood(mood)
  }, [])

  if (!mounted) return null

  return (
    <div className="relative">
      <div
        className={`
          relative overflow-hidden rounded-lg p-3
          bg-gradient-to-br from-gray-900/70 to-gray-800/50
          border border-white/10 backdrop-blur-sm
          transition-all duration-500
          ${chaos > 0.6 ? 'shadow-[0_0_12px_rgba(168,85,247,0.25)]' : ''}
        `}
      >
        {/* PRIMARY: Prediction Headline */}
        <div className="mb-3">
          <div className={`flex items-center gap-2 mb-2 ${prediction.color}`}>
            <span className="text-xl">{prediction.emoji}</span>
            <span className="text-lg font-bold tracking-wide">
              {prediction.value !== null && `${prediction.value}% `}
              {prediction.label}
            </span>
          </div>

          {/* Winter ← → Spring Slider */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1 px-0.5">
              <span className="text-[9px] text-blue-400/70 uppercase tracking-wider">Winter</span>
              <span className="text-[9px] text-amber-400/70 uppercase tracking-wider">Spring</span>
            </div>
            <div className="relative h-2.5 rounded-full overflow-hidden bg-gray-800/60">
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/40 via-purple-600/20 to-amber-600/40" />

              {/* Fill from winter side */}
              {sliderPosition < 50 && (
                <div
                  className="absolute right-1/2 top-0 bottom-0 bg-gradient-to-l from-purple-500/60 to-blue-500/80 transition-all duration-700 ease-out"
                  style={{ width: `${50 - sliderPosition}%` }}
                />
              )}

              {/* Fill from spring side */}
              {sliderPosition > 50 && (
                <div
                  className="absolute left-1/2 top-0 bottom-0 bg-gradient-to-r from-purple-500/60 to-amber-500/80 transition-all duration-700 ease-out"
                  style={{ width: `${sliderPosition - 50}%` }}
                />
              )}

              {/* Center line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />

              {/* Position indicator */}
              <div
                className={`
                  absolute top-1/2 w-2.5 h-3.5 rounded-full
                  transition-all duration-500 ease-out
                  ${sliderPosition < 40 ? 'bg-blue-300 shadow-[0_0_8px_rgba(147,197,253,0.8)]' :
                    sliderPosition > 60 ? 'bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.8)]' :
                    'bg-purple-300 shadow-[0_0_6px_rgba(196,181,253,0.6)]'}
                `}
                style={{
                  left: `${sliderPosition}%`,
                  transform: 'translateX(-50%) translateY(-50%)',
                }}
              />
            </div>
          </div>
        </div>

        {/* SECONDARY + TERTIARY: Mood + Chaos Indicator */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          {/* Mood indicator */}
          <div
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded-md
              bg-gray-800/40 border border-white/5
              transition-all duration-300
              ${isMoodShifting ? 'scale-105 bg-purple-900/30 border-purple-500/30' : ''}
            `}
          >
            <span className={`text-sm ${isMoodShifting ? 'animate-bounce' : ''}`}>
              {moodEmoji}
            </span>
            <span className="text-[11px] text-gray-300 capitalize font-medium">
              {mood}
            </span>
          </div>

          {/* Chaos/Order indicator (subtle) */}
          <div className="flex items-center gap-1">
            {/* Chaos dots visualization */}
            <div className="flex gap-0.5">
              {[0, 0.25, 0.5, 0.75, 1].map((threshold, i) => (
                <div
                  key={i}
                  className={`
                    w-1.5 h-3 rounded-sm transition-all duration-500
                    ${chaos > threshold
                      ? chaos > 0.6
                        ? 'bg-purple-400/80'
                        : chaos > 0.3
                        ? 'bg-purple-400/60'
                        : 'bg-purple-400/40'
                      : 'bg-gray-700/40'
                    }
                    ${chaos > threshold && chaos > 0.6 ? 'animate-pulse' : ''}
                  `}
                  style={{
                    height: `${8 + i * 2}px`,
                  }}
                />
              ))}
            </div>
            <span className="text-[9px] text-gray-500 uppercase tracking-wider ml-1">
              {chaos < 0.2 ? 'stable' :
               chaos < 0.5 ? 'drift' :
               chaos < 0.7 ? 'chaos' : 'break'}
            </span>
          </div>
        </div>

        {/* High chaos ambient effect */}
        {chaos > 0.6 && (
          <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  )
}
