'use client'

import { useState } from 'react'

interface DisplayNameFormProps {
  onSubmit: (name: string) => Promise<boolean>
  isSubmitting?: boolean
  error?: string | null
}

export default function DisplayNameForm({
  onSubmit,
  isSubmitting = false,
  error = null,
}: DisplayNameFormProps) {
  const [name, setName] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setLocalError('Please enter a display name')
      return
    }

    if (trimmed.length < 2) {
      setLocalError('Name must be at least 2 characters')
      return
    }

    if (trimmed.length > 20) {
      setLocalError('Name must be 20 characters or less')
      return
    }

    if (!/^[a-zA-Z0-9_ ]+$/.test(trimmed)) {
      setLocalError('Only letters, numbers, underscores, and spaces allowed')
      return
    }

    const success = await onSubmit(trimmed)
    // Don't set local error - parent will pass the real error via props
    if (!success && !error) {
      setLocalError('Failed to set display name. Try a different one.')
    }
  }

  const displayError = error || localError

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-4">
      <div className="text-center space-y-2">
        <div className="text-4xl">🐿️</div>
        <h2 className="text-white text-lg font-semibold">Join the Chat</h2>
        <p className="text-stream-muted text-sm">
          Enter a display name to start chatting with Phil
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your display name..."
          disabled={isSubmitting}
          maxLength={20}
          className="w-full bg-stream-gray border border-stream-border rounded-lg px-4 py-3 text-white placeholder-stream-muted focus:outline-none focus:border-stream-muted disabled:opacity-50"
          autoFocus
        />

        {displayError && (
          <p className="text-red-400 text-sm text-center">{displayError}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="w-full bg-live-red hover:bg-red-600 disabled:bg-stream-gray disabled:text-stream-muted text-white font-medium py-3 rounded-lg transition-colors"
        >
          {isSubmitting ? 'Joining...' : 'Join Chat'}
        </button>
      </form>

      <p className="text-stream-muted text-xs text-center">
        You can watch without joining, but you need a name to chat
      </p>
    </div>
  )
}
