// Admin route for viewing notable moments
import { NextResponse } from 'next/server'
import * as kv from '@/lib/memory/kv-client'
import { getBroadcastState } from '@/lib/broadcast/state'

export async function GET(request: Request) {
  try {
    if (!kv.isMemoryEnabled()) {
      return NextResponse.json({ error: 'Memory system not configured' }, { status: 503 })
    }

    const url = new URL(request.url)
    const count = parseInt(url.searchParams.get('count') || '20')

    // Get from KV
    const kvMoments = await kv.getRecentMoments(count)

    // Also get from current session cache
    const state = getBroadcastState()
    const memoryManager = state.getMemoryManager()
    const cacheMoments = memoryManager.getRecentMoments()

    // Merge and dedupe
    const allMoments = [...cacheMoments]
    for (const m of kvMoments) {
      if (!allMoments.find(cm => cm.id === m.id)) {
        allMoments.push(m)
      }
    }

    // Sort by timestamp descending
    allMoments.sort((a, b) => b.timestamp - a.timestamp)

    return NextResponse.json({
      count: allMoments.length,
      moments: allMoments.slice(0, count).map(m => ({
        id: m.id,
        type: m.type,
        philQuote: m.philQuote,
        context: m.context,
        involvedUsers: m.involvedUsers,
        chaosLevel: Math.round(m.chaosLevel * 100),
        mood: m.mood,
        timesReferenced: m.timesReferenced,
        timestamp: new Date(m.timestamp).toISOString(),
      })),
    })
  } catch (error) {
    console.error('[Memory API] Error getting moments:', error)
    return NextResponse.json({ error: 'Failed to get moments' }, { status: 500 })
  }
}

// Get a specific moment by ID
export async function POST(request: Request) {
  try {
    if (!kv.isMemoryEnabled()) {
      return NextResponse.json({ error: 'Memory system not configured' }, { status: 503 })
    }

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Moment ID required' }, { status: 400 })
    }

    const moment = await kv.getMoment(id)
    if (!moment) {
      return NextResponse.json({ error: 'Moment not found' }, { status: 404 })
    }

    return NextResponse.json(moment)
  } catch (error) {
    console.error('[Memory API] Error getting moment:', error)
    return NextResponse.json({ error: 'Failed to get moment' }, { status: 500 })
  }
}
