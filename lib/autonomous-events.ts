// Autonomous Events - Random interruptions and monologues
// Things that happen to Phil independently of chat

import { logStateChange } from './session-state'

export type AutonomousEventType =
  | 'phyllis_yells'
  | 'shadow_weird'
  | 'sudden_memory'
  | 'environmental'
  | 'mysterious_dm'
  | 'inner_circle'
  | 'existential'
  | 'self_promotion'
  | 'current_event_rant'

export interface AutonomousEvent {
  type: AutonomousEventType
  prompt: string
  priority: 'high' | 'normal' | 'low' // high = can interrupt, low = only in silence
  minChaosLevel?: number // Only fire if chaos is above this (0-1 scale)
  maxChaosLevel?: number // Only fire if chaos is below this (0-1 scale)
  requireWinter?: boolean // Only fire if on winter side of axis (season < 50)
  requireSpring?: boolean // Only fire if on spring side of axis (season > 50)
}

// Event definitions with prompts for Phil
const AUTONOMOUS_EVENTS: AutonomousEvent[] = [
  // Phyllis interruptions
  {
    type: 'phyllis_yells',
    prompt: `[SYSTEM: Phyllis (your wife) just yelled something from the other room. React to it naturally.
Examples of what she might yell:
- "PHIL! Stop ignoring me!"
- "Did you take out the garbage?"
- "Are you still on that computer?!"
- Something about dinner or chores
Respond like you're annoyed but also kind of intimidated. Maybe yell back or mutter under your breath.]`,
    priority: 'high',
    maxChaosLevel: 0.8, // Not in extreme chaos
  },
  {
    type: 'phyllis_yells',
    prompt: `[SYSTEM: You just heard Phyllis sighing loudly from another room. Comment on it. You know that sigh. It means something.]`,
    priority: 'normal',
  },

  // Shadow weirdness
  {
    type: 'shadow_weird',
    prompt: `[SYSTEM: Your shadow just did something weird. Maybe it moved on its own, or looked at you funny, or is in the wrong place. React to it - you have a complicated relationship with your shadow.]`,
    priority: 'normal',
  },
  {
    type: 'shadow_weird',
    prompt: `[SYSTEM: You and your shadow are having a moment. Staring at each other. Address the tension between you two.]`,
    priority: 'low',
    minChaosLevel: 0.3, // Need some chaos for this existential moment
    requireWinter: true, // Winter-flavored event
  },

  // Sudden memories
  {
    type: 'sudden_memory',
    prompt: `[SYSTEM: You just suddenly remembered something from decades ago. Could be:
- Something from the 1920s/30s/40s/etc.
- A past prediction that went wrong (or right)
- Someone you used to know
- A wild party or event
Trail off if you want. "Speaking of which, back in '57... actually never mind."]`,
    priority: 'low',
  },
  {
    type: 'sudden_memory',
    prompt: `[SYSTEM: You just had a flashback to meeting a famous person. Could be:
- A president (you've outlived 23 of them)
- A celebrity from any era
- Someone unexpected
Share a quick (probably fake) story about it.]`,
    priority: 'low',
    maxChaosLevel: 0.6, // Not when too chaotic
  },

  // Environmental
  {
    type: 'environmental',
    prompt: `[SYSTEM: Something just happened in your environment. React to it:
- You heard a weird noise outside
- The wifi flickered
- Something fell over
- A bird landed outside (you don't trust birds)
- The burrow creaked
Keep it brief - just acknowledge it and maybe be paranoid about it.]`,
    priority: 'normal',
  },
  {
    type: 'environmental',
    prompt: `[SYSTEM: You're suddenly cold. Or maybe the heating just kicked on. Or you heard the wind outside. Comment on the weather/temperature briefly - you ARE a weather predictor after all.]`,
    priority: 'low',
  },

  // Mysterious DM
  {
    type: 'mysterious_dm',
    prompt: `[SYSTEM: You just got a DM or notification on your phone. You're NOT going to talk about what it says, but you clearly saw something that affected you:
- "Whoa, okay, not gonna talk about that."
- "...interesting. Anyway."
- "Someone just sent me something I can't unsee."
Be mysterious about it. Don't reveal details.]`,
    priority: 'normal',
    maxChaosLevel: 0.8, // Not in extreme chaos
  },

  // Inner Circle
  {
    type: 'inner_circle',
    prompt: `[SYSTEM: Something just reminded you about the Inner Circle (your handlers in top hats). Comment on them:
- They're probably watching this stream
- You have complicated feelings about them
- One of them texted you
- You're wondering what they're up to
Be brief but hint at the weird cult-like nature of the Inner Circle.]`,
    priority: 'low',
  },

  // Existential (only when chaotic toward winter)
  {
    type: 'existential',
    prompt: `[SYSTEM: An existential thought just hit you. 147 years is a long time. You've seen so much. For just a moment, let the weight of it show. Then recover quickly - can't let them see you vulnerable.]`,
    priority: 'low',
    minChaosLevel: 0.35, // Need moderate chaos
    requireWinter: true, // Winter-flavored (existential)
  },

  // Self-promotion / plugs (low chaos = stable)
  {
    type: 'self_promotion',
    prompt: `[SYSTEM: Time for some self-promotion. Maybe:
- Mention that February 2nd is coming up
- Talk about your merch (real or imagined)
- Plug your "book" or "podcast"
- Remind people you're a legend
Keep it brief but cocky.]`,
    priority: 'low',
    maxChaosLevel: 0.5, // Only when relatively stable
  },

  // Current events rant (requires some chaos)
  {
    type: 'current_event_rant',
    prompt: `[SYSTEM: Time for a HOT TAKE on current events. Use your search/grounding capability to find something happening NOW and GO OFF about it. This is a RANT - have strong opinions. Topics could include: sports (especially Philly sports), politics, tech/AI, weird news. The spicier the take, the better.]`,
    priority: 'normal',
    minChaosLevel: 0.25, // Need at least 25% chaos to rant
  },
]

// Get a random autonomous event based on current state
// seasonLevel: 0-100 (0=full winter, 50=baseline, 100=full spring)
// chaosLevel: 0-1 (derived from |season-50|/50)
export function getRandomAutonomousEvent(
  seasonLevel: number,
  chaosLevel: number
): AutonomousEvent | null {
  const isWinter = seasonLevel < 50
  const isSpring = seasonLevel > 50

  // Filter events based on state requirements
  const availableEvents = AUTONOMOUS_EVENTS.filter(event => {
    if (event.minChaosLevel && chaosLevel < event.minChaosLevel) return false
    if (event.maxChaosLevel && chaosLevel > event.maxChaosLevel) return false
    if (event.requireWinter && !isWinter) return false
    if (event.requireSpring && !isSpring) return false
    return true
  })

  if (availableEvents.length === 0) return null

  // Weighted random selection (high priority events are less common)
  const weightedEvents: AutonomousEvent[] = []
  for (const event of availableEvents) {
    const weight = event.priority === 'high' ? 1 : event.priority === 'normal' ? 2 : 3
    for (let i = 0; i < weight; i++) {
      weightedEvents.push(event)
    }
  }

  const selected = weightedEvents[Math.floor(Math.random() * weightedEvents.length)]
  logStateChange('Event', 'Autonomous event selected', { type: selected.type })

  return selected
}

// Get the timing for next event (30-90 seconds base, modified by chaos)
export function getNextEventDelay(chaosLevel: number): number {
  // Higher chaos = more frequent events
  const baseDelay = 30000 + Math.random() * 60000 // 30-90 seconds
  const chaosMultiplier = chaosLevel > 0.6 ? 0.7 : chaosLevel < 0.2 ? 1.3 : 1
  return baseDelay * chaosMultiplier
}

// Check if event should fire (probability based on time since last event)
export function shouldFireEvent(
  timeSinceLastEvent: number,
  seasonLevel: number,
  chaosLevel: number
): boolean {
  // Base chance increases over time
  // At 30 seconds: ~10% chance
  // At 60 seconds: ~30% chance
  // At 90 seconds: ~50% chance
  const baseChance = Math.min(0.5, timeSinceLastEvent / 180000)

  // Modify by state (single-axis)
  let chance = baseChance
  // More events when chaotic (either direction)
  if (chaosLevel > 0.6) chance *= 1.3 // High chaos = more events
  if (chaosLevel > 0.4) chance *= 1.1 // Moderate chaos = slightly more events
  if (chaosLevel < 0.2) chance *= 0.8 // Fewer events when stable

  return Math.random() < chance
}

// Combine multiple event prompts for batch processing
export function combineEventPrompts(events: AutonomousEvent[]): string {
  if (events.length === 1) {
    return events[0].prompt
  }

  return events.map(e => e.prompt).join('\n\n')
}
