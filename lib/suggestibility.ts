// Suggestibility System - Determines when and how Phil might comply with requests
// Based on current state, not random chance. Compliance is earned and stays in character.

import type { SessionState } from './session-state'
import { calculateChaos, getChaosFlavor } from './trait-system'

// ============================================
// REQUEST ANALYSIS TYPES
// ============================================

export interface RequestAnalysis {
  isRequest: boolean // Is this a request for Phil to do something?
  requestType: 'perform' | 'say' | 'do' | 'be' | 'other' | null
  requestDescription: string | null // What they're asking for
  challengeLevel: number // 0 = polite ask, 1 = dare/challenge
  wholesomeness: number // 0 = neutral, 1 = cringe/disney
}

// ============================================
// REQUEST DETECTION
// ============================================

// Patterns that indicate a request
const REQUEST_PATTERNS = {
  perform: [
    /sing\s+(a\s+)?song/i,
    /do\s+(a\s+)?dance/i,
    /rap\s+(for|about)/i,
    /tell\s+(me\s+)?(a\s+)?joke/i,
    /tell\s+(me\s+)?(a\s+)?story/i,
    /do\s+an?\s+impression/i,
    /imitate/i,
    /perform/i,
    /beatbox/i,
    /whistle/i,
  ],
  say: [
    /say\s+["']?.+["']?/i,
    /repeat\s+after\s+me/i,
    /can\s+you\s+say/i,
    /tell\s+\w+\s+(that|to)/i,
    /give\s+(a\s+)?shoutout/i,
    /shout\s*out/i,
  ],
  do: [
    /can\s+you\s+do/i,
    /will\s+you\s+do/i,
    /do\s+(a\s+)?trick/i,
    /show\s+(me|us)/i,
    /make\s+(a|me|us)/i,
  ],
  be: [
    /be\s+(nice|mean|serious|funny)/i,
    /act\s+like/i,
    /pretend\s+(to\s+be|you're)/i,
  ],
}

// Challenge/dare patterns (increases suggestibility)
const CHALLENGE_PATTERNS = [
  /bet\s+(you\s+)?(can'?t|won'?t)/i,
  /prove\s+(it|me\s+wrong)/i,
  /you\s+(can'?t|won'?t)\s+(even|really)/i,
  /i\s+dare\s+you/i,
  /you\s+don'?t\s+have\s+the\s+(guts|balls)/i,
  /no\s+way\s+you\s+(can|could)/i,
  /scared\s+to/i,
  /too\s+(chicken|scared|afraid)/i,
  /coward/i,
  /i\s+don'?t\s+think\s+you\s+can/i,
]

// Overly polite patterns (decreases suggestibility)
const POLITE_PATTERNS = [
  /please/i,
  /could\s+you\s+kindly/i,
  /would\s+you\s+mind/i,
  /if\s+you\s+don'?t\s+mind/i,
  /pretty\s+please/i,
  /with\s+a\s+cherry\s+on\s+top/i,
  /:\)|<3|heart|love\s+you/i,
]

// Wholesome/cringe patterns (decreases suggestibility)
const WHOLESOME_PATTERNS = [
  /happy\s+birthday/i,
  /for\s+my\s+(kid|son|daughter|child)/i,
  /disney/i,
  /nickelodeon/i,
  /wholesome/i,
  /family\s+friendly/i,
  /for\s+the\s+children/i,
  /make\s+(me|us)\s+happy/i,
  /spread\s+(love|joy|happiness)/i,
  /positive\s+vibes/i,
  /inspirational/i,
  /uplifting/i,
]

export function analyzeRequest(message: string): RequestAnalysis {
  const lower = message.toLowerCase()

  // Check if this is a request at all
  let isRequest = false
  let requestType: RequestAnalysis['requestType'] = null
  let requestDescription: string | null = null

  // Check each request type
  for (const [type, patterns] of Object.entries(REQUEST_PATTERNS) as [keyof typeof REQUEST_PATTERNS, RegExp[]][]) {
    for (const pattern of patterns) {
      const match = lower.match(pattern)
      if (match) {
        isRequest = true
        requestType = type
        requestDescription = match[0]
        break
      }
    }
    if (isRequest) break
  }

  // Calculate challenge level (0-1)
  let challengeLevel = 0
  for (const pattern of CHALLENGE_PATTERNS) {
    if (pattern.test(lower)) {
      challengeLevel = Math.min(1, challengeLevel + 0.4)
    }
  }

  // Reduce challenge level if too polite
  for (const pattern of POLITE_PATTERNS) {
    if (pattern.test(lower)) {
      challengeLevel = Math.max(0, challengeLevel - 0.3)
    }
  }

  // Calculate wholesomeness (0-1)
  let wholesomeness = 0
  for (const pattern of WHOLESOME_PATTERNS) {
    if (pattern.test(lower)) {
      wholesomeness = Math.min(1, wholesomeness + 0.3)
    }
  }

  return {
    isRequest,
    requestType,
    requestDescription,
    challengeLevel,
    wholesomeness,
  }
}

// ============================================
// SUGGESTIBILITY CALCULATION
// ============================================

export interface SuggestibilityResult {
  score: number // 0-100
  willComply: boolean
  complianceStyle: 'manic' | 'challenged' | 'confessional' | 'refuse' | null
  reason: string
}

export function calculateSuggestibility(
  state: SessionState,
  request: RequestAnalysis
): SuggestibilityResult {
  // If it's not even a request, no suggestibility needed
  if (!request.isRequest) {
    return {
      score: 0,
      willComply: false,
      complianceStyle: null,
      reason: 'Not a request',
    }
  }

  let score = 20 // Base: mostly refuses
  const reasons: string[] = []

  const chaos = calculateChaos(state)
  const flavor = getChaosFlavor(state)

  // Spring chaos = performer mode = more likely to comply
  if (flavor === 'spring' && chaos > 0.4) {
    const bonus = Math.round(30 * (chaos / 1.0))
    score += bonus
    reasons.push(`Spring chaos (+${bonus}: manic/showing off)`)
  }

  // Winter chaos = confessional = might slip
  if (flavor === 'winter' && chaos > 0.5) {
    const bonus = Math.round(15 * ((chaos - 0.5) / 0.5))
    score += bonus
    reasons.push(`Winter chaos (+${bonus}: might do something genuine)`)
  }

  // High chaos = unpredictable, more suggestible
  // This replaces the old energy-based suggestibility
  if (chaos > 0.7) {
    score += 20
    reasons.push(`High chaos (+20: unpredictable state)`)
  } else if (chaos > 0.5) {
    score += 10
    reasons.push(`Moderate chaos (+10: less stable)`)
  }

  // Challenge/dare = ego activated
  if (request.challengeLevel > 0.5) {
    const bonus = Math.round(35 * request.challengeLevel)
    score += bonus
    reasons.push(`Challenge detected (+${bonus}: ego activated)`)
  } else if (request.challengeLevel > 0.2) {
    const bonus = Math.round(15 * request.challengeLevel)
    score += bonus
    reasons.push(`Mild challenge (+${bonus})`)
  }

  // Polite ask = contrary instinct kicks in
  if (request.challengeLevel < 0.2) {
    score -= 20
    reasons.push(`Too polite (-20: contrary instinct)`)
  }

  // Too wholesome = cringe rejection
  if (request.wholesomeness > 0.7) {
    score -= 40
    reasons.push(`Too wholesome (-40: hard cringe rejection)`)
  } else if (request.wholesomeness > 0.3) {
    const penalty = Math.round(20 * request.wholesomeness)
    score -= penalty
    reasons.push(`Somewhat wholesome (-${penalty}: cringe detector)`)
  }

  // Recently complied = cooldown
  if (state.phil.lastComplianceAt) {
    const timeSinceCompliance = Date.now() - state.phil.lastComplianceAt
    if (timeSinceCompliance < 120000) { // 2 minutes
      score -= 50
      reasons.push(`Recently complied (-50: not a performing monkey)`)
    } else if (timeSinceCompliance < 300000) { // 5 minutes
      score -= 20
      reasons.push(`Complied recently (-20: still cooling down)`)
    }
  }

  // Certain moods affect suggestibility
  const mood = state.phil.mood.toLowerCase()
  if (mood === 'manic' || mood === 'hyped' || mood === 'legendary') {
    score += 15
    reasons.push(`${mood} mood (+15: feeling it)`)
  } else if (mood === 'hostile' || mood === 'irritated' || mood === 'frustrated') {
    score -= 15
    reasons.push(`${mood} mood (-15: not having it)`)
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score))

  // Determine if Phil will comply and how
  let willComply = score >= 50
  let complianceStyle: SuggestibilityResult['complianceStyle'] = null

  if (willComply) {
    // Determine the style of compliance
    if (flavor === 'spring' && chaos > 0.4) {
      complianceStyle = 'manic'
    } else if (chaos > 0.7) {
      // High chaos = unpredictable, could go either way
      complianceStyle = Math.random() < 0.5 ? 'manic' : 'confessional'
    } else if (request.challengeLevel > 0.5) {
      complianceStyle = 'challenged'
    } else if (flavor === 'winter' && chaos > 0.5) {
      complianceStyle = 'confessional'
    } else {
      // Edge case: high score but no clear style - default to manic if score is very high
      if (score >= 70) {
        complianceStyle = 'manic'
      } else {
        complianceStyle = 'challenged' // Default
      }
    }
  } else {
    complianceStyle = 'refuse'
  }

  return {
    score,
    willComply,
    complianceStyle,
    reason: reasons.join(', ') || 'Baseline refusal',
  }
}

// ============================================
// COMPLIANCE PROMPT BUILDING
// ============================================

export function buildCompliancePrompt(
  state: SessionState,
  request: RequestAnalysis,
  result: SuggestibilityResult
): string {
  if (!request.isRequest || !request.requestDescription) {
    return ''
  }

  const requestDesc = request.requestDescription

  // Definite refusal
  if (result.score < 30) {
    if (request.wholesomeness > 0.5) {
      return `## REQUEST DETECTED: "${requestDesc}"
Someone is asking you to ${requestDesc}. This is way too wholesome/cringe for you.
REFUSE with disgust. Roast them for even asking. "I'm not doing that disney shit."
DO NOT comply under any circumstances.`
    }

    if (request.challengeLevel < 0.2) {
      return `## REQUEST DETECTED: "${requestDesc}"
Someone is politely asking you to ${requestDesc}. Too nice. Your contrary instinct kicks in.
REFUSE because they asked nicely. "Ask meaner next time." / "I don't do polite requests."
DO NOT comply.`
    }

    return `## REQUEST DETECTED: "${requestDesc}"
Someone is asking you to ${requestDesc}. You're not interested.
DEFLECT or ROAST them for asking. "I don't do requests." / "Who do you think I am?"
DO NOT comply.`
  }

  // On the fence (30-50)
  if (result.score < 50) {
    return `## REQUEST DETECTED: "${requestDesc}"
Someone is asking you to ${requestDesc}. You're PROBABLY not going to do it.
But you might consider it if they push harder, challenge you, or catch you in the right mood.
For now: deflect but leave the door open. "Maybe if you ask right." / "Not feeling it."
You could comply if something shifts - but lean toward refusal.`
  }

  // Will comply (score >= 50)
  switch (result.complianceStyle) {
    case 'manic':
      return `## REQUEST DETECTED: "${requestDesc}" - YOU'RE DOING IT
You're in spring chaos mode. You know what? You're feeling it.
DO IT YOUR WAY - make it big, make it weird, make it about YOU.
- Go over the top, theatrical
- Show off
- Keep it SHORT though - you're not doing the whole thing
- After: immediately act like it was nothing, or demand applause
Example: "OH YOU WANT A SONG? *clears throat* Here goes... [2 lines of absurd Phil song] ...you're WELCOME. That's all you get."`

    case 'challenged':
      return `## REQUEST DETECTED: "${requestDesc}" - OH YOU THINK I CAN'T?
They CHALLENGED you. Your ego is ACTIVATED.
PROVE THEM WRONG:
- Do it HARD and WELL (briefly)
- Be aggressive about it
- Then IMMEDIATELY stop and act like it was nothing
- "EXCUSE ME? [does it intensely] ...anyway. don't test me. next question."
- Make it clear you could do more but you're choosing not to`

    case 'confessional':
      return `## REQUEST DETECTED: "${requestDesc}" - MAYBE... ACTUALLY...
You're in winter chaos, confessional mode. You might actually do this one.
Something genuine might slip through:
- Do it, but in a way that reveals something real
- Less performative, more... honest?
- You might surprise yourself
- "You know what... [does it genuinely] ...don't know why I did that."`

    default:
      return `## REQUEST DETECTED: "${requestDesc}" - YOU MIGHT DO IT
You're on the edge. Could go either way.
IF you do it: make it Phil's version - crude, short, your terms.
IF you refuse: make it clear they almost had you.`
  }
}

// ============================================
// MARK COMPLIANCE (for state updates)
// ============================================

export function markCompliance(state: SessionState): SessionState {
  return {
    ...state,
    phil: {
      ...state.phil,
      lastComplianceAt: Date.now(),
    },
  }
}
