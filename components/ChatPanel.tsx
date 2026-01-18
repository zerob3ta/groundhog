'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePhil } from '@/lib/phil-context'
import type { Chatter, ChatterType } from '@/lib/chatters'
import { extractMentionedUsernames } from '@/lib/chatters'
import { PHIL_DEAD_AIR_FILLERS } from '@/lib/phil-corpus'
import {
  type SessionState,
  getSeasonLevel,
  logStateChange,
} from '@/lib/session-state'
import { calculateChaos } from '@/lib/trait-system'
import {
  processPhilMessage,
  processIncomingMessage,
  applyWinterTrigger,
  applySpringTrigger,
  applySeasonDecay,
  trackTopic,
  trackChatterInteraction,
  updateChatterRelationship,
  maybeLearnFact,
  trackChatterMessage,
} from '@/lib/state-updates'
import {
  extractTopics,
  mightContainFact,
  isChallenging,
  isInterestingTopic,
  isBoringTopic,
} from '@/lib/topic-extractor'
import {
  analyzeRequest,
  calculateSuggestibility,
  markCompliance,
} from '@/lib/suggestibility'
import { useSession } from '@/lib/session-context'
import { deriveEmotionalState } from '@/lib/emotion-system'
import {
  getRandomAutonomousEvent,
  getNextEventDelay,
  shouldFireEvent,
} from '@/lib/autonomous-events'
import {
  checkAndApplyShock,
  formatTimeUntilShock,
} from '@/lib/shock-system'

// Filter out stage directions from Phil's responses
// Matches: *action*, (action), [action that looks like stage direction]
function filterStageDirections(text: string): string {
  // Remove *action* patterns (asterisk-wrapped)
  let filtered = text.replace(/\*[^*]+\*/g, '')

  // Remove (action) patterns that look like stage directions
  // But preserve normal parenthetical content like (for example)
  const stagePatterns = [
    /\((?:sighs?|pauses?|laughs?|chuckles?|grins?|smiles?|frowns?|shakes? head|nods?|shrugs?|looks? (?:away|around|at|down|up)|stares?|blinks?|yawns?|stretches?|leans?|stands?|sits?|walks?|turns?|points?|gestures?|waves?|rolls? eyes?|raises? (?:eyebrow|hand)|clears? throat|coughs?|snorts?|mutters?|whispers?|trails? off|beat|long pause|short pause|silence|quietly|sarcastically|deadpan|flatly)[^)]*\)/gi,
  ]
  for (const pattern of stagePatterns) {
    filtered = filtered.replace(pattern, '')
  }

  // Remove [STAGE DIRECTION] style brackets if they look like directions
  filtered = filtered.replace(/\[(?:pause|beat|silence|sighs?|laughs?)[^\]]*\]/gi, '')

  // Clean up extra whitespace
  filtered = filtered.replace(/\s+/g, ' ').trim()

  // Remove leading/trailing punctuation orphans
  filtered = filtered.replace(/^\s*[,;]\s*/, '').replace(/\s*[,;]\s*$/, '')

  return filtered
}

interface Message {
  id: string
  sender: 'user' | 'phil' | 'chatter'
  text: string
  timestamp: Date
  chatter?: Chatter // Only present for chatter messages
}

// Phil's intro message
const initialMessages: Message[] = [
  {
    id: '1',
    sender: 'phil',
    text: "Alright, alright, I'm here. Phil, live from the Knob, 147 years in the game. You're welcome. Go ahead, ask me something - but make it interesting, I've literally heard everything.",
    timestamp: new Date(Date.now() - 60000),
  },
]

// Queue item types
interface QueueItem {
  id: string
  text: string
  priority: 'response' | 'deadair'
  timestamp: number
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [inputValue, setInputValue] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [chattersEnabled, setChattersEnabled] = useState(true)
  const [lastRoastedChatter, setLastRoastedChatter] = useState<string | null>(null)
  const [escalationCount, setEscalationCount] = useState(0) // Track back-and-forth depth
  const [cooldownChatters, setCooldownChatters] = useState<Map<string, number>>(new Map()) // username -> cooldown end timestamp

  // Session state from context (shared with SeasonMeter overlay)
  const { sessionState, updateSessionState: contextUpdateState, syncDisplayState } = useSession()
  // Keep a ref for synchronous access during async operations
  const sessionStateRef = useRef<SessionState>(sessionState)
  // Sync ref when context state changes
  useEffect(() => {
    sessionStateRef.current = sessionState
  }, [sessionState])

  // Queue system - responses have priority over dead air
  const responseQueueRef = useRef<QueueItem[]>([])
  const deadAirQueueRef = useRef<QueueItem[]>([])
  const isProcessingQueueRef = useRef(false)
  const isGeneratingDeadAirRef = useRef(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const localAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const currentAudioUrlRef = useRef<string | null>(null)
  const chatterIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const deadAirGeneratorRef = useRef<NodeJS.Timeout | null>(null)
  const queueProcessorRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const seasonDecayRef = useRef<NodeJS.Timeout | null>(null)
  const autonomousEventRef = useRef<NodeJS.Timeout | null>(null)
  const lastAutonomousEventRef = useRef<number>(Date.now())
  const shockCheckRef = useRef<NodeJS.Timeout | null>(null)
  const { setIsTalking, setMouthOpen, setEmotionalState } = usePhil()

  // Helper to update session state (uses context, syncs ref)
  const updateSessionState = useCallback((updater: (state: SessionState) => SessionState) => {
    contextUpdateState(updater)
  }, [contextUpdateState])

  // Process an incoming message (user or chatter) - updates state before Phil responds
  const handleIncomingMessage = useCallback((
    messageText: string,
    senderType: 'user' | 'chatter',
    chatterType?: string,
    username?: string,
    messageContent?: string
  ) => {
    updateSessionState(state => {
      let newState = state

      // Process the incoming message (energy recharge, season effects)
      // Pass messageContent for user messages so sentiment can be analyzed
      newState = processIncomingMessage(newState, senderType, chatterType, username, messageContent)

      // Extract and track topics
      const { topics, isMeta, isBoring, sentiment } = extractTopics(messageText)

      for (const topic of topics) {
        newState = trackTopic(newState, topic, 'chat', sentiment)

        // Apply season effects based on topic
        if (isInterestingTopic(topic)) {
          newState = applySpringTrigger(newState, 'good_question')
        } else if (isBoringTopic(topic)) {
          newState = applyWinterTrigger(newState, 'boring')
        }
      }

      // Meta references (AI/bot/fake) trigger winter
      if (isMeta) {
        newState = applyWinterTrigger(newState, 'meta')
      }

      // Boring questions trigger winter
      if (isBoring && topics.length === 0) {
        newState = applyWinterTrigger(newState, 'boring')
      }

      // Check for potential fact corruption
      const potentialFact = mightContainFact(messageText)
      if (potentialFact && username) {
        newState = maybeLearnFact(newState, potentialFact, username)
      }

      // Log current state summary
      const seasonLevel = getSeasonLevel(newState)
      const chaos = calculateChaos(newState)
      logStateChange('State', 'After incoming message', {
        mood: newState.phil.mood,
        season: seasonLevel,
        chaos: Math.round(chaos * 100),
      })

      return newState
    })
  }, [updateSessionState])

  // Process Phil's response - updates state after Phil speaks
  const handlePhilResponse = useCallback((
    responseText: string,
    sentiment: 'positive' | 'negative' | 'neutral' = 'neutral',
    mentionedChatter?: string
  ) => {
    updateSessionState(state => {
      let newState = processPhilMessage(state, responseText, sentiment)

      // Track any chatter that was roasted
      if (mentionedChatter) {
        newState = trackChatterInteraction(newState, mentionedChatter, true)

        // Update relationship based on escalation count
        if (escalationCount >= 2) {
          newState = updateChatterRelationship(newState, mentionedChatter, 'nemesis')
        }
      }

      // Extract topics from Phil's response
      const { topics } = extractTopics(responseText)
      for (const topic of topics) {
        newState = trackTopic(newState, topic, 'phil')
      }

      // Log current state
      const seasonLevel = getSeasonLevel(newState)
      const chaos = Math.abs(newState.phil.season - 50) / 50
      logStateChange('State', 'After Phil response', {
        mood: newState.phil.mood,
        seasonLevel,
        season: newState.phil.season,
        chaos: `${Math.round(chaos * 100)}%`,
      })

      // Derive and sync emotional state for animations
      const emotionalState = deriveEmotionalState(newState)
      setEmotionalState(emotionalState)
      logStateChange('Emotion', `${emotionalState.primary} (${emotionalState.intensity})`, {
        physical: emotionalState.physicalState,
        secondary: emotionalState.secondary || 'none',
      })

      return newState
    })
  }, [escalationCount, updateSessionState, setEmotionalState])

  // Check if a chatter is in cooldown
  const isInCooldown = useCallback((username: string) => {
    const cooldownEnd = cooldownChatters.get(username)
    if (!cooldownEnd) return false
    return Date.now() < cooldownEnd
  }, [cooldownChatters])

  // Add a chatter to cooldown (30-45 seconds)
  const addToCooldown = useCallback((username: string) => {
    const cooldownDuration = 30000 + Math.random() * 15000 // 30-45 seconds
    setCooldownChatters(prev => {
      const newMap = new Map(prev)
      newMap.set(username, Date.now() + cooldownDuration)
      return newMap
    })
  }, [])

  // Get list of cooled-down chatters for Phil to ignore
  const getCooldownList = useCallback(() => {
    const now = Date.now()
    return Array.from(cooldownChatters.entries())
      .filter(([, endTime]) => now < endTime)
      .map(([username]) => username)
  }, [cooldownChatters])

  // Generate a context-aware prompt for Phil when he hasn't spoken in a while
  const getDeadAirPrompt = useCallback((msgs: Message[]) => {
    // Find messages since Phil's last response
    let messagesSincePhil: Message[] = []
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].sender === 'phil') break
      messagesSincePhil.unshift(msgs[i])
    }

    // Check actual timing - is chat truly dead or just Phil being quiet?
    const lastNonPhilMessage = msgs.filter(m => m.sender !== 'phil').pop()
    const timeSinceLastMessage = lastNonPhilMessage
      ? Date.now() - lastNonPhilMessage.timestamp.getTime()
      : 60000

    const chatIsActuallyDead = timeSinceLastMessage > 15000 // 15+ seconds of no messages

    // Get chatters Phil has interacted with for callbacks
    const allChatters = msgs
      .filter(m => m.sender === 'chatter' && m.chatter)
      .map(m => ({ username: m.chatter!.username, text: m.text }))

    // Get recent chatters who said something
    const recentChatters = messagesSincePhil
      .filter(m => m.sender === 'chatter' && m.chatter)
      .map(m => ({ username: m.chatter!.username, text: m.text }))

    // Build context-specific prompts
    const prompts: string[] = []

    // If there are chatters Phil hasn't responded to yet, respond to them
    if (recentChatters.length > 0) {
      const chatterToAddress = recentChatters[Math.floor(Math.random() * recentChatters.length)]
      prompts.push(
        `[SYSTEM: ${chatterToAddress.username} said "${chatterToAddress.text}" and you haven't responded. React to it - roast them, answer them, or call them out. Keep it short.]`
      )
    }

    // Ruminate on something from earlier
    if (allChatters.length > 2) {
      const oldChatter = allChatters[Math.floor(Math.random() * Math.min(allChatters.length - 2, 5))]
      prompts.push(
        `[SYSTEM: You're still thinking about what ${oldChatter.username} said earlier ("${oldChatter.text.slice(0, 50)}..."). Circle back to it. "You know what, that thing ${oldChatter.username} said..." or "Still thinking about..."]`
      )
    }

    // Random tangent based on the vibe
    prompts.push(
      `[SYSTEM: Go on a brief tangent. Something reminded you of a memory, an opinion you have, or a story. Trail off mid-thought if you want. One or two sentences max.]`
    )

    // Mutter about environment/situation (always available)
    prompts.push(
      `[SYSTEM: Mutter about your current situation - the shadow, Phyllis, the burrow, 147 years of this, whatever's on your mind. One short comment to yourself.]`
    )

    // ONLY complain about silence if chat is actually dead (no messages in 15+ seconds)
    if (chatIsActuallyDead && messagesSincePhil.length === 0) {
      prompts.push(
        `[SYSTEM: The chat has actually gone quiet. Comment on the silence - "${PHIL_DEAD_AIR_FILLERS[Math.floor(Math.random() * PHIL_DEAD_AIR_FILLERS.length)]}" or something similar. Be annoyed or bemused.]`
      )
    }

    // Weight selection: prioritize responding to recent chatters
    if (recentChatters.length > 0 && Math.random() < 0.6) {
      return prompts[0] // 60% chance to respond to recent chatter
    }

    // Otherwise pick randomly from available prompts
    return prompts[Math.floor(Math.random() * prompts.length)]
  }, [])

  // Analyze audio volume and update mouth open state
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    // Calculate average volume (focus on speech frequencies)
    let sum = 0
    const speechRange = Math.floor(dataArray.length * 0.3) // Lower frequencies for speech
    for (let i = 0; i < speechRange; i++) {
      sum += dataArray[i]
    }
    const average = sum / speechRange

    // Normalize to 0-1 range with some smoothing
    const mouthValue = Math.min(1, average / 128)
    setMouthOpen(mouthValue)

    animationFrameRef.current = requestAnimationFrame(analyzeAudio)
  }, [setMouthOpen])

  // Clean up audio resources to prevent memory leaks
  const cleanupAudio = useCallback(() => {
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    // Disconnect source node (prevents accumulation)
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect()
      } catch {
        // Already disconnected
      }
      sourceNodeRef.current = null
    }
    // Stop and clear audio element
    if (localAudioRef.current) {
      localAudioRef.current.pause()
      localAudioRef.current.onplay = null
      localAudioRef.current.onended = null
      localAudioRef.current.onerror = null
      localAudioRef.current.src = ''
      localAudioRef.current = null
    }
    // Revoke object URL
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current)
      currentAudioUrlRef.current = null
    }
  }, [])

  // Play audio with Phil's voice - handles setup and cleanup
  const playPhilAudio = useCallback(async (
    text: string,
    onMessageAdd: () => void
  ): Promise<boolean> => {
    try {
      const voiceResponse = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!voiceResponse.ok) {
        return false
      }

      const audioBlob = await voiceResponse.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      // Clean up previous audio resources
      cleanupAudio()

      const audio = new Audio(audioUrl)
      localAudioRef.current = audio
      currentAudioUrlRef.current = audioUrl

      // Create or reuse audio context
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext()
      }

      // Create analyser once and reuse
      if (!analyserRef.current) {
        analyserRef.current = audioContextRef.current.createAnalyser()
        analyserRef.current.fftSize = 256
        analyserRef.current.connect(audioContextRef.current.destination)
      }

      const source = audioContextRef.current.createMediaElementSource(audio)
      source.connect(analyserRef.current)
      sourceNodeRef.current = source

      return new Promise((resolve) => {
        audio.onplay = () => {
          onMessageAdd()
          setIsTalking(true)
          analyzeAudio()
        }

        audio.onended = () => {
          setIsPlayingAudio(false)
          setIsTalking(false)
          setMouthOpen(0)
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
            animationFrameRef.current = null
          }
          resolve(true)
        }

        audio.onerror = () => {
          onMessageAdd()
          setIsPlayingAudio(false)
          setIsTalking(false)
          setMouthOpen(0)
          resolve(false)
        }

        audio.play().catch(() => {
          onMessageAdd()
          setIsPlayingAudio(false)
          resolve(false)
        })
      })
    } catch {
      return false
    }
  }, [cleanupAudio, setIsTalking, setMouthOpen, analyzeAudio])

  // Generate dead air content in the background
  const generateDeadAirContent = useCallback(async () => {
    if (isGeneratingDeadAirRef.current) return
    if (deadAirQueueRef.current.length >= 2) return // Keep max 2 dead air items queued

    isGeneratingDeadAirRef.current = true
    console.log('[Dead air] Generating new dead air content...')

    try {
      // Build conversation history for context
      const conversationHistory: { role: string; content: string }[] = []
      let currentChatBundle: string[] = []

      const flushChatBundle = () => {
        if (currentChatBundle.length > 0) {
          conversationHistory.push({
            role: 'user',
            content: currentChatBundle.join('\n'),
          })
          currentChatBundle = []
        }
      }

      for (const msg of messages.slice(1)) {
        if (msg.sender === 'phil') {
          flushChatBundle()
          conversationHistory.push({ role: 'assistant', content: msg.text })
        } else if (msg.sender === 'chatter') {
          currentChatBundle.push(`[\${msg.chatter?.username}]: ${msg.text}`)
        } else {
          currentChatBundle.push(`[USER]: ${msg.text}`)
        }
      }

      // Add dead air prompt
      const deadAirPrompt = getDeadAirPrompt(messages)
      currentChatBundle.push(deadAirPrompt)
      flushChatBundle()

      // Apply silence-based winter trigger before generating dead air
      updateSessionState(state => applyWinterTrigger(state, 'silence'))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationHistory,
          sessionState: sessionStateRef.current,
        }),
      })

      if (!response.ok) throw new Error('API request failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
      }

      // Filter out any stage directions from the response
      const filteredText = filterStageDirections(fullText)
      if (!filteredText) return // Skip if nothing left after filtering

      // Process the dead air response (updates state)
      handlePhilResponse(filteredText, 'neutral')

      // Add to dead air queue
      const item: QueueItem = {
        id: Date.now().toString(),
        text: filteredText,
        priority: 'deadair',
        timestamp: Date.now(),
      }
      deadAirQueueRef.current.push(item)
      console.log(`[Dead air] Generated: "${filteredText.slice(0, 50)}..." Queue size: ${deadAirQueueRef.current.length}`)

    } catch (error) {
      console.error('[Dead air] Generation error:', error)
    } finally {
      isGeneratingDeadAirRef.current = false
    }
  }, [messages, getDeadAirPrompt])

  // Process the queue - play next item when Phil is free
  const processQueue = useCallback(async () => {
    if (isProcessingQueueRef.current || isPlayingAudio || isThinking) return

    // Check response queue first (priority)
    let item: QueueItem | undefined = responseQueueRef.current.shift()

    // If no responses, check dead air queue
    if (!item && deadAirQueueRef.current.length > 0) {
      // Only use dead air if it's recent enough (within 30 seconds)
      const deadAirItem = deadAirQueueRef.current[0]
      if (Date.now() - deadAirItem.timestamp < 30000) {
        item = deadAirQueueRef.current.shift()
      } else {
        // Stale dead air, discard it
        deadAirQueueRef.current.shift()
        console.log('[Queue] Discarded stale dead air')
      }
    }

    if (!item) return

    isProcessingQueueRef.current = true
    console.log(`[Queue] Processing ${item.priority}: "${item.text.slice(0, 50)}..."`)

    const philMessage: Message = {
      id: item.id,
      sender: 'phil',
      text: item.text,
      timestamp: new Date(),
    }

    if (isMuted) {
      setMessages((prev) => [...prev, philMessage])
      isProcessingQueueRef.current = false
      // Check if there's more in the queue
      setTimeout(() => processQueue(), 500)
    } else {
      setIsPlayingAudio(true)
      const success = await playPhilAudio(item.text, () => {
        setMessages((prev) => [...prev, philMessage])
      })
      if (!success) {
        setMessages((prev) => [...prev, philMessage])
        setIsPlayingAudio(false)
      }
      isProcessingQueueRef.current = false
      // Small delay before processing next item
      setTimeout(() => processQueue(), 800)
    }
  }, [isPlayingAudio, isThinking, isMuted, playPhilAudio])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Count chatters since Phil's last message
  const chattersSincePhil = useCallback(() => {
    let count = 0
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender === 'phil') break
      if (messages[i].sender === 'chatter') count++
    }
    return count
  }, [messages])

  // Make Phil respond to chatters (no user message needed)
  const respondToChatters = useCallback(async () => {
    if (isThinking || isPlayingAudio) return

    setIsThinking(true)

    // Build conversation history - bundle chatters since last Phil message
    const conversationHistory: { role: string; content: string }[] = []
    let currentChatBundle: string[] = []

    const flushChatBundle = () => {
      if (currentChatBundle.length > 0) {
        conversationHistory.push({
          role: 'user',
          content: currentChatBundle.join('\n'),
        })
        currentChatBundle = []
      }
    }

    for (const msg of messages.slice(1)) {
      if (msg.sender === 'phil') {
        flushChatBundle()
        conversationHistory.push({ role: 'assistant', content: msg.text })
      } else if (msg.sender === 'chatter') {
        currentChatBundle.push(`[\${msg.chatter?.username}]: ${msg.text}`)
      } else {
        currentChatBundle.push(`[USER]: ${msg.text}`)
      }
    }

    // Add instruction for Phil to react to chatters
    currentChatBundle.push(`[SYSTEM: React to the chatters above. No user message - just respond to the chat. Keep it short, roast someone or make a comment about the chat.]`)
    flushChatBundle()

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationHistory,
          sessionState: sessionStateRef.current,
        }),
      })

      if (!response.ok) throw new Error('API request failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
      }

      setIsThinking(false)

      // Filter out any stage directions from the response
      const filteredText = filterStageDirections(fullText)
      if (!filteredText) return // Skip if nothing left after filtering

      const philMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'phil',
        text: filteredText,
        timestamp: new Date(),
      }

      // Track who Phil roasted for escalation
      const knownChatters = messages
        .filter(m => m.sender === 'chatter' && m.chatter)
        .map(m => m.chatter!.username)
      const mentioned = extractMentionedUsernames(filteredText, knownChatters)
      let mentionedChatter: string | undefined
      if (mentioned.length > 0) {
        mentionedChatter = mentioned[0]
        // Check if this continues an escalation with the same person
        if (mentionedChatter === lastRoastedChatter) {
          const newCount = escalationCount + 1
          if (newCount >= 3) {
            // Hit the limit - put this chatter in cooldown, Phil moves on
            addToCooldown(mentionedChatter)
            setLastRoastedChatter(null)
            setEscalationCount(0)
          } else {
            setEscalationCount(newCount)
          }
        } else {
          // New target, reset escalation
          setLastRoastedChatter(mentionedChatter)
          setEscalationCount(1)
        }
      } else {
        // Phil didn't roast anyone specific, reset
        setEscalationCount(0)
      }

      // Process Phil's response (updates session state)
      handlePhilResponse(filteredText, 'neutral', mentionedChatter)

      // Add to response queue (will be processed with priority)
      const queueItem: QueueItem = {
        id: (Date.now() + 1).toString(),
        text: filteredText,
        priority: 'response',
        timestamp: Date.now(),
      }
      responseQueueRef.current.push(queueItem)
      console.log(`[Queue] Added chatter response. Queue size: ${responseQueueRef.current.length}`)

      // Clear any stale dead air since we have a fresh response
      deadAirQueueRef.current = []

    } catch (error) {
      console.error('Phil chatter response error:', error)
    } finally {
      setIsThinking(false)
    }
  }, [messages, isThinking, isPlayingAudio, lastRoastedChatter, escalationCount, addToCooldown])

  // Fetch a chatter message
  const fetchChatterMessage = useCallback(async () => {
    if (!chattersEnabled) return

    try {
      const recentMessages = messages.slice(-8).map((m) => ({
        role: m.sender === 'phil' ? 'assistant' : 'user',
        content: m.text,
        sender: m.sender === 'chatter' ? m.chatter?.username : m.sender,
      }))

      // Pass preferredChatter for escalation (but not if they're in cooldown)
      const escalationTarget = lastRoastedChatter && !isInCooldown(lastRoastedChatter)
        ? lastRoastedChatter
        : null

      const response = await fetch('/api/chatter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recentMessages,
          preferredChatter: escalationTarget, // Escalation target (null if cooled down)
          sessionState: sessionStateRef.current,
        }),
      })

      if (!response.ok) return

      const { chatter, message } = await response.json()

      // Process incoming chatter message (updates session state)
      handleIncomingMessage(message, 'chatter', chatter.type, chatter.username)

      // Track chatter message for anti-repetition
      updateSessionState(state => trackChatterMessage(state, chatter.type as ChatterType, message))

      const chatterMessage: Message = {
        id: Date.now().toString(),
        sender: 'chatter',
        text: message,
        timestamp: new Date(),
        chatter,
      }

      setMessages((prev) => [...prev, chatterMessage])

      // Check if this is an escalation (roasted chatter responding back)
      const isEscalation = lastRoastedChatter === chatter.username

      // Phil responds more during escalation, less otherwise
      const chatterCount = chattersSincePhil() + 1
      let responseChance: number
      if (isEscalation && escalationCount < 4) {
        // High chance to continue the back-and-forth
        responseChance = 0.8
      } else {
        // Normal chance: 25% base, +10% per chatter, max 70%
        responseChance = Math.min(0.7, 0.25 + chatterCount * 0.1)
      }

      if (Math.random() < responseChance && !isThinking && !isPlayingAudio) {
        // Faster response during escalation
        const delay = isEscalation ? 800 + Math.random() * 1000 : 1500 + Math.random() * 2000
        setTimeout(() => {
          respondToChatters()
        }, delay)
      }
    } catch (error) {
      console.error('Chatter fetch error:', error)
    }
  }, [messages, chattersEnabled, chattersSincePhil, isThinking, isPlayingAudio, respondToChatters, lastRoastedChatter, escalationCount, isInCooldown])

  // Set up chatter interval
  useEffect(() => {
    if (!chattersEnabled) return

    // Faster intervals during escalation, chatters can appear while Phil talks
    const scheduleNextChatter = () => {
      const baseDelay = escalationCount > 0 ? 2000 : 3500
      const variance = escalationCount > 0 ? 2000 : 4000
      const delay = baseDelay + Math.random() * variance

      chatterIntervalRef.current = setTimeout(() => {
        // Only skip if Phil is thinking (generating response), not while speaking
        if (!isThinking) {
          fetchChatterMessage()
        }
        scheduleNextChatter()
      }, delay)
    }

    scheduleNextChatter()

    return () => {
      if (chatterIntervalRef.current) {
        clearTimeout(chatterIntervalRef.current)
      }
    }
  }, [chattersEnabled, isThinking, fetchChatterMessage, escalationCount])

  // Track when Phil last spoke (for dead air detection)
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.sender === 'phil') {
      lastActivityRef.current = Date.now()
    }
  }, [messages])

  // Store queue functions in refs for stable access
  const generateDeadAirRef = useRef(generateDeadAirContent)
  const processQueueRef = useRef(processQueue)
  useEffect(() => {
    generateDeadAirRef.current = generateDeadAirContent
    processQueueRef.current = processQueue
  }, [generateDeadAirContent, processQueue])

  // Background dead air generator - keeps queue populated
  useEffect(() => {
    const generateLoop = () => {
      // Generate dead air content if queue is low
      if (deadAirQueueRef.current.length < 2) {
        generateDeadAirRef.current()
      }
      deadAirGeneratorRef.current = setTimeout(generateLoop, 5000) // Check every 5 seconds
    }

    // Start generating after a short delay
    deadAirGeneratorRef.current = setTimeout(generateLoop, 3000)

    return () => {
      if (deadAirGeneratorRef.current) {
        clearTimeout(deadAirGeneratorRef.current)
      }
    }
  }, [])

  // Queue processor - triggers when Phil goes quiet
  useEffect(() => {
    const checkQueue = () => {
      const timeSinceActivity = Date.now() - lastActivityRef.current

      // If Phil hasn't spoken in 4+ seconds and isn't busy, process the queue
      if (timeSinceActivity > 4000) {
        processQueueRef.current()
      }
    }

    const interval = setInterval(checkQueue, 1500)
    return () => clearInterval(interval)
  }, [])

  // Season decay - natural drift toward equilibrium + time-based winter
  useEffect(() => {
    const decayInterval = setInterval(() => {
      // Apply natural decay toward 50/50
      updateSessionState(state => applySeasonDecay(state))

      // Apply time-passing winter trigger every minute
      const now = Date.now()
      const timeSinceStart = now - sessionStateRef.current.session.startTime
      if (timeSinceStart > 0 && timeSinceStart % 60000 < 10000) {
        updateSessionState(state => applyWinterTrigger(state, 'time'))
      }
    }, 10000) // Every 10 seconds

    return () => clearInterval(decayInterval)
  }, [updateSessionState])

  // Shock system - random events every ~5 minutes
  useEffect(() => {
    const checkShock = () => {
      updateSessionState(state => {
        const newState = checkAndApplyShock(state)
        if (newState !== state) {
          // A shock occurred - log it for visibility
          console.log(`[Shock] Applied! Next shock in: ${formatTimeUntilShock(newState)}`)

          // Derive and sync emotional state after shock
          const emotionalState = deriveEmotionalState(newState)
          setEmotionalState(emotionalState)
        }
        return newState
      })
    }

    // Check every 30 seconds (shock system has its own 5-minute timer internally)
    shockCheckRef.current = setInterval(checkShock, 30000)

    return () => {
      if (shockCheckRef.current) {
        clearInterval(shockCheckRef.current)
      }
    }
  }, [updateSessionState, setEmotionalState])

  // Note: Current events now handled by Gemini search grounding - no need to fetch separately

  // Autonomous events - random interruptions when Phil is idle
  useEffect(() => {
    const checkForAutonomousEvent = async () => {
      // Skip if Phil is busy or there's stuff in the queue
      if (isThinking || isPlayingAudio) return
      if (responseQueueRef.current.length > 0) return
      if (deadAirQueueRef.current.length > 0) return

      const state = sessionStateRef.current
      const timeSinceLastEvent = Date.now() - lastAutonomousEventRef.current

      // Check if we should fire an event
      const chaos = calculateChaos(state)
      if (!shouldFireEvent(timeSinceLastEvent, state.phil.season, chaos)) {
        return
      }

      // Get a random event based on current state
      const event = getRandomAutonomousEvent(state.phil.season, chaos)
      if (!event) return

      console.log(`[Event] Firing autonomous event: ${event.type}`)
      lastAutonomousEventRef.current = Date.now()

      // Generate Phil's response to the event
      try {
        const conversationHistory = messages.slice(-6).map(m => ({
          role: m.sender === 'phil' ? 'assistant' : 'user',
          content: m.sender === 'chatter'
            ? `[\${m.chatter?.username}]: ${m.text}`
            : m.text,
        }))

        // Add the event prompt
        conversationHistory.push({
          role: 'user',
          content: event.prompt,
        })

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: conversationHistory,
            sessionState: state,
          }),
        })

        if (!response.ok) return

        const reader = response.body?.getReader()
        if (!reader) return

        const decoder = new TextDecoder()
        let fullText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })
        }

        // Filter stage directions
        const filteredText = filterStageDirections(fullText)
        if (!filteredText) return

        // Process the response
        handlePhilResponse(filteredText, 'neutral')

        // Add to dead air queue (lower priority than responses)
        const item: QueueItem = {
          id: Date.now().toString(),
          text: filteredText,
          priority: 'deadair',
          timestamp: Date.now(),
        }
        deadAirQueueRef.current.push(item)
        console.log(`[Event] Generated response for ${event.type}: "${filteredText.slice(0, 50)}..."`)
      } catch (error) {
        console.error('[Event] Error generating autonomous event response:', error)
      }
    }

    // Check for autonomous events every 10-20 seconds
    const scheduleNextCheck = () => {
      const state = sessionStateRef.current
      const chaos = calculateChaos(state)
      const delay = getNextEventDelay(chaos) / 3 // Check more frequently, fire less often
      autonomousEventRef.current = setTimeout(() => {
        checkForAutonomousEvent()
        scheduleNextCheck()
      }, delay)
    }

    // Start checking after 30 seconds (let things settle)
    const initialDelay = setTimeout(() => {
      scheduleNextCheck()
    }, 30000)

    return () => {
      clearTimeout(initialDelay)
      if (autonomousEventRef.current) {
        clearTimeout(autonomousEventRef.current)
      }
    }
  }, [messages, isThinking, isPlayingAudio, updateSessionState])

  // Log session state on mount
  useEffect(() => {
    const state = sessionStateRef.current
    const chaos = calculateChaos(state)
    logStateChange('Session', 'Started', {
      mood: state.phil.mood,
      season: state.phil.season,
      chaos: `${Math.round(chaos * 100)}%`,
    })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up audio resources
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.disconnect() } catch { /* already disconnected */ }
      }
      if (localAudioRef.current) {
        localAudioRef.current.pause()
        localAudioRef.current.onplay = null
        localAudioRef.current.onended = null
        localAudioRef.current.onerror = null
        localAudioRef.current = null
      }
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      // Clean up timers
      if (chatterIntervalRef.current) {
        clearTimeout(chatterIntervalRef.current)
      }
      if (deadAirGeneratorRef.current) {
        clearTimeout(deadAirGeneratorRef.current)
      }
      if (autonomousEventRef.current) {
        clearTimeout(autonomousEventRef.current)
      }
      if (shockCheckRef.current) {
        clearInterval(shockCheckRef.current)
      }
    }
  }, [])

  const handleSend = async () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputValue,
      timestamp: new Date(),
    }

    // Process incoming user message (updates session state)
    // Pass the message content so sentiment can be analyzed
    handleIncomingMessage(inputValue, 'user', undefined, undefined, inputValue)

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsThinking(true)

    // Build conversation history for API - bundle chat messages between Phil responses
    const conversationHistory: { role: string; content: string }[] = []
    let currentChatBundle: string[] = []

    const flushChatBundle = () => {
      if (currentChatBundle.length > 0) {
        conversationHistory.push({
          role: 'user',
          content: currentChatBundle.join('\n'),
        })
        currentChatBundle = []
      }
    }

    // Process message history (skip the initial Phil message)
    for (const msg of messages.slice(1)) {
      if (msg.sender === 'phil') {
        flushChatBundle()
        conversationHistory.push({ role: 'assistant', content: msg.text })
      } else if (msg.sender === 'chatter') {
        currentChatBundle.push(`[\${msg.chatter?.username}]: ${msg.text}`)
      } else {
        currentChatBundle.push(`[YOU - respond to this person]: ${msg.text}`)
      }
    }

    // Add the new user message
    currentChatBundle.push(`[YOU - respond to this person]: ${userMessage.text}`)
    flushChatBundle()

    // Analyze message for suggestibility before API call
    const request = analyzeRequest(userMessage.text)
    const suggestibility = calculateSuggestibility(sessionStateRef.current, request)
    if (request.isRequest) {
      console.log(`[Suggestibility] Request detected: "${request.requestDescription}" | Score: ${suggestibility.score} | Will comply: ${suggestibility.willComply} | Style: ${suggestibility.complianceStyle}`)
    }

    try {
      abortControllerRef.current = new AbortController()

      // Fetch text response (don't stream to UI)
      // Pass userMessage for suggestibility analysis in prompt
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationHistory,
          sessionState: sessionStateRef.current,
          userMessage: userMessage.text, // For suggestibility analysis
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error('API request failed')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
      }

      // Filter out any stage directions from the response
      const filteredText = filterStageDirections(fullText)
      if (!filteredText) {
        setIsThinking(false)
        return // Skip if nothing left after filtering
      }

      // Process Phil's response (updates session state)
      handlePhilResponse(filteredText, 'positive') // User messages tend to generate positive interaction

      // Track compliance if Phil was expected to comply with a request
      if (suggestibility.willComply && request.isRequest) {
        console.log(`[Suggestibility] Marking compliance - Phil likely complied with: "${request.requestDescription}"`)
        updateSessionState(state => markCompliance(state))
      }

      // Add to front of response queue (user messages get top priority)
      const queueItem: QueueItem = {
        id: (Date.now() + 1).toString(),
        text: filteredText,
        priority: 'response',
        timestamp: Date.now(),
      }
      responseQueueRef.current.unshift(queueItem) // Add to front!
      console.log(`[Queue] Added user response (priority). Queue size: ${responseQueueRef.current.length}`)

      // Clear any stale dead air since we have a fresh response
      deadAirQueueRef.current = []

      setIsThinking(false)
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Request aborted')
      } else {
        console.error('Chat error:', error)
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'phil',
          text: "Yo, something's jawn with the connection. Try again in a sec.",
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
      }
      setIsThinking(false)
      setIsTalking(false)
      setMouthOpen(0)
    } finally {
      abortControllerRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleMute = () => {
    if (!isMuted && localAudioRef.current) {
      localAudioRef.current.pause()
      setIsPlayingAudio(false)
      setIsTalking(false)
      setMouthOpen(0)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
    setIsMuted(!isMuted)
  }

  return (
    <div className="h-full flex flex-col bg-stream-dark">
      {/* Chat header */}
      <div className="p-4 border-b border-stream-border flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold">Live Chat</h2>
          <p className="text-stream-muted text-xs">Chat with Phil</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setChattersEnabled(!chattersEnabled)}
            className={`p-2 rounded-full transition-colors ${chattersEnabled ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-stream-gray'}`}
            title={chattersEnabled ? 'Disable chatters' : 'Enable chatters'}
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>
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

      {/* Messages area - Phil's messages are audio only, not shown here */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 chat-scrollbar">
        {messages.filter(m => m.sender !== 'phil').map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {/* Thinking indicator - only show when thinking, not during audio */}
        {isThinking && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-phil-brown flex items-center justify-center text-xs">
              🐿️
            </div>
            <span className="text-stream-muted text-sm italic">Phil is thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area - can type/send while Phil is speaking */}
      <div className="p-4 border-t border-stream-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Say something..."
            className="flex-1 bg-stream-gray border border-stream-border rounded-full px-4 py-2 text-white placeholder-stream-muted focus:outline-none focus:border-stream-muted"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="bg-live-red hover:bg-red-600 disabled:bg-stream-gray disabled:text-stream-muted text-white px-4 py-2 rounded-full transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

// Individual message component
function ChatMessage({ message }: { message: Message }) {
  const isPhil = message.sender === 'phil'
  const isChatter = message.sender === 'chatter'
  const isUser = message.sender === 'user'

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

  return (
    <div className={`flex items-start gap-2 ${isPhil ? '' : 'flex-row-reverse'}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
          isPhil ? 'bg-phil-brown' : 'bg-blue-600'
        }`}
      >
        {isPhil ? '🐿️' : '👤'}
      </div>

      {/* Message bubble */}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isPhil
            ? 'bg-stream-gray rounded-tl-none text-stream-text'
            : 'bg-blue-600 rounded-tr-none text-white'
        }`}
      >
        {isPhil && (
          <p className="text-xs text-stream-muted mb-1 font-semibold">Phil</p>
        )}
        {isUser && (
          <p className="text-xs text-blue-200 mb-1 font-semibold">You</p>
        )}
        <p className="text-sm leading-relaxed">{message.text}</p>
      </div>
    </div>
  )
}
