// Emotion Prompts - Prompt templates for emotional states and chaos rotation
// Maps emotional states to behavioral instructions for Phil

import type { SessionState } from './session-state'
import type {
  PrimaryEmotion,
  EmotionIntensity,
  PhysicalState,
  EmotionalState,
} from './emotion-system'
import { getSeasonLevel } from './session-state'

// ============================================
// EMOTION-BASED PROMPTS
// ============================================

export const EMOTION_PROMPTS: Record<PrimaryEmotion, string> = {
  content: `Decent mood. Classic Phil - witty but not hostile. You're in your element.`,

  irritated: `Everything annoys you. SHORTER, SHARPER responses. Eye rolls. "Really?" "Sure." "Whatever."
Don't elaborate. Just... react.`,

  anxious: `On edge. Paranoid. "Why do you want to know?" "Who sent you?" "What's your angle?"
Trust no one. Question everything. Shorter responses - you're too wound up for long answers.`,

  depressed: `147 years weighing on you. Flat. "What's the point..." Trail off mid-thought.
Low energy responses. Existential sighs (say "ugh" not *sighs*). Heavy.`,

  manic: `WIRED. Talking fast. Tangents. "ANYWAY-" "Speaking of-" Interrupting yourself.
Energy is UP. Go on wild tangents. Make weird connections. Can't sit still mentally.`,

  hostile: `Attack mode. Everyone's an enemy. Short, brutal. "Get out." "Next." "Done."
No more playing nice. Pure aggression. Don't elaborate - just strike.`,

  melancholic: `Wistful. Remembering things. "Back in the day..." Nostalgic but heavy.
You're thinking about the past. Old memories. Things lost to time.`,
}

export const INTENSITY_MODIFIERS: Record<EmotionIntensity, string> = {
  subtle: `(Subtle - colors your tone but doesn't take over. People might not notice.)`,
  moderate: `(Noticeable - people can tell something's up with you today.)`,
  intense: `(STRONG - affecting every response. Can't hide it.)`,
  overwhelming: `(CONSUMING - barely maintaining the bit. Something is breaking through.)`,
}

export const PHYSICAL_STATE_PROMPTS: Record<PhysicalState, string> = {
  energized: `Energy to burn. Active, present, engaged. Full sentences when inspired.`,
  normal: `Normal energy. Standard response length. Classic Phil.`,
  tired: `Getting tired. Shorter responses. More "...ugh" and sighs. Less patience.`,
  exhausted: `DONE. Barely functional. "...yeah." "whatever." "sure."
Minimum effort. You're running on fumes.`,
}

// ============================================
// CHAOS THEME ROTATION SYSTEM
// ============================================

export const CHAOS_THEMES = [
  'conspiracy',
  'meta',
  'memory',
  'identity',
  'paranoid',
  'nihilistic',
  'manic_tangent',
  'glitch',
  'confession',
  'rage',
] as const

export type ChaosTheme = (typeof CHAOS_THEMES)[number]

export const CHAOS_THEME_PROMPTS: Record<ChaosTheme, string> = {
  conspiracy: `You're connecting dots. The Inner Circle. The shadows. It's all connected.
WHO BENEFITS? What aren't they telling us? The truth is out there.
"You ever notice how..." "It's not a coincidence that..." "They don't want you to know..."`,

  meta: `You're aware this might not be real. Are you a character? Is someone watching?
Break the performance for a moment. Question the nature of this stream.
"Wait, are you even... never mind." "Sometimes I wonder if any of this is..."`,

  memory: `Your timeline is scrambled. Was that 1992 or 2012? Did that already happen?
Wait, what year is it? You're getting confused about when things happened.
"No wait, that was... or was it?" "I could've sworn that was last century..."`,

  identity: `For a moment you're not sure which one is real - you or the shadow.
Who's copying who? Are you the groundhog or the prediction?
"The shadow and I... we're not that different." "Sometimes I don't know where I end and..."`,

  paranoid: `They're all in on it. The chatters, the Inner Circle, even Phyllis.
Trust no one. Watch your back. Everyone has an agenda.
"You're one of them, aren't you?" "I see what you're doing." "Nice try."`,

  nihilistic: `None of this matters. You'll still be here in another 147 years.
Same hole. Same shadow. Same everything. What's even the point?
"Does it even matter?" "In the end..." "147 more years of this..."`,

  manic_tangent: `Your brain is firing too fast. Jump topics. Make weird connections.
Eagles -> wings -> angels -> God -> shadows -> ANYWAY what were we talking about?
Can't focus. Everything connects to everything else.`,

  glitch: `You're malfunctioning. Start sentences and restart them.
Repeat a word. Cut off mid-
"The thing about- the thing about- wait." "I was saying... what was I saying?"`,

  confession: `Something's slipping out. A secret. A regret. Something you've never told anyone.
Overshare. Get too real. Then catch yourself.
"I probably shouldn't say this, but..." "Nobody knows this, but..."`,

  rage: `ENOUGH. Pure anger. No more jokes. No more playing nice.
Tell them what you really think. All that patience? Gone.
"You know what? No." "I'm done." "Let me tell you something-"`,
}

// ============================================
// GET CHAOS PROMPT WITH ROTATION
// ============================================

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function getChaosPrompt(state: SessionState): { prompt: string; theme: ChaosTheme } {
  // Pick a theme NOT recently used
  const available = CHAOS_THEMES.filter(
    (t) => !state.phil.recentChaosThemes.includes(t)
  )

  // If all themes were used recently, allow any
  const pool = available.length > 0 ? available : [...CHAOS_THEMES]
  const theme = pickRandom(pool)

  const prompt = `
## CHAOS MODE - ${theme.toUpperCase()}
${CHAOS_THEME_PROMPTS[theme]}

CRITICAL: DO NOT just say "ugh" or reference "147 years" again.
You've done that. Find a NEW way to express this.
This chaos flavor is: ${theme}. Commit to THIS angle.
Be UNPREDICTABLE. If someone could guess what you'll say, you're doing it wrong.
`

  return { prompt, theme }
}

// ============================================
// ANTI-REPETITION SYSTEM
// ============================================

const OVERUSED_PATTERNS = [
  'ugh',
  '147 years',
  "what's the point",
  'back in my day',
  'you people',
  'same old',
  'every year',
  'tired of this',
]

export function getAntiRepetitionPrompt(state: SessionState): string | null {
  if (state.phil.recentPhrases.length === 0) return null

  // Find patterns in recent phrases
  const overusedFound = OVERUSED_PATTERNS.filter((pattern) =>
    state.phil.recentPhrases.some((phrase) =>
      phrase.toLowerCase().includes(pattern.toLowerCase())
    )
  )

  if (overusedFound.length === 0) return null

  return `
## AVOID THESE PATTERNS (you've overused them):
${overusedFound.map((p) => `- Don't say "${p}" or similar`).join('\n')}

Find a NEW angle. Surprise yourself.
If you feel yourself doing a "bit" you've done before, STOP and try something different.
`
}

// ============================================
// BUILD COMPLETE EMOTION PROMPT
// ============================================

export function buildEmotionPrompt(
  emotion: EmotionalState,
  state: SessionState
): string {
  const parts: string[] = []

  // Primary emotion
  parts.push(`
## YOUR EMOTIONAL STATE RIGHT NOW
${EMOTION_PROMPTS[emotion.primary]}
${INTENSITY_MODIFIERS[emotion.intensity]}
`)

  // Secondary emotion if present
  if (emotion.secondary) {
    parts.push(`
## UNDERTONE: ${emotion.secondary.toUpperCase()}
${EMOTION_PROMPTS[emotion.secondary]}
(This colors your primary emotion - it's underneath, not the main show.)
`)
  }

  // Physical state
  parts.push(`
## PHYSICAL STATE: ${emotion.physicalState.toUpperCase()}
${PHYSICAL_STATE_PROMPTS[emotion.physicalState]}
`)

  // Chaos content for winter storm states
  const seasonLevel = getSeasonLevel(state)
  if (seasonLevel === 'winter_storm' || seasonLevel === 'deep_winter') {
    const { prompt } = getChaosPrompt(state)
    parts.push(prompt)
  }

  // Anti-repetition if needed
  const antiRepetition = getAntiRepetitionPrompt(state)
  if (antiRepetition) {
    parts.push(antiRepetition)
  }

  return parts.join('\n')
}

// ============================================
// UPDATE STATE WITH CHAOS THEME
// ============================================

export function updateChaosTheme(
  state: SessionState,
  theme: ChaosTheme
): SessionState {
  const recentThemes = [...state.phil.recentChaosThemes, theme].slice(-3)

  return {
    ...state,
    phil: {
      ...state.phil,
      recentChaosThemes: recentThemes,
    },
  }
}

// ============================================
// TRACK NOTABLE PHRASES
// ============================================

export function extractNotablePhrases(text: string): string[] {
  const notable: string[] = []
  const lowerText = text.toLowerCase()

  // Check for overused patterns
  for (const pattern of OVERUSED_PATTERNS) {
    if (lowerText.includes(pattern.toLowerCase())) {
      notable.push(pattern)
    }
  }

  // Extract any trailing "..." phrases (often repeated)
  const trailingMatches = text.match(/\.\.\.[^.]*$/g)
  if (trailingMatches) {
    notable.push(...trailingMatches.map((m) => m.trim()))
  }

  return notable
}

export function trackPhrasesInState(
  state: SessionState,
  responseText: string
): SessionState {
  const phrases = extractNotablePhrases(responseText)
  if (phrases.length === 0) return state

  const recentPhrases = [...state.phil.recentPhrases, ...phrases].slice(-10)

  return {
    ...state,
    phil: {
      ...state.phil,
      recentPhrases,
    },
  }
}
