'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import ChatPanelBroadcast from '@/components/ChatPanelBroadcast'
import LiveBadge from '@/components/LiveBadge'
import SeasonMeter from '@/components/SeasonMeter'
import InactivityCheck from '@/components/InactivityCheck'
import { PhilProvider } from '@/lib/phil-context'
import { BroadcastProvider, useBroadcastDisplay, useBroadcastViewers, useBroadcastContext } from '@/lib/broadcast-context'

// Dynamically import the 3D scene to avoid SSR issues with Three.js
const Phil3D = dynamic(() => import('@/components/Phil3D'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-stream-dark">
      <div className="text-stream-muted">Loading Phil...</div>
    </div>
  )
})

// Season Meter Overlay component that uses the broadcast context
function SeasonMeterOverlay() {
  const displayState = useBroadcastDisplay()

  return (
    <div className="absolute top-2 right-2 z-10 w-44 sm:w-56 lg:top-4 lg:right-4 lg:w-72">
      <SeasonMeter
        season={displayState.season}
        mood={displayState.mood}
      />
    </div>
  )
}

// Viewer count component that uses the broadcast context
function ViewerCountOverlay() {
  const viewers = useBroadcastViewers()

  return (
    <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded">
      <svg
        className="w-4 h-4 text-white"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
      <span className="text-white text-sm font-medium">
        {viewers.toLocaleString()}
      </span>
    </div>
  )
}

// Inactivity check wrapper that uses broadcast context
function InactivityWrapper({ onDisconnected }: { onDisconnected: () => void }) {
  const { disconnect, isConnected, isSleeping } = useBroadcastContext()

  const handleTimeout = () => {
    disconnect()
    onDisconnected()
  }

  return (
    <InactivityCheck
      inactivityTimeout={5 * 60 * 1000}  // 5 minutes of inactivity before prompt
      countdownDuration={60}              // 60 seconds to respond
      onTimeout={handleTimeout}
      enabled={isConnected && !isSleeping}  // Don't check inactivity when Phil is sleeping
    />
  )
}

// Sleeping overlay when Phil is asleep
function SleepingOverlay() {
  const { isSleeping } = useBroadcastContext()

  if (!isSleeping) return null

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-40 flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        <div className="text-8xl mb-6 animate-pulse">😴</div>
        <h1 className="text-white text-3xl font-bold mb-3">Phil is Sleeping</h1>
        <p className="text-stream-muted text-lg mb-2">
          Shh... the groundhog is resting.
        </p>
        <p className="text-stream-muted">
          He'll wake up soon. Check back later!
        </p>
        <div className="mt-8 flex justify-center gap-2">
          <span className="w-2 h-2 bg-stream-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
          <span className="w-2 h-2 bg-stream-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
          <span className="w-2 h-2 bg-stream-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
        </div>
      </div>
    </div>
  )
}

// Disconnected screen shown after inactivity timeout
function DisconnectedScreen({ onReconnect }: { onReconnect: () => void }) {
  return (
    <div className="h-screen w-screen bg-stream-dark flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        <div className="text-6xl mb-4">💤</div>
        <h1 className="text-white text-2xl font-bold mb-2">Stream Paused</h1>
        <p className="text-stream-muted mb-6">
          You were away for a while, so we disconnected to save resources. Phil's still here waiting for you!
        </p>
        <button
          onClick={onReconnect}
          className="bg-live-red hover:bg-red-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
        >
          Rejoin Stream
        </button>
      </div>
    </div>
  )
}

export default function Home() {
  const [isDisconnected, setIsDisconnected] = useState(false)

  const handleDisconnected = () => {
    setIsDisconnected(true)
  }

  const handleReconnect = () => {
    setIsDisconnected(false)
    // The BroadcastProvider will auto-connect when mounted
    window.location.reload()
  }

  if (isDisconnected) {
    return <DisconnectedScreen onReconnect={handleReconnect} />
  }

  return (
    <BroadcastProvider>
      <PhilProvider>
        <main className="h-screen w-screen flex flex-col lg:flex-row bg-stream-dark">
          {/* Inactivity check */}
          <InactivityWrapper onDisconnected={handleDisconnected} />

          {/* Sleeping overlay */}
          <SleepingOverlay />

          {/* 3D Scene Area */}
          <div className="relative flex-1 lg:flex-[2] h-[50vh] lg:h-full">
            {/* Top-left overlays */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
              <LiveBadge />
              <ViewerCountOverlay />
            </div>

            {/* Top-right Season Meter overlay */}
            <SeasonMeterOverlay />

            {/* Stream title */}
            <div className="absolute bottom-4 left-4 z-10">
              <h1 className="text-white text-lg font-bold drop-shadow-lg">
                Punxsutawney Phil
              </h1>
              <p className="text-stream-muted text-sm drop-shadow-lg">
                Live from Gobbler&apos;s Knob, PA
              </p>
            </div>

            {/* 3D Canvas */}
            <Phil3D />
          </div>

          {/* Chat Panel */}
          <div className="flex-1 lg:flex-[1] h-[50vh] lg:h-full border-t lg:border-t-0 lg:border-l border-stream-border">
            <ChatPanelBroadcast />
          </div>
        </main>
      </PhilProvider>
    </BroadcastProvider>
  )
}
