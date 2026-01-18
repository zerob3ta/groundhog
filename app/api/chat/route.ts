import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import { CHAT_CONFIG, buildSystemPrompt } from '@/lib/phil-prompt'
import type { SessionState } from '@/lib/session-state'
import { getBroadcastState } from '@/lib/broadcast/state'
import { getOrchestrator } from '@/lib/broadcast/orchestrator'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      messages?: { role: string; content: string }[]
      sessionState?: SessionState
      userMessage?: string // The actual user message text for suggestibility analysis
      // Broadcast mode fields
      broadcast?: boolean
      clientId?: string
      displayName?: string
      text?: string
    }

    // Handle broadcast mode - user message via shared broadcast system
    if (body.broadcast) {
      const { clientId, displayName, text } = body

      if (!clientId || !displayName || !text) {
        return new Response('clientId, displayName, and text required for broadcast', { status: 400 })
      }

      const state = getBroadcastState()
      const client = state.getClient(clientId)

      if (!client) {
        return new Response('Client not found. Please refresh the page.', { status: 404 })
      }

      if (client.displayName !== displayName) {
        return new Response('Display name mismatch', { status: 403 })
      }

      // Route to orchestrator for processing and broadcast
      const orchestrator = getOrchestrator()
      await orchestrator.handleUserMessage(displayName, text)
      return Response.json({ success: true })
    }

    // Legacy mode - direct API call (used by orchestrator internally)
    const { messages, sessionState, userMessage } = body

    if (!messages || !Array.isArray(messages)) {
      return new Response('Messages array required', { status: 400 })
    }

    // Convert messages to Gemini format
    // Gemini uses 'user' and 'model' (not 'assistant')
    const geminiContents = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }))

    // Build system prompt with session state and user message for suggestibility
    const systemPrompt = buildSystemPrompt(sessionState, userMessage)

    // Create streaming response with search grounding
    const response = await ai.models.generateContentStream({
      model: CHAT_CONFIG.model,
      contents: geminiContents,
      config: {
        maxOutputTokens: CHAT_CONFIG.maxTokens,
        temperature: CHAT_CONFIG.temperature,
        systemInstruction: systemPrompt,
        // Enable search grounding for real-time info (Eagles, weather, news)
        tools: [{ googleSearch: {} }],
        // Low thinking for faster responses
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    })

    // Create a ReadableStream that sends text chunks
    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            // Extract text from the chunk
            const text = chunk.text
            if (text) {
              controller.enqueue(encoder.encode(text))
            }
          }
          controller.close()
        } catch (error) {
          console.error('Stream error:', error)
          controller.error(error)
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
