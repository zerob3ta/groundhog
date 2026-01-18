'use client'

import { usePhil } from '@/lib/phil-context'

export default function Subtitles() {
  const { subtitle } = usePhil()

  if (!subtitle) return null

  return (
    <div className="absolute bottom-20 left-4 right-4 z-20 flex justify-center pointer-events-none">
      <div className="bg-black/75 backdrop-blur-sm px-6 py-3 rounded-lg max-w-[90%]">
        <p className="text-white text-base md:text-lg text-center leading-relaxed">
          {subtitle}
        </p>
      </div>
    </div>
  )
}
