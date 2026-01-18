import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import { CHAT_CONFIG, buildSystemPrompt } from '@/lib/phil-prompt'
import type { SessionState } from '@/lib/session-state'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export async function POST(request: Request) {
  try {
    const { messages, sessionState, userMessage } = await request.json() as {
      messages: { role: string; content: string }[]
      sessionState?: SessionState
      userMessage?: string // The actual user message text for suggestibility analysis
    }

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
