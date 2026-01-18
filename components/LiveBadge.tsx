'use client'

export default function LiveBadge() {
  return (
    <div className="flex items-center gap-1.5 bg-live-red px-2.5 py-1 rounded">
      {/* Pulsing dot */}
      <span className="w-2 h-2 bg-white rounded-full animate-pulse-live" />
      <span className="text-white text-xs font-bold tracking-wide">LIVE</span>
    </div>
  )
}
