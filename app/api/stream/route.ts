// SSE Stream endpoint - Clients connect here to receive all broadcast events
// This is the central connection point for the shared Phil experience

// Force dynamic rendering - SSE cannot be statically generated
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { getBroadcastState } from '@/lib/broadcast/state'
import { getOrchestrator } from '@/lib/broadcast/orchestrator'
import type { BroadcastEvent, ConnectedClient } from '@/lib/broadcast/types'

// Generate a unique client ID
function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Format SSE message
function formatSSE(event: BroadcastEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
}

// Broadcast an event to all connected clients
async function broadcastToAll(event: BroadcastEvent): Promise<void> {
  const state = getBroadcastState()
  const clients = state.getAllClients()

  const promises = clients.map(async (client) => {
    const clientWithSend = client as ConnectedClient & { sendEvent?: (e: BroadcastEvent) => Promise<void> }
    if (clientWithSend.sendEvent) {
      try {
        await clientWithSend.sendEvent(event)
      } catch (e) {
        console.error(`[Broadcast] Failed to send to ${client.id}:`, e)
      }
    }
  })

  await Promise.allSettled(promises)
}

export async function GET(request: Request) {
  const state = getBroadcastState()
  const orchestrator = getOrchestrator()
  const clientId = generateClientId()

  // Set up broadcast function on orchestrator (idempotent)
  orchestrator.setBroadcastFunction(broadcastToAll)

  // Create a TransformStream for SSE
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  // Track if connection is still open
  let isConnected = true

  // Create the client entry (controller will be set after stream setup)
  const client: ConnectedClient = {
    id: clientId,
    displayName: null,
    controller: null as unknown as ReadableStreamDefaultController, // Will be replaced
    lastHeartbeat: Date.now(),
    connectedAt: Date.now(),
  }

  // Helper to send data to this client
  const sendEvent = async (event: BroadcastEvent) => {
    if (!isConnected) return
    try {
      await writer.write(encoder.encode(formatSSE(event)))
    } catch (e) {
      console.error(`[Stream] Failed to send to ${clientId}:`, e)
      isConnected = false
    }
  }

  // Store a reference to sendEvent on the client for the orchestrator to use
  // We use a custom property since we're using writer instead of controller
  ;(client as ConnectedClient & { sendEvent: typeof sendEvent }).sendEvent = sendEvent

  // Register client with state
  state.addClient(client)

  // Start orchestrator if this is the first client
  if (state.getClientCount() === 1) {
    console.log('[Stream] First client connected, starting orchestrator...')
    orchestrator.start()
  }

  // Send initial data to this client
  const sendInitialData = async () => {
    // Send client ID as a special init event
    await sendEvent({
      type: 'state',
      data: {
        ...state.getStateSnapshot(),
        clientId, // Include clientId in initial state
      } as ReturnType<typeof state.getStateSnapshot> & { clientId: string },
    })

    // Send message history
    const messages = state.getMessages()
    await sendEvent({
      type: 'messages',
      data: messages,
    })
  }

  // Handle client disconnect
  const handleDisconnect = () => {
    if (!isConnected) return
    isConnected = false

    state.removeClient(clientId)

    // Stop orchestrator if no clients remain
    if (state.getClientCount() === 0) {
      console.log('[Stream] No clients remaining, stopping orchestrator...')
      orchestrator.stop()
    }
  }

  // Listen for connection close
  request.signal.addEventListener('abort', handleDisconnect)

  // Start the stream
  ;(async () => {
    try {
      // Send initial data
      await sendInitialData()

      // Keep connection alive with heartbeats
      const heartbeatInterval = setInterval(async () => {
        if (!isConnected) {
          clearInterval(heartbeatInterval)
          return
        }

        await sendEvent({
          type: 'heartbeat',
          data: {
            timestamp: Date.now(),
            viewers: state.getClientCount(),
          },
        })

        // Update client heartbeat
        state.updateClientHeartbeat(clientId)
      }, state.getConfig().heartbeatIntervalMs)

      // Wait for disconnect
      await new Promise<void>((resolve) => {
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval)
          resolve()
        })
      })
    } catch (error) {
      console.error(`[Stream] Error for ${clientId}:`, error)
    } finally {
      handleDisconnect()
      try {
        await writer.close()
      } catch {
        // Already closed
      }
    }
  })()

  // Return SSE response immediately
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Client-Id': clientId,
    },
  })
}
