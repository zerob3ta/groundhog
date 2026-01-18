// Audio API - Lazy generation of Phil audio by message ID
// Only generates audio when first requested, then caches

import { getBroadcastState } from '@/lib/broadcast/state'
import { generatePhilAudio } from '@/lib/phil-generator'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(
  request: Request,
  { params }: RouteParams
) {
  const { id } = await params
  const state = getBroadcastState()

  // Check if already cached
  const cached = state.getAudio(id)
  if (cached) {
    return new Response(Buffer.from(cached.audioBlob), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=300',
        'Content-Length': cached.audioBlob.length.toString(),
      },
    })
  }

  // Check if currently being generated (another request beat us)
  const existingPromise = state.getAudioGenerationPromise(id)
  if (existingPromise) {
    console.log(`[Audio] Waiting on in-flight generation for ${id}`)
    const audioBlob = await existingPromise
    if (audioBlob) {
      return new Response(Buffer.from(audioBlob), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=300',
          'Content-Length': audioBlob.length.toString(),
        },
      })
    }
    return new Response('Audio generation failed', { status: 500 })
  }

  // Get the message to generate audio for
  const message = state.getMessage(id)
  if (!message) {
    return new Response('Message not found', { status: 404 })
  }

  // Only generate audio for Phil messages
  if (message.type !== 'phil') {
    return new Response('Audio only available for Phil messages', { status: 400 })
  }

  // Skip very short messages (not worth TTS cost)
  if (message.text.length < 10) {
    return new Response('Message too short for audio', { status: 204 })
  }

  console.log(`[Audio] Generating audio on-demand for ${id}: "${message.text.slice(0, 50)}..."`)

  // Start generation and track the promise
  const generatePromise = (async () => {
    try {
      const audioBlob = await generatePhilAudio(message.text)
      if (audioBlob) {
        state.cacheAudio(id, audioBlob)
      }
      return audioBlob
    } finally {
      state.clearAudioGenerating(id)
    }
  })()

  state.setAudioGenerating(id, generatePromise)

  // Wait for generation to complete
  const audioBlob = await generatePromise

  if (!audioBlob) {
    return new Response('Audio generation failed', { status: 500 })
  }

  return new Response(Buffer.from(audioBlob), {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=300',
      'Content-Length': audioBlob.length.toString(),
    },
  })
}
