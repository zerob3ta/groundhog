// KV Client - Upstash Redis wrapper for Phil's persistent memory
// Uses REST API for serverless compatibility

import { Redis } from '@upstash/redis'
import {
  type PersistentChatter,
  type NotableMoment,
  type PersistentFact,
  type PersonalityEvolution,
  type EmergentTruth,
  KV_KEYS,
  KV_LIMITS,
} from './types'

// Lazy initialization to avoid errors when env vars not set
let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    console.warn('[Memory] Upstash Redis not configured - memory system disabled')
    return null
  }

  redis = new Redis({ url, token })
  console.log('[Memory] Upstash Redis client initialized')
  return redis
}

// Check if memory system is available
export function isMemoryEnabled(): boolean {
  return getRedis() !== null
}

// ============================================
// CHATTER OPERATIONS
// ============================================

export async function getChatter(username: string): Promise<PersistentChatter | null> {
  const client = getRedis()
  if (!client) return null

  try {
    const data = await client.get<PersistentChatter>(KV_KEYS.chatter(username))
    return data
  } catch (error) {
    console.error(`[Memory] Error getting chatter ${username}:`, error)
    return null
  }
}

export async function setChatter(chatter: PersistentChatter): Promise<boolean> {
  const client = getRedis()
  if (!client) return false

  try {
    await client.set(KV_KEYS.chatter(chatter.username), chatter)
    return true
  } catch (error) {
    console.error(`[Memory] Error setting chatter ${chatter.username}:`, error)
    return false
  }
}

export async function getChatters(usernames: string[]): Promise<Map<string, PersistentChatter>> {
  const client = getRedis()
  const result = new Map<string, PersistentChatter>()
  if (!client || usernames.length === 0) return result

  try {
    const keys = usernames.map(u => KV_KEYS.chatter(u))
    const values = await client.mget<PersistentChatter[]>(...keys)

    for (let i = 0; i < usernames.length; i++) {
      const chatter = values[i]
      if (chatter) {
        result.set(usernames[i].toLowerCase(), chatter)
      }
    }
  } catch (error) {
    console.error('[Memory] Error getting chatters:', error)
  }

  return result
}

export async function setChatters(chatters: PersistentChatter[]): Promise<boolean> {
  const client = getRedis()
  if (!client || chatters.length === 0) return false

  try {
    const pipeline = client.pipeline()
    for (const chatter of chatters) {
      pipeline.set(KV_KEYS.chatter(chatter.username), chatter)
    }
    await pipeline.exec()
    return true
  } catch (error) {
    console.error('[Memory] Error setting chatters:', error)
    return false
  }
}

// ============================================
// MOMENT OPERATIONS
// ============================================

export async function getMoment(id: string): Promise<NotableMoment | null> {
  const client = getRedis()
  if (!client) return null

  try {
    return await client.get<NotableMoment>(KV_KEYS.moment(id))
  } catch (error) {
    console.error(`[Memory] Error getting moment ${id}:`, error)
    return null
  }
}

export async function setMoment(moment: NotableMoment): Promise<boolean> {
  const client = getRedis()
  if (!client) return false

  try {
    const pipeline = client.pipeline()

    // Set the moment
    pipeline.set(KV_KEYS.moment(moment.id), moment)

    // Add to recent list and trim
    pipeline.lpush(KV_KEYS.momentsRecent, moment.id)
    pipeline.ltrim(KV_KEYS.momentsRecent, 0, KV_LIMITS.recentMoments - 1)

    await pipeline.exec()
    return true
  } catch (error) {
    console.error(`[Memory] Error setting moment ${moment.id}:`, error)
    return false
  }
}

export async function getRecentMoments(count: number = 10): Promise<NotableMoment[]> {
  const client = getRedis()
  if (!client) return []

  try {
    // Get recent moment IDs
    const ids = await client.lrange(KV_KEYS.momentsRecent, 0, count - 1)
    if (ids.length === 0) return []

    // Fetch all moments
    const keys = ids.map(id => KV_KEYS.moment(id))
    const moments = await client.mget<NotableMoment[]>(...keys)

    return moments.filter((m): m is NotableMoment => m !== null)
  } catch (error) {
    console.error('[Memory] Error getting recent moments:', error)
    return []
  }
}

// ============================================
// FACT OPERATIONS
// ============================================

export async function getFact(id: string): Promise<PersistentFact | null> {
  const client = getRedis()
  if (!client) return null

  try {
    return await client.get<PersistentFact>(KV_KEYS.fact(id))
  } catch (error) {
    console.error(`[Memory] Error getting fact ${id}:`, error)
    return null
  }
}

export async function setFact(fact: PersistentFact): Promise<boolean> {
  const client = getRedis()
  if (!client) return false

  try {
    const pipeline = client.pipeline()

    // Set the fact
    pipeline.set(KV_KEYS.fact(fact.id), fact)

    // Add to active list if not already there
    // Using a set would be better but list works for our scale
    pipeline.lrem(KV_KEYS.factsActive, 0, fact.id)  // Remove if exists
    pipeline.lpush(KV_KEYS.factsActive, fact.id)
    pipeline.ltrim(KV_KEYS.factsActive, 0, KV_LIMITS.activeFacts - 1)

    await pipeline.exec()
    return true
  } catch (error) {
    console.error(`[Memory] Error setting fact ${fact.id}:`, error)
    return false
  }
}

export async function getActiveFacts(minConfidence: number = 30): Promise<PersistentFact[]> {
  const client = getRedis()
  if (!client) return []

  try {
    // Get all active fact IDs
    const ids = await client.lrange(KV_KEYS.factsActive, 0, -1)
    if (ids.length === 0) return []

    // Fetch all facts
    const keys = ids.map(id => KV_KEYS.fact(id))
    const facts = await client.mget<PersistentFact[]>(...keys)

    // Filter by confidence
    return facts
      .filter((f): f is PersistentFact => f !== null && f.confidence >= minConfidence)
  } catch (error) {
    console.error('[Memory] Error getting active facts:', error)
    return []
  }
}

export async function removeFact(id: string): Promise<boolean> {
  const client = getRedis()
  if (!client) return false

  try {
    const pipeline = client.pipeline()
    pipeline.del(KV_KEYS.fact(id))
    pipeline.lrem(KV_KEYS.factsActive, 0, id)
    await pipeline.exec()
    return true
  } catch (error) {
    console.error(`[Memory] Error removing fact ${id}:`, error)
    return false
  }
}

// ============================================
// PERSONALITY OPERATIONS
// ============================================

export async function getPersonality(): Promise<PersonalityEvolution | null> {
  const client = getRedis()
  if (!client) return null

  try {
    return await client.get<PersonalityEvolution>(KV_KEYS.personality)
  } catch (error) {
    console.error('[Memory] Error getting personality:', error)
    return null
  }
}

export async function setPersonality(personality: PersonalityEvolution): Promise<boolean> {
  const client = getRedis()
  if (!client) return false

  try {
    await client.set(KV_KEYS.personality, personality)
    return true
  } catch (error) {
    console.error('[Memory] Error setting personality:', error)
    return false
  }
}

// ============================================
// TRUTH OPERATIONS
// ============================================

export async function getTruth(id: string): Promise<EmergentTruth | null> {
  const client = getRedis()
  if (!client) return null

  try {
    return await client.get<EmergentTruth>(KV_KEYS.truth(id))
  } catch (error) {
    console.error(`[Memory] Error getting truth ${id}:`, error)
    return null
  }
}

export async function setTruth(truth: EmergentTruth): Promise<boolean> {
  const client = getRedis()
  if (!client) return false

  try {
    const pipeline = client.pipeline()

    // Set the truth
    pipeline.set(KV_KEYS.truth(truth.id), truth)

    // Add to active list if not already there
    pipeline.lrem(KV_KEYS.truthsActive, 0, truth.id)
    pipeline.lpush(KV_KEYS.truthsActive, truth.id)
    pipeline.ltrim(KV_KEYS.truthsActive, 0, KV_LIMITS.activeTruths - 1)

    await pipeline.exec()
    return true
  } catch (error) {
    console.error(`[Memory] Error setting truth ${truth.id}:`, error)
    return false
  }
}

export async function getActiveTruths(minConfidence: number = 10): Promise<EmergentTruth[]> {
  const client = getRedis()
  if (!client) return []

  try {
    // Get all active truth IDs
    const ids = await client.lrange(KV_KEYS.truthsActive, 0, -1)
    if (ids.length === 0) return []

    // Fetch all truths
    const keys = ids.map(id => KV_KEYS.truth(id))
    const truths = await client.mget<EmergentTruth[]>(...keys)

    // Filter by confidence
    return truths
      .filter((t): t is EmergentTruth => t !== null && t.confidence >= minConfidence)
  } catch (error) {
    console.error('[Memory] Error getting active truths:', error)
    return []
  }
}

export async function removeTruth(id: string): Promise<boolean> {
  const client = getRedis()
  if (!client) return false

  try {
    const pipeline = client.pipeline()
    pipeline.del(KV_KEYS.truth(id))
    pipeline.lrem(KV_KEYS.truthsActive, 0, id)
    await pipeline.exec()
    return true
  } catch (error) {
    console.error(`[Memory] Error removing truth ${id}:`, error)
    return false
  }
}

// ============================================
// BATCH OPERATIONS
// ============================================

export interface BatchWriteData {
  chatters?: PersistentChatter[]
  moments?: NotableMoment[]
  facts?: PersistentFact[]
  truths?: EmergentTruth[]
  personality?: PersonalityEvolution
}

export async function batchWrite(data: BatchWriteData): Promise<boolean> {
  const client = getRedis()
  if (!client) return false

  try {
    const pipeline = client.pipeline()

    // Write chatters
    if (data.chatters && data.chatters.length > 0) {
      for (const chatter of data.chatters) {
        pipeline.set(KV_KEYS.chatter(chatter.username), chatter)
      }
    }

    // Write moments
    if (data.moments && data.moments.length > 0) {
      for (const moment of data.moments) {
        pipeline.set(KV_KEYS.moment(moment.id), moment)
        pipeline.lpush(KV_KEYS.momentsRecent, moment.id)
      }
      pipeline.ltrim(KV_KEYS.momentsRecent, 0, KV_LIMITS.recentMoments - 1)
    }

    // Write facts
    if (data.facts && data.facts.length > 0) {
      for (const fact of data.facts) {
        pipeline.set(KV_KEYS.fact(fact.id), fact)
        pipeline.lrem(KV_KEYS.factsActive, 0, fact.id)
        pipeline.lpush(KV_KEYS.factsActive, fact.id)
      }
      pipeline.ltrim(KV_KEYS.factsActive, 0, KV_LIMITS.activeFacts - 1)
    }

    // Write truths
    if (data.truths && data.truths.length > 0) {
      for (const truth of data.truths) {
        pipeline.set(KV_KEYS.truth(truth.id), truth)
        pipeline.lrem(KV_KEYS.truthsActive, 0, truth.id)
        pipeline.lpush(KV_KEYS.truthsActive, truth.id)
      }
      pipeline.ltrim(KV_KEYS.truthsActive, 0, KV_LIMITS.activeTruths - 1)
    }

    // Write personality
    if (data.personality) {
      pipeline.set(KV_KEYS.personality, data.personality)
    }

    await pipeline.exec()
    console.log('[Memory] Batch write completed:', {
      chatters: data.chatters?.length || 0,
      moments: data.moments?.length || 0,
      facts: data.facts?.length || 0,
      truths: data.truths?.length || 0,
      personality: data.personality ? 1 : 0,
    })
    return true
  } catch (error) {
    console.error('[Memory] Batch write error:', error)
    return false
  }
}

// ============================================
// ADMIN/DEBUG OPERATIONS
// ============================================

export async function getAllChatters(): Promise<PersistentChatter[]> {
  const client = getRedis()
  if (!client) return []

  try {
    // Scan for all chatter keys
    const chatters: PersistentChatter[] = []
    let cursor = 0

    // Use a simple scan approach
    const result = await client.scan(cursor, {
      match: 'chatter:*',
      count: 1000,  // Get more in one batch
    })

    const keys = result[1] as string[]
    if (keys.length > 0) {
      const values = await client.mget<PersistentChatter[]>(...keys)
      for (const chatter of values) {
        if (chatter) chatters.push(chatter)
      }
    }

    return chatters
  } catch (error) {
    console.error('[Memory] Error scanning chatters:', error)
    return []
  }
}

export async function clearAllMemory(): Promise<boolean> {
  const client = getRedis()
  if (!client) return false

  try {
    // This is destructive - only for testing/reset
    await client.flushdb()
    console.log('[Memory] All memory cleared')
    return true
  } catch (error) {
    console.error('[Memory] Error clearing memory:', error)
    return false
  }
}
