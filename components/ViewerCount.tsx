'use client'

import { useState, useEffect } from 'react'

export default function ViewerCount() {
  const [count, setCount] = useState(1247)

  // Simulate viewer count fluctuations for ambiance
  useEffect(() => {
    const interval = setInterval(() => {
      setCount((prev) => {
        const change = Math.floor(Math.random() * 21) - 10 // -10 to +10
        const newCount = prev + change
        // Keep it within reasonable bounds
        return Math.max(800, Math.min(2000, newCount))
      })
    }, 3000 + Math.random() * 2000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded">
      {/* Eye icon */}
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
        {count.toLocaleString()}
      </span>
    </div>
  )
}
