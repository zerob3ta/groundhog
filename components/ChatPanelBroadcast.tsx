'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePhil } from '@/lib/phil-context'
import { useBroadcastContext } from '@/lib/broadcast-context'
import type { ClientMessage } from '@/lib/hooks/useBroadcast'
import DisplayNameForm from './DisplayNameForm'
import type { Chatter } from '@/lib/chatters'

// Filter out stage directions from Phil's responses (for display)
function filterStageDirections(text: string): string {
  let filtered = text.replace(/\*[^*]+\*/g, '')
  const stagePatterns = [
    /\((?:sighs?|pauses?|laughs?|chuckles?|grins?|smiles?|frowns?|shakes? head|nods?|shrugs?|looks? (?:away|around|at|down|up)|stares?|blinks?|yawns?|stretches?|leans?|stands?|sits?|walks?|turns?|points?|gestures?|waves?|rolls? eyes?|raises? (?:eyebrow|hand)|clears? throat|coughs?|snorts?|mutters?|whispers?|trails? off|beat|long pause|short pause|silence|quietly|sarcastically|deadpan|flatly)[^)]*\)/gi,
  ]
  for (const pattern of stagePatterns) {
    filtered = filtered.replace(pattern, '')
  }
  filtered = filtered.replace(/\[(?:pause|beat|silence|sighs?|laughs?)[^\]]*\]/gi, '')
  filtered = filtered.replace(/\s+/g, ' ').trim()
  filtered = filtered.replace(/^\s*[,;]\s*/, '').replace(/\s*[,;]\s*$/, '')
  return filtered
}

export default function ChatPanelBroadcast() {
  const [inputValue, setInputValue] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [isSettingName, setIsSettingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const localAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const currentAudioUrlRef = useRef<string | null>(null)
  const audioQueueRef = useRef<{ id: string; url: string }[]>([])
  const playedAudioIdsRef = useRef<Set<string>>(new Set()) // Track already-queued audio to prevent re-queueing
  const isPlayingRef = useRef(false)

  const { setIsTalking, setMouthOpen } = usePhil()

  // Use broadcast context
  const {
    isConnected,
    clientId,
    error: connectionError,
    messages,
    viewers,
    isPhilTyping,
    displayName,
    setDisplayName,
    sendMessage,
  } = useBroadcastContext()

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Watch for new Phil messages with audio
  useEffect(() => {
    const philMessagesWithAudio = messages.filter(
      m => m.sender === 'phil' && m.audioUrl
    )

    // Queue any new audio (check against played set, not just current queue)
    for (const msg of philMessagesWithAudio) {
      if (!playedAudioIdsRef.current.has(msg.id)) {
        playedAudioIdsRef.current.add(msg.id) // Mark as queued immediately
        audioQueueRef.current.push({ id: msg.id, url: msg.audioUrl! })
      }
    }

    // Try to play next in queue
    processAudioQueue()
  }, [messages])

  // Analyze audio volume and update mouth open state
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    let sum = 0
    const speechRange = Math.floor(dataArray.length * 0.3)
    for (let i = 0; i < speechRange; i++) {
      sum += dataArray[i]
    }
    const average = sum / speechRange
    const mouthValue = Math.min(1, average / 128)
    setMouthOpen(mouthValue)

    animationFrameRef.current = requestAnimationFrame(analyzeAudio)
  }, [setMouthOpen])

  // Clean up audio resources
  const cleanupAudio = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect()
      } catch {
        // Already disconnected
      }
      sourceNodeRef.current = null
    }
    if (localAudioRef.current) {
      localAudioRef.current.pause()
      localAudioRef.current.onplay = null
      localAudioRef.current.onended = null
      localAudioRef.current.onerror = null
      localAudioRef.current.src = ''
      localAudioRef.current = null
    }
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current)
      currentAudioUrlRef.current = null
    }
  }, [])

  // Process audio queue
  const processAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || isMuted) return
    if (audioQueueRef.current.length === 0) return

    const next = audioQueueRef.current.shift()
    if (!next) return

    isPlayingRef.current = true

    try {
      // Fetch audio
      const response = await fetch(next.url)
      if (!response.ok) {
        isPlayingRef.current = false
        processAudioQueue()
        return
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      cleanupAudio()

      const audio = new Audio(audioUrl)
      localAudioRef.current = audio
      currentAudioUrlRef.current = audioUrl

      // Create or reuse audio context
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext()
      }

      // Create analyser
      if (!analyserRef.current) {
        analyserRef.current = audioContextRef.current.createAnalyser()
        analyserRef.current.fftSize = 256
        analyserRef.current.connect(audioContextRef.current.destination)
      }

      const source = audioContextRef.current.createMediaElementSource(audio)
      source.connect(analyserRef.current)
      sourceNodeRef.current = source

      audio.onplay = () => {
        setIsTalking(true)
        analyzeAudio()
      }

      audio.onended = () => {
        setIsTalking(false)
        setMouthOpen(0)
        isPlayingRef.current = false
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
        // Process next in queue
        processAudioQueue()
      }

      audio.onerror = () => {
        setIsTalking(false)
        setMouthOpen(0)
        isPlayingRef.current = false
        processAudioQueue()
      }

      await audio.play().catch(() => {
        isPlayingRef.current = false
        processAudioQueue()
      })
    } catch (err) {
      console.error('[Audio] Error playing audio:', err)
      isPlayingRef.current = false
      processAudioQueue()
    }
  }, [isMuted, cleanupAudio, setIsTalking, setMouthOpen, analyzeAudio])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudio()
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [cleanupAudio])

  const handleSend = async () => {
    if (!inputValue.trim()) return

    if (!displayName) {
      // Show display name form
      setIsSettingName(true)
      return
    }

    const text = inputValue
    setInputValue('')

    const success = await sendMessage(text)
    if (!success) {
      // Restore input on failure
      setInputValue(text)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSetDisplayName = async (name: string): Promise<boolean> => {
    setNameError(null)
    const result = await setDisplayName(name)
    if (result.success) {
      setIsSettingName(false)
      return true
    }
    setNameError(result.error || 'That name is taken or invalid. Try another.')
    return false
  }

  const toggleMute = () => {
    if (!isMuted && localAudioRef.current) {
      localAudioRef.current.pause()
      setIsTalking(false)
      setMouthOpen(0)
      isPlayingRef.current = false
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
    setIsMuted(!isMuted)
  }

  // Show display name form if needed
  if (isSettingName || (!displayName && inputValue.trim())) {
    return (
      <div className="h-full flex flex-col bg-stream-dark">
        <div className="p-4 border-b border-stream-border">
          <h2 className="text-white font-semibold">Live Chat</h2>
          <p className="text-stream-muted text-xs flex items-center gap-2">
            {isConnected ? (
              <>
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                {viewers} watching
              </>
            ) : (
              <>
                <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full"></span>
                Connecting...
              </>
            )}
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          {isConnected && clientId ? (
            <DisplayNameForm
              onSubmit={handleSetDisplayName}
              error={nameError}
            />
          ) : (
            <div className="text-center space-y-2 p-6">
              <div className="text-4xl">🐿️</div>
              <p className="text-stream-muted">Connecting to Phil...</p>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setIsSettingName(false)
            setInputValue('') // Clear input so we don't immediately re-show the form
          }}
          className="p-4 text-stream-muted hover:text-white text-sm"
        >
          Cancel - just watch
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-stream-dark">
      {/* Chat header */}
      <div className="p-4 border-b border-stream-border flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold">Live Chat</h2>
          <p className="text-stream-muted text-xs flex items-center gap-2">
            {isConnected ? (
              <>
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                {viewers} watching
              </>
            ) : (
              <>
                <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full"></span>
                Reconnecting...
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleMute}
            className="p-2 rounded-full hover:bg-stream-gray transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <svg className="w-5 h-5 text-stream-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 chat-scrollbar">
        {messages.filter(m => m.sender !== 'phil').map((message) => (
          <ChatMessage key={message.id} message={message} currentUserName={displayName} />
        ))}

        {/* Phil thinking indicator */}
        {isPhilTyping && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-phil-brown flex items-center justify-center text-xs">
              🐿️
            </div>
            <span className="text-stream-muted text-sm italic">Phil is thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Connection error banner */}
      {connectionError && (
        <div className="px-4 py-2 bg-red-900/50 border-t border-red-700">
          <p className="text-red-200 text-sm">{connectionError}</p>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-stream-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={displayName ? "Say something..." : "Set a name to chat..."}
            className="flex-1 bg-stream-gray border border-stream-border rounded-full px-4 py-2 text-white placeholder-stream-muted focus:outline-none focus:border-stream-muted"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || !isConnected}
            className="bg-live-red hover:bg-red-600 disabled:bg-stream-gray disabled:text-stream-muted text-white px-4 py-2 rounded-full transition-colors"
          >
            Send
          </button>
        </div>
        {displayName && (
          <p className="text-stream-muted text-xs mt-2">
            Chatting as <span className="text-blue-400">{displayName}</span>
          </p>
        )}
      </div>
    </div>
  )
}

// User message color - a nice teal that fits with the stream theme
const USER_COLOR = '#3b82f6' // Blue-500

// Individual message component
function ChatMessage({ message, currentUserName }: { message: ClientMessage; currentUserName: string | null }) {
  const isChatter = message.sender === 'chatter'
  const isUser = message.sender === 'user'

  // Chatter messages
  if (isChatter && message.chatter) {
    return (
      <div className="flex items-start gap-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
          style={{ backgroundColor: message.chatter.color + '40' }}
        >
          <span style={{ color: message.chatter.color }}>●</span>
        </div>
        <div className="flex-1 min-w-0">
          <span
            className="text-xs font-semibold mr-2"
            style={{ color: message.chatter.color }}
          >
            {message.chatter.username}
          </span>
          <span className="text-sm text-stream-text">{message.text}</span>
        </div>
      </div>
    )
  }

  // User messages
  if (isUser) {
    // Check if this message is from the current user
    const isOwnMessage = currentUserName && message.senderName === currentUserName

    // Own messages: right-aligned bubble style
    if (isOwnMessage) {
      return (
        <div className="flex items-start gap-2 justify-end">
          <div className="max-w-[75%] rounded-2xl rounded-br-sm px-3 py-2 bg-blue-600">
            <p className="text-xs text-blue-200 mb-0.5 font-medium">You</p>
            <p className="text-sm text-white leading-relaxed">{message.text}</p>
          </div>
        </div>
      )
    }

    // Other users' messages: styled like chatters
    return (
      <div className="flex items-start gap-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
          style={{ backgroundColor: USER_COLOR + '40' }}
        >
          <span style={{ color: USER_COLOR }}>●</span>
        </div>
        <div className="flex-1 min-w-0">
          <span
            className="text-xs font-semibold mr-2"
            style={{ color: USER_COLOR }}
          >
            {message.senderName}
          </span>
          <span className="text-sm text-stream-text">{message.text}</span>
        </div>
      </div>
    )
  }

  // Phil messages (shouldn't show here since we filter them)
  return null
}
