// Admin route for viewing/resetting personality evolution
import { NextResponse } from 'next/server'
import * as kv from '@/lib/memory/kv-client'
import { getBroadcastState } from '@/lib/broadcast/state'
import { createInitialPersonality } from '@/lib/memory/personality'

export async function GET() {
  try {
    if (!kv.isMemoryEnabled()) {
      return NextResponse.json({ error: 'Memory system not configured' }, { status: 503 })
    }

    // Get from current session cache first
    const state = getBroadcastState()
    const memoryManager = state.getMemoryManager()
    let personality = memoryManager.getPersonality()

    // Fall back to KV
    if (!personality) {
      personality = await kv.getPersonality()
    }

    if (!personality) {
      return NextResponse.json({
        message: 'No personality data yet',
        personality: null,
      })
    }

    return NextResponse.json({
      traits: {
        aggression: personality.aggression,
        paranoia: personality.paranoia,
        grandiosity: personality.grandiosity,
        philosophicalDepth: personality.philosophicalDepth,
      },
      stats: {
        totalSessions: personality.totalSessions,
        totalMessages: personality.totalMessages,
        peakChaosEver: Math.round(personality.peakChaosEver * 100),
      },
      preferences: {
        favoriteTopics: personality.favoriteTopics,
        hatedTopics: personality.hatedTopics,
      },
      emergentBehavior: {
        gags: personality.emergentGags,
        selfAwareMoments: personality.selfAwareMoments,
      },
      lastUpdated: new Date(personality.lastUpdated).toISOString(),
    })
  } catch (error) {
    console.error('[Memory API] Error getting personality:', error)
    return NextResponse.json({ error: 'Failed to get personality' }, { status: 500 })
  }
}

// Update personality traits
export async function PATCH(request: Request) {
  try {
    if (!kv.isMemoryEnabled()) {
      return NextResponse.json({ error: 'Memory system not configured' }, { status: 503 })
    }

    const { updates } = await request.json()

    let personality = await kv.getPersonality()
    if (!personality) {
      personality = createInitialPersonality()
    }

    // Apply trait updates (capped at -20 to 20)
    const traits = ['aggression', 'paranoia', 'grandiosity', 'philosophicalDepth'] as const
    for (const trait of traits) {
      if (updates?.[trait] !== undefined) {
        personality[trait] = Math.max(-20, Math.min(20, updates[trait]))
      }
    }

    personality.lastUpdated = Date.now()
    await kv.setPersonality(personality)

    return NextResponse.json({ success: true, personality })
  } catch (error) {
    console.error('[Memory API] Error updating personality:', error)
    return NextResponse.json({ error: 'Failed to update personality' }, { status: 500 })
  }
}

// Reset personality to initial state
export async function DELETE() {
  try {
    if (!kv.isMemoryEnabled()) {
      return NextResponse.json({ error: 'Memory system not configured' }, { status: 503 })
    }

    const freshPersonality = createInitialPersonality()
    await kv.setPersonality(freshPersonality)

    return NextResponse.json({
      success: true,
      message: 'Personality reset to initial state',
      personality: freshPersonality,
    })
  } catch (error) {
    console.error('[Memory API] Error resetting personality:', error)
    return NextResponse.json({ error: 'Failed to reset personality' }, { status: 500 })
  }
}
