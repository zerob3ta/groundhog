export async function POST(request: Request) {
  try {
    const { text } = await request.json()

    if (!text) {
      return new Response('Text required', { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return new Response('ElevenLabs API key not configured', { status: 500 })
    }

    // Phil's voice
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'MMaVFEPD7MXoXOtgLE2i'

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.4,        // Lower = more expressive/variable
            similarity_boost: 0.8, // Higher = more consistent to voice
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('ElevenLabs error:', error)
      return new Response('Voice generation failed', { status: 500 })
    }

    // Stream the audio back
    return new Response(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('Voice API error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
