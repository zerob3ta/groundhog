// Chatter Generator - Core logic for generating chatter messages
// Used by both the /api/chatter route and the orchestrator

import { GoogleGenAI } from '@google/genai'
import {
  getWeightedRandomChatter,
  buildChatterPrompt,
  type Chatter,
  type PendulumBoost,
  getChatterByUsername,
  buildAntiRepetitionPrompt,
  getRandomSituation,
  getRandomBehaviorAngle,
  buildContextAwareness,
  getHotButtonTopic,
  getProvocativeBehavior,
  buildCrossChatterPrompt,
} from '@/lib/chatters'
import type { SessionState, ChatterData } from '@/lib/session-state'
import {
  type RantAnalysis,
  buildRantContext,
  getRantReactionSuggestions,
} from '@/lib/rant-detector'
import { calculatePendulumBoost } from '@/lib/state-updates'
import { stripCitations } from '@/lib/text-utils'

// Initialize AI client lazily
let ai: GoogleGenAI | null = null
function getAI(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }
  return ai
}

interface ChatMessage {
  role: string
  content: string
  sender?: string
}

export interface ChatterGeneratorResult {
  chatter: Chatter
  message: string
}

// Current event topics for random injection
const CURRENT_EVENT_TOPICS = ['sports', 'news', 'tech', 'celebrity', 'weather', 'politics', 'entertainment']

export async function generateChatterMessage(
  recentMessages: ChatMessage[],
  sessionState?: SessionState,
  preferredChatter?: string,
  rantAnalysis?: RantAnalysis
): Promise<ChatterGeneratorResult> {
  // Calculate pendulum boost if we have session state
  const pendulumBoost: PendulumBoost | undefined = sessionState
    ? calculatePendulumBoost(sessionState)
    : undefined

  // Pick chatter - prefer the escalation target if provided (70% chance)
  let chatter: Chatter
  if (preferredChatter && Math.random() < 0.7) {
    chatter = getChatterByUsername(preferredChatter) || getWeightedRandomChatter(pendulumBoost)
  } else {
    chatter = getWeightedRandomChatter(pendulumBoost)
  }

  const basePrompt = buildChatterPrompt(chatter)

  // Build context from recent messages
  const context = recentMessages
    .slice(-6)
    .map((m: ChatMessage) => `${m.sender || m.role}: ${m.content}`)
    .join('\n')

  // Build enhanced prompt with anti-repetition and behavior angles
  let enhancedPrompt = basePrompt

  // If we have rant analysis, PRIORITIZE reacting to it
  const isReactingToRant = rantAnalysis?.isRant
  if (isReactingToRant) {
    const rantContext = buildRantContext(rantAnalysis)
    enhancedPrompt += `\n\n${rantContext}`

    // Get type-specific reaction suggestions
    const suggestions = getRantReactionSuggestions(rantAnalysis)
    const relevantSuggestions = suggestions.filter(s => s.forTypes.includes(chatter.type))
    if (relevantSuggestions.length > 0) {
      const suggestion = relevantSuggestions[Math.floor(Math.random() * relevantSuggestions.length)]
      enhancedPrompt += `\n\n💡 SUGGESTED REACTION: ${suggestion.action}`
    }
  }

  // Add random behavior angle from pool (lower priority if reacting to rant)
  let behaviorAngle: string | null = null
  if (!isReactingToRant || Math.random() < 0.3) {
    behaviorAngle = getRandomBehaviorAngle(chatter.type)
    enhancedPrompt += `\n\nBEHAVIOR: ${behaviorAngle}`
  }

  // Add situational modifier (30% chance, skip if reacting to rant)
  let situation: string | null = null
  if (!isReactingToRant) {
    situation = getRandomSituation()
    if (situation) {
      enhancedPrompt += `\nSITUATION: ${situation}`
    }
  }

  // Add hot button topic (40% chance for certain types, skip if reacting to rant)
  if (!isReactingToRant) {
    const hotButton = getHotButtonTopic(chatter.type)
    if (hotButton) {
      enhancedPrompt += `\n\n🔥 HOT BUTTON: Bring up "${hotButton.topic}" - this will get a reaction from Phil!`
      console.log(`[Chatter] ${chatter.username} pressing hot button: ${hotButton.topic}`)
    }
  }

  // Add provocative behavior (30% chance)
  const provocative = getProvocativeBehavior()
  if (provocative) {
    enhancedPrompt += `\n\n⚡ PROVOCATIVE: ${provocative}`
  }

  // Add cross-chatter drama (25% chance)
  const crossChatterDrama = buildCrossChatterPrompt(recentMessages, chatter)
  if (crossChatterDrama) {
    enhancedPrompt += crossChatterDrama
  }

  // Add anti-repetition context
  if (sessionState?.chatterTracking) {
    const antiRepetition = buildAntiRepetitionPrompt(chatter.type, sessionState.chatterTracking)
    if (antiRepetition) {
      enhancedPrompt += antiRepetition
    }
  }

  // Add context awareness (Phil's mood, other chatters, etc.) - INCREASED RATE
  // 70% chance to reference Phil when he just spoke (up from 40%)
  if (sessionState) {
    const contextAwareness = buildContextAwareness(sessionState, recentMessages, isReactingToRant ? 0.9 : 0.7)
    if (contextAwareness) {
      enhancedPrompt += contextAwareness
    }
  }

  // 30% chance to add a current event prompt (enables search grounding awareness)
  if (!isReactingToRant && Math.random() < 0.3) {
    const topic = CURRENT_EVENT_TOPICS[Math.floor(Math.random() * CURRENT_EVENT_TOPICS.length)]
    enhancedPrompt += `\n\n📰 OPTIONAL: You could bring up something current about ${topic} - like a recent news story, sports result, or trending topic. Make it feel natural for your personality.`
    console.log(`[Chatter] ${chatter.username} may mention current ${topic}`)
  }

  // Build chatter-specific context from session state
  let chatterContext = ''
  if (sessionState) {
    const chatterData: ChatterData | undefined = sessionState.chatters[chatter.username]

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
      .slice(0, 3)

    if (otherChatters.length > 0 && Math.random() < 0.3) {
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
  const logParts = [`[Chatter] ${chatter.type} (${chatter.username})`]
  if (isReactingToRant) logParts.push('REACTING TO RANT')
  if (behaviorAngle) logParts.push(`Behavior: ${behaviorAngle}`)
  if (situation) logParts.push(`Situation: ${situation}`)
  console.log(logParts.join(' - '))

  // Generate a contextual message from the chatter
  const response = await getAI().models.generateContent({
    model: 'gemini-2.0-flash',
    contents: `Personality: ${chatter.type}
Instructions: ${enhancedPrompt}${chatterContext}

Recent chat context:
${context || '(stream just started)'}

Generate one short chat message from this viewer:`,
    config: {
      maxOutputTokens: 500,
      temperature: 1.2, // Slightly higher temp for more variety
      // Enable search grounding for current events awareness
      tools: [{ googleSearch: {} }],
      systemInstruction: `You generate short chat messages for a simulated viewer in a livestream chat.
Today is ${formattedDate}. You have access to Google Search to reference current events, sports scores, news, or trending topics when relevant to the chatter's personality. Use this sparingly and naturally.

IMPORTANT - BE INTERESTING:
- PROVOKE reactions. Create drama. Make Phil WANT to respond.
- Be confrontational, weird, controversial, or memorable.
- Avoid boring, generic messages like "hi phil" or "love the stream"
- Say something that will get a REACTION - positive or negative.
- Chatters should feel like real internet degenerates, not polite guests.
- Typos, bad grammar, all caps, weird punctuation = authentic.
${isReactingToRant ? '\n⚠️ CRITICAL: Phil just ranted - you MUST react to what he said!' : ''}

Generate ONE short message (usually under 15 words) that fits the personality.
ONLY output the chat message itself, nothing else. No quotes, no attribution, just the message.
The message should feel natural for a livestream chat - chaotic, unfiltered, often unhinged.`,
    },
  })

  const text = stripCitations(response.text || '')

  return {
    chatter,
    message: text,
  }
}
