// Admin route for viewing/managing corrupted facts
import { NextResponse } from 'next/server'
import * as kv from '@/lib/memory/kv-client'
import { getBroadcastState } from '@/lib/broadcast/state'

export async function GET() {
  try {
    if (!kv.isMemoryEnabled()) {
      return NextResponse.json({ error: 'Memory system not configured' }, { status: 503 })
    }

    // Get from KV (all confidence levels)
    const kvFacts = await kv.getActiveFacts(0)

    // Also get from current session cache
    const state = getBroadcastState()
    const memoryManager = state.getMemoryManager()
    const cacheFacts = memoryManager.getActiveFacts()

    // Merge and dedupe
    const allFacts = [...cacheFacts]
    for (const f of kvFacts) {
      if (!allFacts.find(cf => cf.id === f.id)) {
        allFacts.push(f)
      }
    }

    // Sort by confidence descending
    allFacts.sort((a, b) => b.confidence - a.confidence)

    return NextResponse.json({
      count: allFacts.length,
      facts: allFacts.map(f => ({
        id: f.id,
        fact: f.fact,
        source: f.source,
        confidence: f.confidence,
        reinforcements: f.reinforcements,
        challenges: f.challenges,
        timesStated: f.timesStated,
        firstLearned: new Date(f.firstLearned).toISOString(),
      })),
    })
  } catch (error) {
    console.error('[Memory API] Error getting facts:', error)
    return NextResponse.json({ error: 'Failed to get facts' }, { status: 500 })
  }
}

// Manually add a fact
export async function POST(request: Request) {
  try {
    if (!kv.isMemoryEnabled()) {
      return NextResponse.json({ error: 'Memory system not configured' }, { status: 503 })
    }

    const { fact, source, confidence = 50 } = await request.json()
    if (!fact || !source) {
      return NextResponse.json({ error: 'Fact and source required' }, { status: 400 })
    }

    const newFact = {
      id: `fact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fact,
      source,
      firstLearned: Date.now(),
      confidence: Math.max(0, Math.min(100, confidence)),
      reinforcements: 0,
      challenges: 0,
      timesStated: 0,
    }

    await kv.setFact(newFact)

    return NextResponse.json({ success: true, fact: newFact })
  } catch (error) {
    console.error('[Memory API] Error adding fact:', error)
    return NextResponse.json({ error: 'Failed to add fact' }, { status: 500 })
  }
}

// Update or delete a fact
export async function PATCH(request: Request) {
  try {
    if (!kv.isMemoryEnabled()) {
      return NextResponse.json({ error: 'Memory system not configured' }, { status: 503 })
    }

    const { id, action, updates } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Fact ID required' }, { status: 400 })
    }

    if (action === 'delete') {
      await kv.removeFact(id)
      return NextResponse.json({ success: true, deleted: true })
    }

    const fact = await kv.getFact(id)
    if (!fact) {
      return NextResponse.json({ error: 'Fact not found' }, { status: 404 })
    }

    // Apply allowed updates
    if (updates?.confidence !== undefined) {
      fact.confidence = Math.max(0, Math.min(100, updates.confidence))
    }
    if (updates?.fact !== undefined) {
      fact.fact = updates.fact
    }

    await kv.setFact(fact)

    return NextResponse.json({ success: true, fact })
  } catch (error) {
    console.error('[Memory API] Error updating fact:', error)
    return NextResponse.json({ error: 'Failed to update fact' }, { status: 500 })
  }
}
