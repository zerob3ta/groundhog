// Admin endpoint to control Phil's sleep mode
// PUT /api/admin/sleep - Toggle or set sleep state
// GET /api/admin/sleep - Get current sleep state

import { getBroadcastState } from '@/lib/broadcast/state'
import { getOrchestrator } from '@/lib/broadcast/orchestrator'

// Simple admin key check (in production, use proper auth)
function isAuthorized(request: Request): boolean {
  const adminKey = request.headers.get('x-admin-key')
  const expectedKey = process.env.ADMIN_KEY || 'phil-admin-secret'
  return adminKey === expectedKey
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const state = getBroadcastState()
  return Response.json({
    isSleeping: state.getIsSleeping(),
    viewers: state.getClientCount(),
  })
}

export async function PUT(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json() as { sleep?: boolean }
    const state = getBroadcastState()
    const orchestrator = getOrchestrator()

    // Toggle if no explicit value provided
    const shouldSleep = body.sleep ?? !state.getIsSleeping()

    if (shouldSleep) {
      // Put Phil to sleep
      state.setSleeping(true)
      orchestrator.stop()

      // Broadcast the sleep state to all clients
      await orchestrator.broadcastSleepState(true)

      return Response.json({
        success: true,
        isSleeping: true,
        message: 'Phil is now sleeping',
      })
    } else {
      // Wake Phil up - reset session for fresh start
      state.resetSession()
      state.setSleeping(false)

      // Broadcast the wake state to all clients
      await orchestrator.broadcastSleepState(false)

      // Restart orchestrator if there are clients
      if (state.getClientCount() > 0) {
        orchestrator.start()
      }

      return Response.json({
        success: true,
        isSleeping: false,
        message: 'Phil is now awake',
      })
    }
  } catch (error) {
    console.error('[Admin] Sleep toggle error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
