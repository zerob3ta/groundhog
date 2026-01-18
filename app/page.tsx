'use client'

import dynamic from 'next/dynamic'
import ChatPanel from '@/components/ChatPanel'
import LiveBadge from '@/components/LiveBadge'
import ViewerCount from '@/components/ViewerCount'
import SeasonMeter from '@/components/SeasonMeter'
import { PhilProvider } from '@/lib/phil-context'
import { SessionProvider, useSessionDisplay } from '@/lib/session-context'

// Dynamically import the 3D scene to avoid SSR issues with Three.js
const Phil3D = dynamic(() => import('@/components/Phil3D'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-stream-dark">
      <div className="text-stream-muted">Loading Phil...</div>
    </div>
  )
})

// Season Meter Overlay component that uses the session context
function SeasonMeterOverlay() {
  const displayState = useSessionDisplay()

  return (
    <div className="absolute top-4 right-4 z-10 w-64 lg:w-72">
      <SeasonMeter
        winter={displayState.winter}
        spring={displayState.spring}
        energy={displayState.energy}
        mood={displayState.mood}
      />
    </div>
  )
}

export default function Home() {
  return (
    <SessionProvider>
      <PhilProvider>
        <main className="h-screen w-screen flex flex-col lg:flex-row bg-stream-dark">
          {/* 3D Scene Area */}
          <div className="relative flex-1 lg:flex-[2] h-[40vh] lg:h-full">
            {/* Top-left overlays */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
              <LiveBadge />
              <ViewerCount />
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
          <div className="flex-1 lg:flex-[1] h-[60vh] lg:h-full border-t lg:border-t-0 lg:border-l border-stream-border">
            <ChatPanel />
          </div>
        </main>
      </PhilProvider>
    </SessionProvider>
  )
}
