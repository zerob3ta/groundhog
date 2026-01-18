'use client'

import { useEffect, useState, useMemo } from 'react'

interface SeasonMeterProps {
  winter: number
  spring: number
  energy?: number
  mood?: string
}

export default function SeasonMeter({ winter, spring, energy = 75, mood = 'neutral' }: SeasonMeterProps) {
  const [mounted, setMounted] = useState(false)
  const [prevChaos, setPrevChaos] = useState(0)
  const [isShifting, setIsShifting] = useState(false)

  // Calculate chaos = distance from baseline (50/50)
  // 0% = pure baseline Phil, 100% = maximum chaos
  const chaos = useMemo(() => {
    const winterDistance = Math.abs(winter - 50)
    const springDistance = Math.abs(spring - 50)
    return Math.round(Math.max(winterDistance, springDistance) * 2) // Scale to 0-100
  }, [winter, spring])

  // Calculate flavor direction when chaos is present
  // Positive = spring direction, Negative = winter direction, 0 = balanced
  const flavorDirection = useMemo(() => {
    const diff = spring - winter
    if (Math.abs(diff) < 10) return 0 // Balanced
    return diff // Positive = spring, Negative = winter
  }, [winter, spring])

  // Get the dominant flavor
  const flavor = useMemo(() => {
    if (flavorDirection > 10) return 'spring'
    if (flavorDirection < -10) return 'winter'
    return 'balanced'
  }, [flavorDirection])

  // Get chaos level description
  const chaosLevel = useMemo(() => {
    if (chaos < 20) return { label: 'BASELINE', emoji: '🎭', color: 'text-gray-300' }
    if (chaos < 40) return { label: 'DRIFTING', emoji: '🌊', color: 'text-purple-300' }
    if (chaos < 60) return { label: 'UNSTABLE', emoji: '⚡', color: 'text-orange-300' }
    if (chaos < 80) return { label: 'CHAOTIC', emoji: '🌀', color: 'text-red-300' }
    return { label: 'BREAKING', emoji: '💥', color: 'text-red-400' }
  }, [chaos])

  // Detect shifts for animation
  useEffect(() => {
    if (mounted && Math.abs(chaos - prevChaos) >= 5) {
      setIsShifting(true)
      setTimeout(() => setIsShifting(false), 1000)
      setPrevChaos(chaos)
    }
  }, [chaos, prevChaos, mounted])

  useEffect(() => {
    setMounted(true)
    setPrevChaos(chaos)
  }, [])

  if (!mounted) return null

  return (
    <div className="relative">
      <div
        className={`
          relative overflow-hidden rounded-lg p-3
          bg-gradient-to-br from-gray-900/60 to-gray-800/40
          border border-white/10 backdrop-blur-sm
          transition-all duration-500
          ${chaos > 60 ? 'shadow-[0_0_15px_rgba(239,68,68,0.3)]' : ''}
          ${isShifting ? 'scale-[1.02]' : ''}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-lg ${isShifting ? 'animate-bounce' : ''}`}>
              {chaosLevel.emoji}
            </span>
            <span className={`text-xs font-bold uppercase tracking-wider ${chaosLevel.color}`}>
              {chaosLevel.label}
            </span>
          </div>
          <div className="text-xs font-mono text-gray-400">
            {chaos}% chaos
          </div>
        </div>

        {/* CHAOS METER (Order ← → Chaos) */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-emerald-400/80 uppercase tracking-wider">Order</span>
            <span className="text-[10px] text-red-400/80 uppercase tracking-wider">Chaos</span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden bg-gray-800/50">
            {/* Background gradient */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-emerald-600/30 via-gray-600/30 to-red-600/30"
            />

            {/* Chaos fill (from left to right) */}
            <div
              className={`
                absolute left-0 top-0 bottom-0 transition-all duration-700 ease-out
                ${chaos < 30 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                  chaos < 50 ? 'bg-gradient-to-r from-emerald-400 to-yellow-500' :
                  chaos < 70 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                  'bg-gradient-to-r from-orange-500 to-red-500'}
              `}
              style={{ width: `${chaos}%` }}
            >
              {/* Glow edge */}
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/30 blur-sm" />
            </div>

            {/* Center marker (baseline) */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20" />

            {/* Position indicator */}
            <div
              className={`
                absolute top-1/2 -translate-y-1/2 w-2 h-4 rounded-full
                transition-all duration-500 ease-out
                ${chaos < 30 ? 'bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.8)]' :
                  chaos < 60 ? 'bg-yellow-300 shadow-[0_0_8px_rgba(253,224,71,0.8)]' :
                  'bg-red-300 shadow-[0_0_8px_rgba(252,165,165,0.8)]'}
              `}
              style={{
                left: `${chaos}%`,
                transform: `translateX(-50%) translateY(-50%)`,
              }}
            />
          </div>
        </div>

        {/* FLAVOR METER (Winter ← → Spring) */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-blue-400/80 uppercase tracking-wider flex items-center gap-1">
              <span>❄️</span> Winter
            </span>
            <span className={`text-[10px] uppercase tracking-wider ${
              flavor === 'balanced' ? 'text-gray-400' :
              flavor === 'winter' ? 'text-blue-300' : 'text-amber-300'
            }`}>
              {flavor === 'balanced' ? 'balanced' : flavor}
            </span>
            <span className="text-[10px] text-amber-400/80 uppercase tracking-wider flex items-center gap-1">
              Spring <span>☀️</span>
            </span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden bg-gray-800/50">
            {/* Background gradient */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-blue-600/30 via-purple-600/20 to-amber-600/30"
            />

            {/* Winter fill (from center to left) */}
            {flavorDirection < 0 && (
              <div
                className="absolute right-1/2 top-0 bottom-0 bg-gradient-to-l from-purple-500/50 to-blue-500 transition-all duration-700 ease-out"
                style={{ width: `${Math.abs(flavorDirection) / 2}%` }}
              />
            )}

            {/* Spring fill (from center to right) */}
            {flavorDirection > 0 && (
              <div
                className="absolute left-1/2 top-0 bottom-0 bg-gradient-to-r from-purple-500/50 to-amber-500 transition-all duration-700 ease-out"
                style={{ width: `${flavorDirection / 2}%` }}
              />
            )}

            {/* Center marker */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/30" />

            {/* Position indicator */}
            <div
              className={`
                absolute top-1/2 -translate-y-1/2 w-2 h-4 rounded-full
                transition-all duration-500 ease-out
                ${flavorDirection < -20 ? 'bg-blue-300 shadow-[0_0_8px_rgba(147,197,253,0.8)]' :
                  flavorDirection > 20 ? 'bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.8)]' :
                  'bg-purple-300 shadow-[0_0_6px_rgba(196,181,253,0.6)]'}
              `}
              style={{
                left: `${50 + flavorDirection / 2}%`,
                transform: `translateX(-50%) translateY(-50%)`,
              }}
            />
          </div>
        </div>

        {/* Raw values display */}
        <div className="flex items-center justify-center gap-4 text-xs font-mono mb-3 py-1 bg-black/20 rounded">
          <span className="text-blue-300">W: {winter}</span>
          <span className="text-gray-500">|</span>
          <span className="text-amber-300">S: {spring}</span>
        </div>

        {/* Energy and Mood bar */}
        <div className="flex items-center gap-3 pt-2 border-t border-white/5">
          {/* Energy indicator */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Energy</span>
              <span className="text-[10px] font-mono text-gray-400">{energy}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-800/50 overflow-hidden">
              <div
                className={`
                  h-full rounded-full transition-all duration-700 ease-out
                  ${energy > 60 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                    energy > 30 ? 'bg-gradient-to-r from-yellow-500 to-amber-400' :
                    'bg-gradient-to-r from-red-500 to-orange-400'}
                `}
                style={{ width: `${energy}%` }}
              />
            </div>
          </div>

          {/* Mood indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-800/30 border border-white/5">
            <span className="text-xs">
              {mood === 'bored' || mood === 'sleepy' || mood === 'tired' || mood === 'exhausted' ? '😴' :
               mood === 'irritated' || mood === 'annoyed' || mood === 'frustrated' || mood === 'hostile' ? '😤' :
               mood === 'existential' || mood === 'breaking' ? '🌀' :
               mood === 'hyped' || mood === 'manic' || mood === 'engaged' ? '🔥' :
               mood === 'feeling himself' || mood === 'cocky' || mood === 'legendary' ? '😎' :
               mood === 'suspicious' || mood === 'paranoid' ? '👀' :
               mood === 'unhinged' || mood === 'ranting' ? '🤪' :
               '😐'}
            </span>
            <span className="text-[10px] text-gray-400 capitalize">{mood}</span>
          </div>
        </div>

        {/* High chaos overlay effect */}
        {chaos > 70 && (
          <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-orange-500/5 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  )
}
