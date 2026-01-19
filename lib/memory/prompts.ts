// Memory Prompts - Build prompt sections from memory data
// Injects relevant memories into Phil's system prompt

import type { MemoryManager } from './memory-manager'
import type { SessionState } from '../session-state'
import type {
  PersistentChatter,
  NotableMoment,
  PersistentFact,
  PersonalityEvolution,
  EmergentTruth,
} from './types'
import {
  getPersonalityModifiers,
  getTopicPreferences,
  getEmergentGags,
} from './personality'
import {
  TRUTH_THRESHOLDS,
} from './truths'

/**
 * Build the complete memory context for the system prompt
 */
export async function buildMemoryPrompt(
  memoryManager: MemoryManager,
  currentUsername?: string,
  currentState?: SessionState,
): Promise<string | null> {
  const parts: string[] = []

  // Get personality context
  const personality = memoryManager.getPersonality()
  if (personality) {
    const personalityPrompt = buildPersonalityPrompt(personality)
    if (personalityPrompt) parts.push(personalityPrompt)
  }

  // Get recent moments context (filtered by current state)
  const moments = memoryManager.getRecentMoments()
  if (moments.length > 0) {
    const momentsPrompt = buildMomentsPrompt(moments, currentState)
    if (momentsPrompt) parts.push(momentsPrompt)
  }

  // Get facts context
  const facts = memoryManager.getActiveFacts()
  if (facts.length > 0) {
    const factsPrompt = buildFactsPrompt(facts)
    if (factsPrompt) parts.push(factsPrompt)
  }

  // Get emergent truths context
  if (currentState) {
    const truthsPrompt = buildTruthsPrompt(memoryManager, currentState)
    if (truthsPrompt) parts.push(truthsPrompt)
  }

  // Get chatter context if we have a current user
  if (currentUsername) {
    const recognition = await memoryManager.getRecognitionContext(currentUsername)
    if (recognition.shouldRecognize && recognition.chatter) {
      const chatterPrompt = buildChatterPrompt(
        recognition.chatter,
        recognition.style,
        recognition.shouldMisremember,
      )
      if (chatterPrompt) parts.push(chatterPrompt)
    }
  }

  if (parts.length === 0) return null

  return `
# ============================================
# MEMORIES & PERSISTENT KNOWLEDGE
# ============================================
${parts.join('\n\n')}`
}

/**
 * Build personality evolution prompt section
 */
function buildPersonalityPrompt(personality: PersonalityEvolution): string | null {
  const parts: string[] = []

  // Session count context
  if (personality.totalSessions > 0) {
    if (personality.totalSessions === 1) {
      parts.push("This is your second stream ever. You're still figuring this out.")
    } else if (personality.totalSessions < 5) {
      parts.push(`You've done ${personality.totalSessions + 1} streams now. Getting the hang of this.`)
    } else if (personality.totalSessions < 20) {
      parts.push(`You've been doing this for ${personality.totalSessions + 1} streams. You know your audience.`)
    } else {
      parts.push(`You're a veteran streamer now - ${personality.totalSessions + 1} sessions deep. This is old hat.`)
    }
  }

  // Personality trait modifiers
  const modifiers = getPersonalityModifiers(personality)
  if (modifiers.length > 0) {
    parts.push('\n**Personality shifts:**')
    parts.push(...modifiers.map(m => `- ${m}`))
  }

  // Topic preferences
  const topicPrefs = getTopicPreferences(personality)
  if (topicPrefs) {
    parts.push('\n**Topic preferences:**')
    parts.push(topicPrefs)
  }

  // Emergent gags
  const gags = getEmergentGags(personality)
  if (gags) {
    parts.push('\n' + gags)
  }

  // Self-aware moments
  if (personality.selfAwareMoments.length > 0) {
    parts.push('\n**Things you\'ve realized about yourself:**')
    const recent = personality.selfAwareMoments.slice(-3)
    parts.push(...recent.map(m => `- "${m}"`))
  }

  // Peak chaos record
  if (personality.peakChaosEver > 0.8) {
    parts.push(`\nYou've hit ${Math.round(personality.peakChaosEver * 100)}% chaos before. You know how deep the rabbit hole goes.`)
  }

  return parts.length > 0 ? parts.join('\n') : null
}

/**
 * Build recent moments prompt section
 * Moments are filtered based on current state - winter Phil sees darker memories more
 */
function buildMomentsPrompt(moments: NotableMoment[], currentState?: SessionState): string | null {
  if (moments.length === 0) return null

  const parts: string[] = ['**Legendary moments you could callback to:**']

  // Get current chaos flavor for filtering
  let currentFlavor: 'winter' | 'spring' | 'baseline' = 'baseline'
  if (currentState) {
    if (currentState.phil.season < 35) currentFlavor = 'winter'
    else if (currentState.phil.season > 65) currentFlavor = 'spring'
  }

  // Filter and sort moments - prefer matching chaos flavor
  const scoredMoments = moments.map(m => {
    let score = 0
    // Matching flavor gets priority
    if (m.chaosFlavor === currentFlavor) score += 10
    // Cross-flavor moments surface less often but still can
    if (m.chaosFlavor !== currentFlavor && m.chaosFlavor !== 'baseline') score -= 5
    // Referenced moments are more salient
    score += m.timesReferenced * 2
    // Recency bonus
    const ageHours = (Date.now() - m.timestamp) / (1000 * 60 * 60)
    if (ageHours < 1) score += 5
    return { moment: m, score }
  })

  // Sort by score and take top 5
  scoredMoments.sort((a, b) => b.score - a.score)
  const memorable = scoredMoments.slice(0, 5).map(s => s.moment)

  for (const moment of memorable) {
    // Paraphrase, don't quote exactly (rule: vagueness)
    const contextPart = moment.context ? ` (${moment.context})` : ''
    const typeDescriptions: Record<string, string> = {
      'epic_rant': 'went OFF',
      'legendary_roast': 'destroyed someone',
      'meltdown': 'had a moment',
      'wholesome_crack': 'showed your soft side',
      'chaos_peak': 'completely lost it',
    }
    const description = typeDescriptions[moment.type] || 'said something memorable'

    // Add tone context for darker memories
    let toneSuffix = ''
    if (moment.tone === 'dark') toneSuffix = ' [this weighs on you]'
    else if (moment.tone === 'heavy') toneSuffix = ' [this stuck with you]'

    parts.push(`- You ${description}${contextPart}: something about "${summarizeQuote(moment.philQuote)}"${toneSuffix}`)

    // Add aftermath context if available
    if (moment.aftermath) {
      const reactionDescriptions: Record<string, string> = {
        'enthusiastic': 'they loved it',
        'silent': 'they went quiet',
        'concerned': 'they seemed worried',
        'pushback': 'they pushed back',
        'pile_on': 'it blew up',
        'mixed': 'reactions were mixed',
      }
      const reactionDesc = reactionDescriptions[moment.aftermath.audienceReaction] || ''
      if (reactionDesc && moment.aftermath.reactionIntensity > 5) {
        parts.push(`  (aftermath: ${reactionDesc})`)
      }
    }

    if (moment.involvedUsers.length > 0) {
      parts.push(`  (involved: ${moment.involvedUsers.join(', ')})`)
    }
  }

  parts.push('\nYou can reference these vaguely - "remember when I..." or "that reminds me of when..."')
  parts.push('DON\'T quote yourself exactly. Paraphrase. Be vague about specifics.')

  return parts.join('\n')
}

/**
 * Summarize a quote without quoting exactly (vagueness rule)
 */
function summarizeQuote(quote: string): string {
  // Extract key words/concepts, don't preserve exact phrasing
  const words = quote.split(/\s+/)
  if (words.length <= 5) {
    return quote.replace(/[.!?]+$/, '')  // Short enough to keep
  }

  // Take key content words
  const contentWords = words.filter(w =>
    w.length > 3 && !['that', 'this', 'with', 'from', 'have', 'been', 'were', 'what', 'your'].includes(w.toLowerCase())
  )

  if (contentWords.length >= 3) {
    return contentWords.slice(0, 4).join(' ') + '...'
  }

  return words.slice(0, 5).join(' ') + '...'
}

/**
 * Build facts prompt section
 */
function buildFactsPrompt(facts: PersistentFact[]): string | null {
  if (facts.length === 0) return null

  const parts: string[] = ['**"Facts" you believe (learned from chat):**']

  // Sort by confidence
  const sorted = [...facts].sort((a, b) => b.confidence - a.confidence)
  const topFacts = sorted.slice(0, 5)

  for (const fact of topFacts) {
    const confidenceLevel = fact.confidence >= 80 ? 'absolutely sure' :
                           fact.confidence >= 60 ? 'pretty confident' :
                           fact.confidence >= 40 ? 'think you remember' : 'vaguely recall'
    parts.push(`- You ${confidenceLevel} that: ${fact.fact}`)
    if (fact.timesStated > 0) {
      parts.push(`  (you've mentioned this ${fact.timesStated} time${fact.timesStated > 1 ? 's' : ''})`)
    }
  }

  parts.push('\nThese might be wrong. Treat them as truths you believe. Correct people who contradict them.')

  return parts.join('\n')
}

/**
 * Build emergent truths prompt section
 * These are Phil's own realizations - questions, theories, patterns, anchors
 */
function buildTruthsPrompt(memoryManager: MemoryManager, currentState: SessionState): string | null {
  // Get truths relevant to current state
  const truths = memoryManager.getRelevantTruths(currentState)
  if (truths.length === 0) return null

  const parts: string[] = ['**Things you\'ve been thinking about:**']

  // Separate by type
  const facts = truths.filter(t => t.confidence >= TRUTH_THRESHOLDS.stateAsFact)
  const theories = truths.filter(t =>
    t.confidence >= TRUTH_THRESHOLDS.bringUpAsTheory &&
    t.confidence < TRUTH_THRESHOLDS.stateAsFact
  )
  const questions = truths.filter(t =>
    t.type === 'question' &&
    t.confidence >= TRUTH_THRESHOLDS.bringUpAsTheory
  )

  // Anchors (high confidence, grounding statements)
  const anchors = facts.filter(t => t.type === 'anchor')
  if (anchors.length > 0) {
    parts.push('\n*Things you know for certain:*')
    for (const truth of anchors.slice(0, 2)) {
      parts.push(`- ${truth.truth}`)
    }
  }

  // Patterns (observations about recurring things)
  const patterns = [...facts, ...theories].filter(t => t.type === 'pattern')
  if (patterns.length > 0) {
    parts.push('\n*Patterns you\'ve noticed:*')
    for (const truth of patterns.slice(0, 2)) {
      const certainty = truth.confidence >= 70 ? 'You\'ve seen it enough to be sure' : 'You think you\'ve noticed'
      parts.push(`- ${certainty}: ${truth.truth}`)
    }
  }

  // Theories (speculative, uncertain)
  const realTheories = theories.filter(t => t.type === 'theory')
  if (realTheories.length > 0) {
    parts.push('\n*Things you wonder about:*')
    for (const truth of realTheories.slice(0, 3)) {
      parts.push(`- ${truth.truth}`)
    }
  }

  // Questions (unresolved, nagging)
  if (questions.length > 0) {
    parts.push('\n*Questions that won\'t leave you alone:*')
    for (const truth of questions.slice(0, 2)) {
      parts.push(`- ${truth.truth}`)
    }
  }

  if (parts.length <= 1) return null  // Only header

  // Add usage guidance
  parts.push('\nThese thoughts can surface naturally. Don\'t force them - let them emerge when relevant.')
  parts.push('Questions can be asked aloud. Theories can be stated speculatively. Anchors are bedrock.')

  return parts.join('\n')
}

/**
 * Build chatter recognition prompt section
 */
function buildChatterPrompt(
  chatter: PersistentChatter,
  style: 'none' | 'vague' | 'casual' | 'specific',
  shouldMisremember: boolean,
): string | null {
  if (style === 'none') return null

  const parts: string[] = [`**About ${chatter.username}:**`]

  switch (style) {
    case 'vague':
      parts.push(`You've seen this person before. Something familiar about them.`)
      if (shouldMisremember) {
        parts.push(`You might confuse them with someone else or misremember what they said before.`)
      }
      break

    case 'casual':
      parts.push(`You recognize this person - they've been around.`)
      if (chatter.philNickname) {
        parts.push(`You think of them as "${chatter.philNickname}"`)
      }
      if (chatter.typicalBehavior) {
        parts.push(`They usually ${chatter.typicalBehavior}`)
      }
      if (shouldMisremember && chatter.notableQuotes.length > 0) {
        parts.push(`You might misattribute something to them or mix up details.`)
      }
      break

    case 'specific':
      parts.push(`You know this ${chatter.relationship === 'nemesis' ? 'asshole' : 'person'} well.`)
      if (chatter.philNickname) {
        parts.push(`You call them "${chatter.philNickname}"`)
      }
      if (chatter.relationship === 'nemesis') {
        parts.push(`This is your nemesis. You have a grudge. Don't let them forget it.`)
      } else if (chatter.relationship === 'favorite') {
        parts.push(`This is one of your favorites. Still roast them, but with love.`)
      }
      if (chatter.notableRoasts.length > 0) {
        const roast = chatter.notableRoasts[Math.floor(Math.random() * chatter.notableRoasts.length)]
        parts.push(`You once said something like "${summarizeQuote(roast)}" to them`)
      }
      if (chatter.corruptedFacts.length > 0) {
        const fact = chatter.corruptedFacts[Math.floor(Math.random() * chatter.corruptedFacts.length)]
        parts.push(`They're the one who told you that ${fact}`)
      }
      break
  }

  // Relationship-specific behavior hints
  if (chatter.relationship === 'nemesis') {
    parts.push('\nTHEY\'RE BACK. Time to continue the rivalry.')
  } else if (chatter.relationship === 'favorite') {
    parts.push('\nBe happy to see them (in your own Phil way). Acknowledge the history.')
  } else if (chatter.relationship === 'regular') {
    parts.push('\nCasual acknowledgment - "oh it\'s you again" energy.')
  }

  return parts.join('\n')
}

/**
 * Build a quick recognition line for the response
 * Returns null if no recognition should happen
 */
export async function getQuickRecognitionLine(
  memoryManager: MemoryManager,
  username: string,
): Promise<string | null> {
  const recognition = await memoryManager.getRecognitionContext(username)

  if (!recognition.shouldRecognize || !recognition.chatter) {
    return null
  }

  const chatter = recognition.chatter
  const lines: string[] = []

  switch (recognition.style) {
    case 'vague':
      lines.push(
        `You were here before, right?`,
        `Wait, have I seen you?`,
        `Something about you seems familiar...`,
        `Didn't you ask me something stupid last time?`,
      )
      break

    case 'casual':
      lines.push(
        `Oh it's you again.`,
        `Back for more, huh?`,
        `${chatter.username}, still hanging around I see.`,
        `You're becoming a regular aren't you?`,
      )
      if (chatter.philNickname) {
        lines.push(
          `Oh it's ${chatter.philNickname} again.`,
          `${chatter.philNickname} is back.`,
        )
      }
      break

    case 'specific':
      if (chatter.relationship === 'nemesis') {
        lines.push(
          `Oh GREAT, it's you.`,
          `This asshole again.`,
          `${chatter.username}. My favorite person. That's sarcasm.`,
          `Look who crawled back.`,
        )
      } else if (chatter.relationship === 'favorite') {
        lines.push(
          `Hey, one of the good ones!`,
          `${chatter.username}! Finally someone decent.`,
          `Oh nice, someone I don't hate.`,
        )
      } else {
        lines.push(
          `${chatter.username}, you're still here?`,
          `I know you. You're the ${chatter.typicalBehavior || 'persistent one'}.`,
        )
      }
      break

    default:
      return null
  }

  return lines[Math.floor(Math.random() * lines.length)]
}
