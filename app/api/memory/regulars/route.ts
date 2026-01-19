// Admin route for viewing/managing regular chatters
import { NextResponse } from 'next/server'
import * as kv from '@/lib/memory/kv-client'
import { getBroadcastState } from '@/lib/broadcast/state'

export async function GET() {
  try {
    if (!kv.isMemoryEnabled()) {
      return NextResponse.json({ error: 'Memory system not configured' }, { status: 503 })
    }

    const chatters = await kv.getAllChatters()

    // Sort by total interactions descending
    chatters.sort((a, b) => b.totalInteractions - a.totalInteractions)

    return NextResponse.json({
      count: chatters.length,
      chatters: chatters.map(c => ({
        username: c.username,
        relationship: c.relationship,
        relationshipScore: c.relationshipScore,
        totalVisits: c.totalVisits,
        totalInteractions: c.totalInteractions,
        philNickname: c.philNickname,
        notableQuotes: c.notableQuotes.length,
        notableRoasts: c.notableRoasts.length,
        corruptedFacts: c.corruptedFacts.length,
        typicalBehavior: c.typicalBehavior,
        firstSeen: new Date(c.firstSeen).toISOString(),
        lastSeen: new Date(c.lastSeen).toISOString(),
      })),
    })
  } catch (error) {
    console.error('[Memory API] Error getting regulars:', error)
    return NextResponse.json({ error: 'Failed to get regulars' }, { status: 500 })
  }
}

// Get details for a specific chatter
export async function POST(request: Request) {
  try {
    if (!kv.isMemoryEnabled()) {
      return NextResponse.json({ error: 'Memory system not configured' }, { status: 503 })
    }

    const { username } = await request.json()
    if (!username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 })
    }

    const chatter = await kv.getChatter(username)
    if (!chatter) {
      return NextResponse.json({ error: 'Chatter not found' }, { status: 404 })
    }

    return NextResponse.json(chatter)
  } catch (error) {
    console.error('[Memory API] Error getting chatter:', error)
    return NextResponse.json({ error: 'Failed to get chatter' }, { status: 500 })
  }
}

// Update a chatter (e.g., set nickname, update relationship)
export async function PATCH(request: Request) {
  try {
    if (!kv.isMemoryEnabled()) {
      return NextResponse.json({ error: 'Memory system not configured' }, { status: 503 })
    }

    const { username, updates } = await request.json()
    if (!username || !updates) {
      return NextResponse.json({ error: 'Username and updates required' }, { status: 400 })
    }

    const chatter = await kv.getChatter(username)
    if (!chatter) {
      return NextResponse.json({ error: 'Chatter not found' }, { status: 404 })
    }

    // Apply allowed updates
    if (updates.philNickname !== undefined) {
      chatter.philNickname = updates.philNickname
    }
    if (updates.typicalBehavior !== undefined) {
      chatter.typicalBehavior = updates.typicalBehavior
    }
    if (updates.relationshipScore !== undefined) {
      chatter.relationshipScore = Math.max(-100, Math.min(100, updates.relationshipScore))
    }

    await kv.setChatter(chatter)

    return NextResponse.json({ success: true, chatter })
  } catch (error) {
    console.error('[Memory API] Error updating chatter:', error)
    return NextResponse.json({ error: 'Failed to update chatter' }, { status: 500 })
  }
}
