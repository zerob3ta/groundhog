// User API - Display name management for broadcast chat

import { getBroadcastState } from '@/lib/broadcast/state'

// Validate display name
function isValidDisplayName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Display name is required' }
  }

  const trimmed = name.trim()

  if (trimmed.length < 2) {
    return { valid: false, error: 'Display name must be at least 2 characters' }
  }

  if (trimmed.length > 20) {
    return { valid: false, error: 'Display name must be 20 characters or less' }
  }

  // Only allow alphanumeric, underscores, spaces
  if (!/^[a-zA-Z0-9_ ]+$/.test(trimmed)) {
    return { valid: false, error: 'Display name can only contain letters, numbers, underscores, and spaces' }
  }

  // Check for reserved names
  const reserved = ['phil', 'system', 'admin', 'moderator', 'mod', 'bot']
  if (reserved.includes(trimmed.toLowerCase())) {
    return { valid: false, error: 'That display name is reserved' }
  }

  return { valid: true }
}

export async function POST(request: Request) {
  try {
    const { clientId, displayName } = await request.json() as {
      clientId: string
      displayName: string
    }

    if (!clientId) {
      return Response.json({ error: 'Client ID is required' }, { status: 400 })
    }

    // Validate display name
    const validation = isValidDisplayName(displayName)
    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 })
    }

    const trimmedName = displayName.trim()
    const state = getBroadcastState()

    // Check if client exists
    const client = state.getClient(clientId)
    if (!client) {
      return Response.json({ error: 'Client not found. Please refresh the page.' }, { status: 404 })
    }

    // Note: We allow duplicate display names since the same user might have multiple tabs open
    // In a production app you'd want proper user authentication instead

    // Update client display name
    const updated = state.updateClientDisplayName(clientId, trimmedName)
    if (!updated) {
      return Response.json({ error: 'Failed to update display name' }, { status: 500 })
    }

    console.log(`[User] ${clientId} set display name to: ${trimmedName}`)

    // Note: user_joined event is broadcast separately by orchestrator
    return Response.json({ success: true, displayName: trimmedName })

  } catch (error) {
    console.error('User API error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Get current user info
export async function GET(request: Request) {
  const url = new URL(request.url)
  const clientId = url.searchParams.get('clientId')

  if (!clientId) {
    return Response.json({ error: 'Client ID is required' }, { status: 400 })
  }

  const state = getBroadcastState()
  const client = state.getClient(clientId)

  if (!client) {
    return Response.json({ error: 'Client not found' }, { status: 404 })
  }

  return Response.json({
    clientId: client.id,
    displayName: client.displayName,
    connectedAt: client.connectedAt,
  })
}
