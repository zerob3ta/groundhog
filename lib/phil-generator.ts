// Phil Generator - Core logic for generating Phil's responses
// Used by both the /api/chat route and the orchestrator

import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import { CHAT_CONFIG, buildSystemPrompt } from '@/lib/phil-prompt'
import type { SessionState } from '@/lib/session-state'
import { stripCitations } from '@/lib/text-utils'
import type { ResponseTypePromptContext } from '@/lib/response-types/prompts'

// Initialize AI client lazily
let ai: GoogleGenAI | null = null
function getAI(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }
  return ai
}

export interface PhilGeneratorResult {
  text: string
}

export async function generatePhilResponse(
  messages: { role: string; content: string }[],
  sessionState?: SessionState,
  userMessage?: string,
  memoryContext?: string | null,
  responseTypeContext?: ResponseTypePromptContext | null
): Promise<PhilGeneratorResult> {
  // Convert messages to Gemini format
  const geminiContents = messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }))

  // Build system prompt with session state, memory context, and response type
  const systemPrompt = buildSystemPrompt(sessionState, userMessage, memoryContext, responseTypeContext)

  // Create streaming response with search grounding
  const response = await getAI().models.generateContentStream({
    model: CHAT_CONFIG.model,
    contents: geminiContents,
    config: {
      maxOutputTokens: CHAT_CONFIG.maxTokens,
      temperature: CHAT_CONFIG.temperature,
      systemInstruction: systemPrompt,
      // Enable search grounding for real-time info
      tools: [{ googleSearch: {} }],
      // Low thinking for faster responses
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  })

  // Collect the full response
  let fullText = ''
  for await (const chunk of response) {
    const text = chunk.text
    if (text) {
      fullText += text
    }
  }

  return { text: stripCitations(fullText) }
}

// Generate TTS audio for Phil's response
export async function generatePhilAudio(text: string): Promise<Uint8Array | null> {
  try {
    // Use custom voice ID from env, or fall back to default
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_flash_v2_5', // Flash model - half the cost of turbo
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
        },
      }),
    })

    if (!response.ok) {
      console.error('[Phil Audio] ElevenLabs API error:', response.status)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    return new Uint8Array(arrayBuffer)
  } catch (error) {
    console.error('[Phil Audio] Error generating audio:', error)
    return null
  }
}
