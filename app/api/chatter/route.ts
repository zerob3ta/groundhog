import { GoogleGenAI } from '@google/genai'
import {
  getWeightedRandomChatter,
  buildChatterPrompt,
  Chatter,
  getChatterByUsername,
  buildAntiRepetitionPrompt,
  getRandomSituation,
  getRandomBehaviorAngle,
  buildContextAwareness,
} from '@/lib/chatters'
import type { SessionState, ChatterData } from '@/lib/session-state'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

interface ChatMessage {
  role: string
  content: string
  sender?: string
}

export async function POST(request: Request) {
  try {
    const { recentMessages, preferredChatter, sessionState } = await request.json() as {
      recentMessages: ChatMessage[]
      preferredChatter?: string // username of chatter to bring back for escalation
      sessionState?: SessionState
    }

    // Pick chatter - prefer the escalation target if provided (70% chance)
    let chatter: Chatter
    if (preferredChatter && Math.random() < 0.7) {
      chatter = getChatterByUsername(preferredChatter) || getWeightedRandomChatter()
    } else {
      chatter = getWeightedRandomChatter()
    }

    const basePrompt = buildChatterPrompt(chatter)

    // Build context from recent messages
    const context = recentMessages
      .slice(-6) // Last 6 messages for context
      .map((m: ChatMessage) => `${m.sender || m.role}: ${m.content}`)
      .join('\n')

    // Build enhanced prompt with anti-repetition and behavior angles
    let enhancedPrompt = basePrompt

    // Add random behavior angle from pool
    const behaviorAngle = getRandomBehaviorAngle(chatter.type)
    enhancedPrompt += `\n\nBEHAVIOR: ${behaviorAngle}`

    // Add situational modifier (30% chance)
    const situation = getRandomSituation()
    if (situation) {
      enhancedPrompt += `\nSITUATION: ${situation}`
    }

    // Add anti-repetition context
    if (sessionState?.chatterTracking) {
      const antiRepetition = buildAntiRepetitionPrompt(chatter.type, sessionState.chatterTracking)
      if (antiRepetition) {
        enhancedPrompt += antiRepetition
      }
    }

    // Add context awareness (Phil's mood, other chatters, etc.)
    if (sessionState) {
      const contextAwareness = buildContextAwareness(sessionState, recentMessages)
      if (contextAwareness) {
        enhancedPrompt += contextAwareness
      }
    }

    // Build chatter-specific context from session state
    let chatterContext = ''
    if (sessionState) {
      const chatterData: ChatterData | undefined = sessionState.chatters[chatter.username]

      // If this chatter has been seen before
      if (chatterData) {
        const relationshipContext: string[] = []

        if (chatterData.relationship === 'nemesis') {
          relationshipContext.push('Phil has been roasting you hard. You might be salty about it.')
        } else if (chatterData.relationship === 'favorite') {
          relationshipContext.push('Phil seems to like you. Maybe brag about it.')
        }

        if (chatterData.philNickname) {
          relationshipContext.push(`Phil calls you "${chatterData.philNickname}".`)
        }

        if (relationshipContext.length > 0) {
          chatterContext = `\nYour history with Phil: ${relationshipContext.join(' ')}`
        }
      }

      // Add awareness of other chatters
      const otherChatters = Object.entries(sessionState.chatters)
        .filter(([username]) => username !== chatter.username)
        .slice(0, 3) // Max 3 others

      if (otherChatters.length > 0 && Math.random() < 0.3) {
        // 30% chance to reference another chatter
        const [otherUsername, otherData] = otherChatters[Math.floor(Math.random() * otherChatters.length)]
        if (otherData.relationship === 'nemesis') {
          chatterContext += `\nYou might defend ${otherUsername} who Phil's been roasting.`
        } else if (otherData.relationship === 'favorite') {
          chatterContext += `\nYou might be jealous of ${otherUsername} who Phil seems to like.`
        }
      }
    }

    // Get current date for context
    const now = new Date()
    const formattedDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    // Log the enhanced prompt for debugging
    console.log(`[Chatter] ${chatter.type} (${chatter.username}) - Behavior: ${behaviorAngle}${situation ? ` | Situation: ${situation}` : ''}`)

    // Generate a contextual message from the chatter
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Personality: ${chatter.type}
Instructions: ${enhancedPrompt}${chatterContext}

Recent chat context:
${context || '(stream just started)'}

Generate one short chat message from this viewer:`,
      config: {
        maxOutputTokens: 500, // Need extra room for thinking tokens
        temperature: 1.0,
        systemInstruction: `You generate short chat messages for a simulated viewer in a livestream chat.
Today is ${formattedDate}. You can reference current events, the date, or time of year naturally.
You will be given a personality type and recent chat context. Generate ONE short message (usually under 15 words) that fits the personality.
ONLY output the chat message itself, nothing else. No quotes, no attribution, just the message.
The message should feel natural for a livestream chat - short, casual, often poorly punctuated.`,
      },
    })

    // Extract text from Gemini response
    const text = response.text || ''

    return Response.json({
      chatter,
      message: text.trim(),
    })
  } catch (error) {
    console.error('Chatter API error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
