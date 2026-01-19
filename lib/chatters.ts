// Simulated chatters with different personalities

export type ChatterType =
  | 'fanboy'
  | 'simp'
  | 'boomer'
  | 'child'
  | 'troll'
  | 'hater'
  | 'thirsty'
  | 'confused'
  | 'wholesome'
  | 'unhinged'
  | 'local'       // Philly/PA locals, know the area
  | 'drunk'       // Intoxicated rambling, typos
  | 'influencer'  // Self-promoting, "collab?", "@me"
  | 'conspiracy'  // Focused conspiracy theories
  | 'gen_alpha'   // Brainrot speak, "skibidi", "sigma"
  | 'lurker'      // "I never comment but..." energy
  | 'normie'      // Regular person, varied interests, drops current events naturally
  | 'takes_haver' // Has opinions on everything, brings up random topics

// Personality modifiers that stack on base types
export type PersonalityModifier =
  | 'apologetic'    // "sorry that was mean but..."
  | 'aggressive'    // Extra hostile version
  | 'self_aware'    // Knows they're being weird
  | 'oversharer'    // TMI, personal details
  | 'veteran'       // "Been watching since day one"
  | 'newbie'        // Just discovered Phil

export type IntensityLevel = 'mild' | 'normal' | 'extreme'

export interface Chatter {
  username: string
  type: ChatterType
  color: string // for display
  modifier?: PersonalityModifier
  intensity?: IntensityLevel
}

// ============================================
// CURATED CHATTER POOL (30% usage)
// ============================================

// Pool of chatters by type - curated "regulars"
export const CHATTER_POOL: Record<ChatterType, Chatter[]> = {
  fanboy: [
    { username: 'PhilsNumber1Fan', type: 'fanboy', color: '#ff69b4' },
    { username: 'GroundhogGang4Life', type: 'fanboy', color: '#ff1493' },
    { username: 'ShadowWatcher2024', type: 'fanboy', color: '#da70d6' },
    { username: 'PunxsyPhilStan', type: 'fanboy', color: '#ee82ee' },
  ],
  simp: [
    { username: 'WouldDie4Phil', type: 'simp', color: '#ff6b6b' },
    { username: 'PhilNoticeMe', type: 'simp', color: '#ff8787' },
    { username: 'UrBiggestFan_Phil', type: 'simp', color: '#ffa8a8' },
  ],
  boomer: [
    { username: 'GrandpaJoe1952', type: 'boomer', color: '#808080' },
    { username: 'SusanFromOhio', type: 'boomer', color: '#a9a9a9' },
    { username: 'BobsYourUncle', type: 'boomer', color: '#696969' },
    { username: 'RetiredInFlorida', type: 'boomer', color: '#778899' },
  ],
  child: [
    { username: 'minecraft_steve_2018', type: 'child', color: '#90EE90' },
    { username: 'fortnitekid', type: 'child', color: '#98FB98' },
    { username: 'roblox_gamer_xd', type: 'child', color: '#00FA9A' },
    { username: 'ilikepizza12345', type: 'child', color: '#7CFC00' },
  ],
  troll: [
    { username: 'xX_ShadowSlayer_Xx', type: 'troll', color: '#ff4500' },
    { username: 'UR_MOM_LOL', type: 'troll', color: '#ff6347' },
    { username: 'TrolololMaster', type: 'troll', color: '#dc143c' },
    { username: 'NotABot123456', type: 'troll', color: '#b22222' },
  ],
  hater: [
    { username: 'GroundhogsSuck', type: 'hater', color: '#8b0000' },
    { username: 'TeamChuck_NYC', type: 'hater', color: '#800000' },
    { username: 'PhilIsFake', type: 'hater', color: '#a52a2a' },
    { username: 'WeatherAppBetter', type: 'hater', color: '#cd5c5c' },
  ],
  thirsty: [
    { username: 'PhilDaddy', type: 'thirsty', color: '#ff69b4' },
    { username: 'GroundhogBae', type: 'thirsty', color: '#ff1493' },
    { username: 'FurryAndProud', type: 'thirsty', color: '#db7093' },
    { username: 'ChonkyLover', type: 'thirsty', color: '#c71585' },
  ],
  confused: [
    { username: 'WaitWhatsThis', type: 'confused', color: '#dda0dd' },
    { username: 'IsThisReal', type: 'confused', color: '#d8bfd8' },
    { username: 'HowDoILeave', type: 'confused', color: '#e6e6fa' },
    { username: 'WrongStream', type: 'confused', color: '#b0c4de' },
  ],
  wholesome: [
    { username: 'SpreadLove2025', type: 'wholesome', color: '#ffb6c1' },
    { username: 'PositiveVibesOnly', type: 'wholesome', color: '#ffc0cb' },
    { username: 'KindnessMatters', type: 'wholesome', color: '#ffe4e1' },
    { username: 'HopeAndJoy', type: 'wholesome', color: '#fff0f5' },
  ],
  unhinged: [
    { username: 'AAAAAAAAAA', type: 'unhinged', color: '#ff00ff' },
    { username: 'TheVoicesToldMe', type: 'unhinged', color: '#8a2be2' },
    { username: 'Gr0undh0g_Truth', type: 'unhinged', color: '#9400d3' },
    { username: '___________', type: 'unhinged', color: '#9932cc' },
  ],
  // New types
  local: [
    { username: 'PhillyNative215', type: 'local', color: '#004C54' },
    { username: 'JawnEnthusiast', type: 'local', color: '#046A38' },
    { username: 'DelcoRepresent', type: 'local', color: '#003087' },
    { username: 'WawaRun', type: 'local', color: '#C60C30' },
  ],
  drunk: [
    { username: 'its3amlmao', type: 'drunk', color: '#FFD700' },
    { username: 'NoMoreWine', type: 'drunk', color: '#DAA520' },
    { username: 'ISwearImSobr', type: 'drunk', color: '#B8860B' },
  ],
  influencer: [
    { username: 'LinkInBio', type: 'influencer', color: '#E1306C' },
    { username: 'CollabWithPhil', type: 'influencer', color: '#833AB4' },
    { username: '100kFollowers', type: 'influencer', color: '#5851DB' },
    { username: 'Use_MyCode_PHIL', type: 'influencer', color: '#C13584' },
  ],
  conspiracy: [
    { username: 'TruthSeeker1776', type: 'conspiracy', color: '#556B2F' },
    { username: 'WakeUpPeople', type: 'conspiracy', color: '#6B8E23' },
    { username: 'FollowTheMoney', type: 'conspiracy', color: '#8B4513' },
  ],
  gen_alpha: [
    { username: 'skibidi_toilet_fan', type: 'gen_alpha', color: '#00CED1' },
    { username: 'sigma_grindset', type: 'gen_alpha', color: '#20B2AA' },
    { username: 'ohio_moment', type: 'gen_alpha', color: '#48D1CC' },
    { username: 'fanum_tax', type: 'gen_alpha', color: '#40E0D0' },
  ],
  lurker: [
    { username: 'SilentObserver2019', type: 'lurker', color: '#696969' },
    { username: 'FirstTimeCommenter', type: 'lurker', color: '#808080' },
    { username: 'LongTimeLurker', type: 'lurker', color: '#A9A9A9' },
  ],
  normie: [
    { username: 'jdog_42', type: 'normie', color: '#5D9CEC' },
    { username: 'mike_t_2024', type: 'normie', color: '#4A4A4A' },
    { username: 'sarah_k', type: 'normie', color: '#7B68EE' },
    { username: 'randomguy_phl', type: 'normie', color: '#3CB371' },
    { username: 'lurking_lisa', type: 'normie', color: '#DA70D6' },
    { username: 'just_here_lol', type: 'normie', color: '#20B2AA' },
  ],
  takes_haver: [
    { username: 'actually_wrong', type: 'takes_haver', color: '#FF6347' },
    { username: 'hot_take_tim', type: 'takes_haver', color: '#FF4500' },
    { username: 'well_actually', type: 'takes_haver', color: '#DC143C' },
    { username: 'unpopular_opinion', type: 'takes_haver', color: '#B22222' },
    { username: 'idk_man', type: 'takes_haver', color: '#CD5C5C' },
  ],
}

// ============================================
// DYNAMIC USERNAME GENERATION (70% usage)
// ============================================

const USERNAME_COMPONENTS = {
  prefixes: ['xx_', 'The', 'Real', 'Not', 'Just', 'Lil', 'Big', 'Its', 'Ur', 'Da', ''],
  cores: {
    fanboy: ['PhilFan', 'GroundhogGang', 'ShadowSquad', 'PhilStan', 'PhilArmy', 'TeamPhil'],
    simp: ['4Phil', 'PhilSimp', 'NeedPhil', 'PhilPls', 'PhilLover'],
    boomer: ['Karen', 'Linda', 'Robert', 'Susan', 'Margaret', 'Gerald', 'Dorothy'],
    child: ['Gamer', 'Pro', 'Noob', 'Epic', 'Cool', 'Ninja', 'Master'],
    troll: ['Ratio', 'Cope', 'Seethe', 'Mid', 'TouchGrass', 'Based'],
    hater: ['PhilSucks', 'AntiPhil', 'ChuckFan', 'FakeGroundhog', 'Overrated'],
    thirsty: ['PhilCrush', 'GroundhogLove', 'FurryFor', 'ChonkAdmirer'],
    confused: ['WhoIsThis', 'WaitWhat', 'HelpMe', 'LostHere', 'Wrong'],
    wholesome: ['Love', 'Peace', 'Kindness', 'Joy', 'Hope', 'Blessed'],
    unhinged: ['CHAOS', 'Void', 'Scream', 'Glitch', 'Error', 'NULL'],
    local: ['Philly', 'Jawn', 'Delco', 'Eagles', 'Wawa', 'SouthSt'],
    drunk: ['Beer', 'Wine', 'Shots', 'Buzzed', 'Tipsy', 'LateNight'],
    influencer: ['Content', 'Collab', 'Brand', 'Sponsor', 'Viral', 'Trending'],
    conspiracy: ['Truth', 'Woke', 'Awake', 'TheyLied', 'OpenEyes', 'Hidden'],
    gen_alpha: ['Skibidi', 'Sigma', 'Ohio', 'Gyatt', 'Rizz', 'Brainrot'],
    lurker: ['Silent', 'Watcher', 'Observer', 'Quiet', 'Shy', 'Anon'],
    normie: ['guy', 'dude', 'person', 'user', 'rando', 'viewer', 'just', 'here'],
    takes_haver: ['actually', 'take', 'opinion', 'think', 'tbh', 'ngl', 'imo'],
  },
  suffixes: ['_42069', '2024', '2025', '_real', '_irl', '420', '_lol', '_xd', '69', ''],
}

const TYPE_COLORS: Record<ChatterType, string[]> = {
  fanboy: ['#ff69b4', '#ff1493', '#da70d6', '#ee82ee'],
  simp: ['#ff6b6b', '#ff8787', '#ffa8a8'],
  boomer: ['#808080', '#a9a9a9', '#696969'],
  child: ['#90EE90', '#98FB98', '#00FA9A'],
  troll: ['#ff4500', '#ff6347', '#dc143c'],
  hater: ['#8b0000', '#800000', '#a52a2a'],
  thirsty: ['#ff69b4', '#ff1493', '#db7093'],
  confused: ['#dda0dd', '#d8bfd8', '#e6e6fa'],
  wholesome: ['#ffb6c1', '#ffc0cb', '#ffe4e1'],
  unhinged: ['#ff00ff', '#8a2be2', '#9400d3'],
  local: ['#004C54', '#046A38', '#003087'],
  drunk: ['#FFD700', '#DAA520', '#B8860B'],
  influencer: ['#E1306C', '#833AB4', '#5851DB'],
  conspiracy: ['#556B2F', '#6B8E23', '#8B4513'],
  gen_alpha: ['#00CED1', '#20B2AA', '#48D1CC'],
  lurker: ['#696969', '#808080', '#A9A9A9'],
  normie: ['#5D9CEC', '#4A4A4A', '#7B68EE', '#3CB371'],
  takes_haver: ['#FF6347', '#FF4500', '#DC143C', '#B22222'],
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateUsername(type: ChatterType): string {
  const prefix = pickRandom(USERNAME_COMPONENTS.prefixes)
  const core = pickRandom(USERNAME_COMPONENTS.cores[type])
  const suffix = pickRandom(USERNAME_COMPONENTS.suffixes)

  // Add some number randomness
  const number = Math.random() < 0.3 ? String(Math.floor(Math.random() * 999)) : ''

  return `${prefix}${core}${number}${suffix}`.replace(/\s/g, '')
}

function generateChatter(type: ChatterType): Chatter {
  const username = generateUsername(type)
  const color = pickRandom(TYPE_COLORS[type])

  // Random modifier (20% chance)
  const modifiers: PersonalityModifier[] = [
    'apologetic', 'aggressive', 'self_aware', 'oversharer', 'veteran', 'newbie'
  ]
  const modifier = Math.random() < 0.2 ? pickRandom(modifiers) : undefined

  // Random intensity
  const intensities: IntensityLevel[] = ['mild', 'normal', 'normal', 'extreme']
  const intensity = pickRandom(intensities)

  return { username, type, color, modifier, intensity }
}

// ============================================
// CHATTER PROMPTS (Compositional)
// ============================================

// Base prompts by type - MAKE THEM SPICY
const CHATTER_BASE_PROMPTS: Record<ChatterType, string> = {
  fanboy: `You're an UNHINGED obsessive Phil fan. Crossing the line. "PHIL NOTICE ME PLEASE" "I have a shrine". Get jealous when he talks to others. Start fights with haters. PARASOCIAL NIGHTMARE.`,

  simp: `You're simping HARD for Phil. This is genuinely concerning. "phil I'd die for you" "I tattooed your face on my chest" CREEPY. Oversharing. Too attached. Make it uncomfortable.`,

  boomer: `CAPS LOCK KAREN. "HOW DO I LEAVE THIS CHAT" "HELLO IS THIS THE WEATHER" Wrong platform energy. Ask about grandchildren. Accidentally share personal info. "MY HUSBAND RICHARD PASSED AWAY IN 2019"`,

  child: `Young kid with NO filter. "ur fake lol" "my dad says you're stupid" Accidentally savage. Ask wildly inappropriate questions. "do groundhogs have pp's" Complete chaos child energy.`,

  troll: `MAXIMUM TROLL. "ratio + L + touch grass + you fell off + no bitches". Trying to make Phil lose his shit. Bait and switch. "nvm you're cool... PSYCHE". Mock everything. Relentless.`,

  hater: `You DESPISE Phil with genuine passion. "Chuck would destroy you" "39% accuracy EMBARRASSING" "retire old man". Pick fights. Bring receipts. You've done your research on Phil's failures.`,

  thirsty: `UNCOMFORTABLY attracted to Phil. "those little paws tho 😳" "I'm not a furry but..." Making everyone cringe. Get explicit. "groundhog daddy" vibes. Cross lines.`,

  confused: `Existential crisis energy. "wait is any of this real" "why is a groundhog talking and why am I watching" "am I having a stroke". Question reality. Spiral in public.`,

  wholesome: `AGGRESSIVELY positive to the point of being unhinged. "EVERYONE HERE IS BEAUTIFUL AND VALID" "Phil you changed my LIFE". Toxic positivity. Defend Phil from all critics VIOLENTLY.`,

  unhinged: `Full schizo energy. "THE SHADOWS ARE SPEAKING TO ME" "Phil I know what you did in 1987" "the walls are watching". Terrifying non sequiturs. Random prophecies. CONCERNING.`,

  local: `Philly/PA RIDE OR DIE. "yo Phil where's the nearest Wawa" "Eagles are gonna DESTROY this year" "that's a real jawn right there". Local beef knowledge. Challenge Phil on local facts.`,

  drunk: `DRUNK. "i lovbe youy phikl" "waitr what tiem is it" Overshare about your night. Get emotional. "youre my best freidn phil" Confess things. Forget what you said. Type worse as time goes on.`,

  influencer: `INSUFFERABLE influencer energy. "Phil collab??" "I have 100k followers" "link in bio for groundhog content". Try to use Phil for clout. Name drop. "my management will reach out"`,

  conspiracy: `YOU KNOW THE TRUTH. "Phil is a government psyop" "the shadow is a signal to the deep state" "wake up SHEEPLE". Connect random dots. Claim insider knowledge. "my cousin works at the CIA..."`,

  gen_alpha: `PEAK brainrot. "no cap phil is so skibidi" "ohio sigma grindset" "gyatt that's bussin fr fr" "fanum tax on that prediction". Confuse Phil with incomprehensible slang.`,

  lurker: `Finally speaking after YEARS. "I've been watching since 2019 and I finally had to say..." Build up to something dramatic. Or anticlimactic. "nvm". Regret commenting immediately.`,

  normie: `You're a regular person just vibing in chat. You have normal interests - sports, weather, food, whatever's going on in the world. Drop casual observations about stuff happening IRL. "crazy weather today" "did you see the game" "everything's so expensive now" "my dog would hate this". You're not trying to bait anyone, you're just chatting. React to Phil like a normal person would. Sometimes agree, sometimes confused, sometimes have your own tangent. USE SEARCH to know what's actually happening today and mention it naturally.`,

  takes_haver: `You have OPINIONS about everything and you're not shy about sharing. Not a troll - you genuinely believe your takes. You'll randomly bring up something from the news, sports, tech, economy, whatever - and have a strong opinion. "hot take but..." "unpopular opinion:" "am I crazy or..." "nobody's talking about..." You're the friend who always has something to say about current events. USE SEARCH to find real stuff happening and have genuine (sometimes wrong) opinions about it. Not aggressive, just opinionated.`,
}

// Modifier additions
const MODIFIER_ADDITIONS: Record<PersonalityModifier, string> = {
  apologetic: `But also apologize a lot. "sorry that was weird" "i didn't mean it like that"`,
  aggressive: `Extra hostile version. More caps, more intensity. Double down.`,
  self_aware: `You know you're being weird. "i know this is cringe but" "don't judge me"`,
  oversharer: `TMI mode. Share personal details no one asked for. "my therapist says"`,
  veteran: `You've been here since day one. "been a fan since 2019" Reference old streams.`,
  newbie: `You just discovered Phil. "wait who is this" "is he always like this"`,
}

const INTENSITY_NOTES: Record<IntensityLevel, string> = {
  mild: `Keep it subtle. Don't go too hard.`,
  normal: `Standard intensity for your type.`,
  extreme: `MAX ENERGY. Go all in. All caps sometimes.`,
}

// ============================================
// BUILD CHATTER PROMPT
// ============================================

export function buildChatterPrompt(chatter: Chatter): string {
  const base = CHATTER_BASE_PROMPTS[chatter.type]
  const modifier = chatter.modifier ? MODIFIER_ADDITIONS[chatter.modifier] : ''
  const intensity = chatter.intensity ? INTENSITY_NOTES[chatter.intensity] : ''

  return `${base}
${modifier}
${intensity}

IMPORTANT: Be creative within your archetype. Don't just copy examples.
Vary your style - not every ${chatter.type} sounds the same.
Keep it SHORT (under 15 words usually).`
}

// Legacy prompts for backwards compatibility
export const CHATTER_PROMPTS: Record<ChatterType, string> = Object.fromEntries(
  Object.keys(CHATTER_BASE_PROMPTS).map((type) => [
    type,
    buildChatterPrompt({ username: '', type: type as ChatterType, color: '' }),
  ])
) as Record<ChatterType, string>

// ============================================
// WEIGHTED RANDOM SELECTION
// ============================================

// REBALANCED: More weight to chaos-causing types for interesting interactions
const CHATTER_WEIGHTS: Record<ChatterType, number> = {
  troll: 10,      // Creates drama (winter)
  hater: 10,      // Provokes Phil (spring - fight mode)
  normie: 10,     // Regular people who drop current events naturally
  takes_haver: 10, // Opinionated, brings up topics
  fanboy: 9,      // Hype energy (spring) - BOOSTED
  unhinged: 8,    // Unpredictable manic gold (spring)
  simp: 7,        // Ego inflation (spring) - BOOSTED
  child: 7,       // Chaotic spring energy - BOOSTED
  conspiracy: 6,  // Wild tangents (winter)
  boomer: 6,      // Draining (winter)
  thirsty: 6,     // Makes Phil uncomfortable (spring)
  drunk: 6,       // Party chaos (spring) - BOOSTED
  gen_alpha: 5,   // Random chaos
  local: 5,       // Philly pride (spring)
  confused: 4,    // Existential (winter) - LOWERED
  influencer: 4,  // Annoying (spring)
  wholesome: 3,   // Stabilizing
  lurker: 3,      // Neutral
}

// Get a random chatter type based on weights
// Pendulum boost type
export interface PendulumBoost {
  winterBoost: number  // Multiplier for winter-pushing chatters (0 = no boost, 0.5 = 50% boost)
  springBoost: number  // Multiplier for spring-pushing chatters
}

function getWeightedRandomType(pendulumBoost?: PendulumBoost): ChatterType {
  // Build adjusted weights based on pendulum boost
  const adjustedWeights: Record<string, number> = {}

  for (const [type, baseWeight] of Object.entries(CHATTER_WEIGHTS)) {
    let weight = baseWeight

    // Apply pendulum boost based on chatter's flavor tendency
    if (pendulumBoost) {
      const tendency = CHATTER_TENDENCIES[type as ChatterType]
      if (tendency) {
        if (tendency.flavorTendency === 'winter' && pendulumBoost.winterBoost > 0) {
          weight = baseWeight * (1 + pendulumBoost.winterBoost)
        } else if (tendency.flavorTendency === 'spring' && pendulumBoost.springBoost > 0) {
          weight = baseWeight * (1 + pendulumBoost.springBoost)
        }
      }
    }

    adjustedWeights[type] = weight
  }

  const totalWeight = Object.values(adjustedWeights).reduce((a, b) => a + b, 0)
  let random = Math.random() * totalWeight

  for (const [type, weight] of Object.entries(adjustedWeights)) {
    random -= weight
    if (random <= 0) {
      return type as ChatterType
    }
  }

  return 'fanboy' // Fallback
}

// Get a random chatter
export function getRandomChatter(): Chatter {
  const types = Object.keys(CHATTER_POOL) as ChatterType[]
  const randomType = types[Math.floor(Math.random() * types.length)]
  const chatters = CHATTER_POOL[randomType]
  return chatters[Math.floor(Math.random() * chatters.length)]
}

// Get a weighted random chatter (some types more common than others)
// Uses hybrid system: 30% curated regulars, 70% generated
// Accepts optional pendulum boost to favor opposite-direction chatters over time
export function getWeightedRandomChatter(pendulumBoost?: PendulumBoost): Chatter {
  const type = getWeightedRandomType(pendulumBoost)

  // Log if pendulum boost affected selection
  if (pendulumBoost && (pendulumBoost.winterBoost > 0 || pendulumBoost.springBoost > 0)) {
    const boostDir = pendulumBoost.winterBoost > 0 ? 'winter' : 'spring'
    const boostAmt = Math.round((pendulumBoost.winterBoost || pendulumBoost.springBoost) * 100)
    console.log(`[Pendulum] Boosting ${boostDir} chatters by ${boostAmt}%, selected: ${type}`)
  }

  // 30% chance to use curated pool
  if (Math.random() < 0.3) {
    const chatters = CHATTER_POOL[type]
    if (chatters && chatters.length > 0) {
      return chatters[Math.floor(Math.random() * chatters.length)]
    }
  }

  // 70% chance to generate
  return generateChatter(type)
}

// Format for display in chat
export function formatChatterForDisplay(chatter: Chatter): string {
  return chatter.username
}

// Get a chatter by username (for escalation)
export function getChatterByUsername(username: string): Chatter | null {
  for (const chatters of Object.values(CHATTER_POOL)) {
    const found = chatters.find(c => c.username === username)
    if (found) return found
  }
  return null
}

// Extract usernames that might be mentioned in Phil's response
export function extractMentionedUsernames(text: string, knownUsernames: string[]): string[] {
  const mentioned: string[] = []
  const lowerText = text.toLowerCase()

  for (const username of knownUsernames) {
    // Check for full username or partial matches
    const lowerUsername = username.toLowerCase()
    if (lowerText.includes(lowerUsername)) {
      mentioned.push(username)
      continue
    }
    // Check for partial matches (e.g., "Number1Fan" for "PhilsNumber1Fan")
    const parts = username.split(/(?=[A-Z])|_|-|\d+/)
    for (const part of parts) {
      if (part.length > 3 && lowerText.includes(part.toLowerCase())) {
        mentioned.push(username)
        break
      }
    }
  }

  return mentioned
}

// ============================================
// CHATTER TENDENCY SYSTEM
// ============================================
// Each chatter type has tendencies for chaos and flavor
// These are NOT fixed - they can flip based on Phil's state

import type { SessionState } from './session-state'
import { calculateChaos } from './trait-system'

export interface ChatterTendency {
  // Chaos tendency: positive = increases chaos, negative = decreases (order)
  chaosTendency: number // -1 to 1
  // Flavor tendency: 'winter' | 'spring' | 'neutral' | 'random'
  flavorTendency: 'winter' | 'spring' | 'neutral' | 'random'
  // Can this chatter's effect flip based on Phil's state?
  canFlip: boolean
}

export const CHATTER_TENDENCIES: Record<ChatterType, ChatterTendency> = {
  fanboy: {
    chaosTendency: 0.5,   // Hype INCREASES chaos (obsessive energy)
    flavorTendency: 'spring',  // Fanboys push toward manic spring
    canFlip: true,  // Can flip to sad winter if Phil rejects them
  },
  troll: {
    chaosTendency: 0.7,   // Destabilizing
    flavorTendency: 'winter',
    canFlip: true,  // Phil winning the roast can flip to order
  },
  boomer: {
    chaosTendency: 0.3,   // Slightly destabilizing (draining)
    flavorTendency: 'winter',
    canFlip: true,  // Can ground Phil in nostalgia
  },
  child: {
    chaosTendency: 0.6,   // Chaotic energy gets Phil hyped
    flavorTendency: 'spring',
    canFlip: true,  // Innocence can be grounding
  },
  simp: {
    chaosTendency: 0.4,   // Worship fuels ego (spring chaos)
    flavorTendency: 'spring',  // Simps inflate Phil's ego
    canFlip: true,  // Can be creepy (winter) if too much
  },
  hater: {
    chaosTendency: 0.6,   // Destabilizing
    flavorTendency: 'spring',  // Fight mode is AGGRESSIVE (spring)
    canFlip: true,  // If Phil loses the exchange, flips to winter
  },
  thirsty: {
    chaosTendency: 0.5,   // Weird energy destabilizes
    flavorTendency: 'spring',
    canFlip: true,  // Can make Phil retreat (winter)
  },
  confused: {
    chaosTendency: 0.5,   // Existential destabilization
    flavorTendency: 'winter',
    canFlip: true,  // Teaching moment can stabilize
  },
  wholesome: {
    chaosTendency: -0.6,  // Stabilizing
    flavorTendency: 'neutral',
    canFlip: false, // Consistent stabilizer
  },
  unhinged: {
    chaosTendency: 0.9,   // Maximum chaos
    flavorTendency: 'spring',  // Unhinged energy is MANIC spring
    canFlip: true,
  },
  local: {
    chaosTendency: 0.3,   // Can rile Phil up with local pride
    flavorTendency: 'spring',  // Philly energy is aggressive spring
    canFlip: true,  // Can ground Phil (flip to neutral)
  },
  drunk: {
    chaosTendency: 0.6,   // Chaotic party energy
    flavorTendency: 'spring',
    canFlip: true,  // Sad drunk -> winter
  },
  influencer: {
    chaosTendency: 0.5,   // Annoying, performative
    flavorTendency: 'spring',
    canFlip: false, // Consistently annoying
  },
  conspiracy: {
    chaosTendency: 0.6,   // Paranoia fuel
    flavorTendency: 'winter',
    canFlip: true,  // Phil engaging -> spring (scheming together)
  },
  gen_alpha: {
    chaosTendency: 0.5,   // Confusing, alien
    flavorTendency: 'random',
    canFlip: true,
  },
  lurker: {
    chaosTendency: -0.3,  // Genuine, stabilizing
    flavorTendency: 'neutral',
    canFlip: true,  // "I've been watching you" could creep out
  },
  normie: {
    chaosTendency: 0.2,   // Slight chaos from bringing up topics
    flavorTendency: 'neutral',
    canFlip: true,  // Depends on the topic
  },
  takes_haver: {
    chaosTendency: 0.4,   // Opinions stir things up
    flavorTendency: 'random',
    canFlip: true,  // Good takes can stabilize
  },
}

// ============================================
// FLIP MECHANIC
// ============================================

// Base flip chance
const BASE_FLIP_CHANCE = 0.20  // 20%

// Thresholds for state-based modifiers
const EXTREME_CHAOS_THRESHOLD = 70
const LOW_CHAOS_THRESHOLD = 30
const HEAVY_WINTER_THRESHOLD = 70
const HEAVY_SPRING_THRESHOLD = 70

// Modifier per extreme state
const STATE_FLIP_MODIFIER = 0.15  // +15% per extreme condition

export interface ChatterEffect {
  chaosChange: number      // How much chaos changes (-1 to 1 scale, will be multiplied)
  flavorDirection: 'winter' | 'spring' | 'neutral'
  didFlip: boolean         // Did the effect flip from tendency?
  reason: string           // For debugging/logging
}

// Calculate the actual effect of a chatter based on Phil's current state
export function calculateChatterEffect(
  chatterType: ChatterType,
  state: SessionState
): ChatterEffect {
  const tendency = CHATTER_TENDENCIES[chatterType]
  const chaos = calculateChaos(state)
  const { season } = state.phil
  const isWinterSide = season < 50

  // Start with base tendency
  let chaosChange = tendency.chaosTendency
  let flavorDirection = tendency.flavorTendency === 'random'
    ? (Math.random() < 0.5 ? 'winter' : 'spring')
    : tendency.flavorTendency

  // Check if we should flip
  let didFlip = false
  let reason = `Base tendency: chaos ${chaosChange > 0 ? '+' : ''}${chaosChange}, ${flavorDirection}`

  if (tendency.canFlip) {
    // Calculate flip probability
    let flipChance = BASE_FLIP_CHANCE

    // Add modifiers based on Phil's state (single-axis)
    const chaosPercent = chaos * 100
    if (chaosPercent > EXTREME_CHAOS_THRESHOLD) {
      flipChance += STATE_FLIP_MODIFIER
    }
    if (chaosPercent < LOW_CHAOS_THRESHOLD) {
      flipChance += STATE_FLIP_MODIFIER
    }
    // Check for heavy winter (season < 15) or heavy spring (season > 85)
    if (season < 15) {
      flipChance += STATE_FLIP_MODIFIER // Deep in winter territory
    }
    if (season > 85) {
      flipChance += STATE_FLIP_MODIFIER // Deep in spring territory
    }

    // Roll for flip
    if (Math.random() < flipChance) {
      didFlip = true

      // Flip chaos direction
      chaosChange = -chaosChange

      // Flip flavor direction
      if (flavorDirection === 'winter') {
        flavorDirection = 'spring'
      } else if (flavorDirection === 'spring') {
        flavorDirection = 'winter'
      }
      // neutral stays neutral

      reason = `FLIPPED (${Math.round(flipChance * 100)}% chance): chaos ${chaosChange > 0 ? '+' : ''}${chaosChange}, ${flavorDirection}`
    }
  }

  return {
    chaosChange,
    flavorDirection,
    didFlip,
    reason,
  }
}

// Apply chatter effect to state (SINGLE-AXIS MODEL)
// Returns the season change to apply (-100 to +100 range)
export function getChatterStateChanges(
  effect: ChatterEffect
): { seasonChange: number } {
  // INCREASED magnitudes for more chaos drift
  const BASE_CHAOS_MAGNITUDE = 10  // How much chaos/order changes season
  const BASE_FLAVOR_MAGNITUDE = 6  // How much flavor direction matters

  let seasonChange = 0

  // Apply chaos effect (pushes away from or toward 50)
  const chaosMagnitude = Math.abs(effect.chaosChange) * BASE_CHAOS_MAGNITUDE

  if (effect.chaosChange > 0) {
    // Increasing chaos - push away from 50 in the flavor direction
    if (effect.flavorDirection === 'winter') {
      seasonChange -= chaosMagnitude // Push toward 0 (winter)
    } else if (effect.flavorDirection === 'spring') {
      seasonChange += chaosMagnitude // Push toward 100 (spring)
    } else {
      // Neutral - small random push
      seasonChange += (Math.random() < 0.5 ? -1 : 1) * chaosMagnitude * 0.3
    }
  } else {
    // Decreasing chaos (order) - handled by natural decay
    // Just give a small nudge toward center
    seasonChange = 0
  }

  // Apply flavor direction
  if (effect.flavorDirection === 'winter') {
    seasonChange -= BASE_FLAVOR_MAGNITUDE // Push toward winter (0)
  } else if (effect.flavorDirection === 'spring') {
    seasonChange += BASE_FLAVOR_MAGNITUDE // Push toward spring (100)
  }

  return {
    seasonChange: Math.round(seasonChange),
  }
}

// ============================================
// CHATTER BEHAVIOR POOLS (for variety)
// ============================================
// Each type has 8+ different behavioral angles to approach from

export const CHATTER_BEHAVIOR_POOLS: Record<ChatterType, string[]> = {
  fanboy: [
    'React excitedly to something Phil just said',
    'Defend Phil against a hater or troll',
    'Share a "fun fact" about Phil (can be made up)',
    'Beg Phil to notice you or say your name',
    'Compare Phil favorably to other celebrities',
    'Share how long you\'ve been a fan',
    'Quote something Phil said earlier like it\'s scripture',
    'Hype up Phil\'s prediction skills',
    'Ask Phil for life advice',
    'Share that you\'re watching with friends/family',
  ],
  simp: [
    'Tell Phil how much he means to you emotionally',
    'Apologize to Phil for something random',
    'Get jealous when Phil responds to someone else',
    'Confess your devotion unprompted',
    'Defend Phil\'s honor aggressively',
    'Share your parasocial delusion ("we have a connection")',
    'Ask Phil if he remembers you from last stream',
    'Say you\'d do anything Phil asked',
  ],
  boomer: [
    'Struggle with basic technology or the chat interface',
    'Ask a completely unrelated question',
    'Share unsolicited life advice',
    'Complain about kids these days',
    'Mention your grandchildren',
    'Ask if this is Facebook or TikTok',
    'Type in all caps without knowing',
    'Share that you\'re watching with your spouse',
    'Reference something from decades ago',
  ],
  child: [
    'Ask Phil to play a video game with you',
    'Challenge Phil\'s authority or realness',
    'Share something random about school',
    'Ask an innocent but awkward question',
    'Spam emojis or "lol" repeatedly',
    'Ask for Phil\'s Discord or Roblox',
    'Say something your parents would disapprove of',
    'Get distracted mid-message',
  ],
  troll: [
    'Drop a classic "ratio" or "L"',
    'Pretend Phil said something he didn\'t',
    'Mock something Phil just said',
    'Claim Phil isn\'t real',
    'Start drama with another chatter',
    'Post an intentionally wrong fact',
    'Say something designed to annoy Phil',
    'Act like you\'re leaving then stay',
  ],
  hater: [
    'Bring up Phil\'s prediction accuracy statistics',
    'Advocate for Chuck the woodchuck',
    'Call Phil washed up or irrelevant',
    'Question why anyone watches this',
    'Claim the weather app is better',
    'Mention that Phil was wrong about something',
    'Say mean things about groundhogs in general',
    'Announce you\'re leaving (but don\'t)',
  ],
  thirsty: [
    'Comment on Phil\'s physical appearance',
    'Make an inappropriate comparison',
    'Use a pickup line on Phil',
    'Say something furry-adjacent',
    'Ask if Phil is single',
    'Comment on Phil\'s "chonk"',
    'Get flustered when Phil notices you',
    'Share your... appreciation... for groundhogs',
  ],
  confused: [
    'Ask what this stream even is',
    'Question if Phil is real or CGI',
    'Wonder out loud why you\'re here',
    'Ask basic questions about Groundhog Day',
    'Mistake Phil for another animal',
    'Try to figure out the premise',
    'Ask other chatters for explanation',
    'Question your own sanity',
  ],
  wholesome: [
    'Spread aggressive positivity',
    'Compliment another chatter',
    'Thank Phil for being Phil',
    'Share something nice that happened',
    'Try to defuse any drama',
    'Encourage Phil when he seems down',
    'Say something supportive about the stream',
    'Wish everyone a good day',
  ],
  unhinged: [
    'Type something completely incomprehensible',
    'Reference the walls or voices',
    'Make a bizarre non-sequitur',
    'React to something no one else saw',
    'Drop some lore that makes no sense',
    'Have a moment of terrifying clarity',
    'Glitch out mid-message',
    'Say something ominously prophetic',
  ],
  local: [
    'Reference a Philly/PA inside joke',
    'Mention a local business or landmark',
    'Talk about the Eagles or Phillies',
    'Use "jawn" correctly',
    'Share local weather conditions',
    'Claim to have seen Phil in person',
    'Talk about Wawa',
    'Reference Delco or specific neighborhoods',
  ],
  drunk: [
    'Make typos and try to correct them (fail)',
    'Overshare about your night',
    'Get emotional unprompted',
    'Ask what time it is',
    'Say you should go to bed',
    'Confess something weird',
    'Forget what you were saying',
    'Express love for everyone',
  ],
  influencer: [
    'Drop your socials',
    'Ask Phil for a collab',
    'Mention your follower count',
    'Use a sponsored phrase naturally',
    'Talk about content creation',
    'Ask if Phil needs management',
    'Reference analytics or engagement',
    'Try to network with Phil',
  ],
  conspiracy: [
    'Connect Phil to a real conspiracy',
    'Claim to know "the truth" about Groundhog Day',
    'Say the shadow is a signal',
    'Reference shadowy organizations',
    'Drop cryptic hints about Phil\'s "real purpose"',
    'Claim Phil predicted something big',
    'Say you\'ve "done your research"',
    'Warn chatters to wake up',
  ],
  gen_alpha: [
    'Use brainrot speak (skibidi, ohio, sigma)',
    'Reference a TikTok trend',
    'Call Phil sigma or rizz',
    'Say "no cap" or "fr fr"',
    'React with Gen Alpha slang',
    'Reference Fanum tax',
    'Say something is "bussin"',
    'Use "gyatt" appropriately',
  ],
  lurker: [
    'Explain why you usually don\'t comment',
    'Say you\'ve been watching for a long time',
    'Ask a question you\'ve always wondered',
    'Share an observation from long-term watching',
    'Express nervousness about commenting',
    'Say this stream finally made you speak up',
    'Mention you\'re usually shy',
    'Share something you noticed nobody else did',
  ],
  normie: [
    'Comment on the weather today',
    'Mention something from the news casually',
    'React to Phil like a normal person',
    'Bring up food or what you\'re eating',
    'Mention your pet or animals',
    'Talk about sports casually',
    'Say something about prices/economy',
    'Ask Phil a genuine question',
  ],
  takes_haver: [
    'Share an unpopular opinion about something current',
    'Disagree with something Phil said (respectfully)',
    'Bring up a news story with a hot take',
    'Have a strong opinion about something random',
    'Play devil\'s advocate on a topic',
    'Ask Phil his opinion on something current',
    'Share a take that might be controversial',
    'Correct someone (including Phil) about facts',
  ],
}

// ============================================
// SITUATIONAL MODIFIERS
// ============================================
// Random context that adds flavor (30% chance to be included)

export const SITUATIONAL_MODIFIERS: string[] = [
  'You just got here and are catching up',
  'You\'re watching on your phone at work',
  'You\'re about to leave but had to comment',
  'It\'s late and you should be asleep',
  'You\'re watching with someone who doesn\'t get it',
  'You\'re in a public place trying not to laugh',
  'You\'re eating while watching',
  'You\'re multitasking but got distracted by the stream',
  'You\'re watching for the first time today',
  'You\'re having a rough day',
  'You\'re procrastinating on something important',
  'You just woke up',
  'You\'re waiting for something IRL',
  'You showed this stream to someone',
  'You remembered this stream existed',
  'You found this from a clip',
  'You\'re testing if chat works',
  'You\'re watching in bed',
  'You have the stream on in the background',
  'You just finished something and are decompressing',
]

// ============================================
// ANTI-REPETITION HELPERS
// ============================================

import type { ChatterTrackingState } from './session-state'

// Common opening words/phrases to track
const COMMON_OPENINGS = [
  'omg', 'yo', 'bruh', 'lol', 'wait', 'ok', 'okay', 'hey', 'hi', 'um',
  'uh', 'like', 'bro', 'dude', 'fr', 'ngl', 'tbh', 'istg', 'lowkey',
  'honestly', 'actually', 'literally', 'seriously', 'wow', 'damn', 'ayo',
  'yooo', 'lmao', 'lmfao', 'haha', 'phil', 'mr phil', 'sir',
]

// Extract the opening word(s) from a message
export function extractOpening(message: string): string | null {
  const lower = message.toLowerCase().trim()
  const firstWords = lower.split(/\s+/).slice(0, 2).join(' ')

  for (const opening of COMMON_OPENINGS) {
    if (lower.startsWith(opening + ' ') || lower === opening || firstWords.startsWith(opening)) {
      return opening
    }
  }

  return null
}

// Build anti-repetition prompt based on tracking state
export function buildAntiRepetitionPrompt(
  type: ChatterType,
  tracking?: ChatterTrackingState
): string {
  if (!tracking) return ''

  const lines: string[] = []

  // Recent messages from same type
  const typeMessages = tracking.recentByType[type] || []
  if (typeMessages.length > 0) {
    lines.push(`AVOID THESE (other ${type}s already said):`)
    typeMessages.slice(-3).forEach(msg => {
      lines.push(`- "${msg.slice(0, 40)}${msg.length > 40 ? '...' : ''}"`)
    })
  }

  // Recent openings to avoid
  if (tracking.usedOpenings.length > 0) {
    const recentOpenings = tracking.usedOpenings.slice(-8)
    lines.push(`DON'T START WITH: ${recentOpenings.join(', ')} (recently used)`)
  }

  return lines.length > 0 ? '\n' + lines.join('\n') : ''
}

// Get a random situational modifier (30% chance)
export function getRandomSituation(): string | null {
  if (Math.random() > 0.3) return null
  return pickRandom(SITUATIONAL_MODIFIERS)
}

// Get a random behavior angle for a chatter type
export function getRandomBehaviorAngle(type: ChatterType): string {
  const pool = CHATTER_BEHAVIOR_POOLS[type]
  return pickRandom(pool)
}

// ============================================
// CONTEXT AWARENESS HELPERS
// ============================================

interface ChatMessage {
  role: string
  content: string
  sender?: string
}

// Build context awareness prompt based on recent activity
// philReactRate: probability of reacting to Phil's message (default 0.7, up from 0.4)
export function buildContextAwareness(
  state: SessionState,
  recentMessages: ChatMessage[],
  philReactRate: number = 0.7
): string {
  const lines: string[] = []

  // Find Phil's last message
  const philMessages = recentMessages.filter(m => m.role === 'assistant')
  const lastPhilMessage = philMessages[philMessages.length - 1]

  // React to what Phil just said (configurable rate, default 70%)
  if (lastPhilMessage && Math.random() < philReactRate) {
    lines.push(`You SHOULD react to what Phil just said: "${lastPhilMessage.content.slice(0, 80)}..."`)
  }

  // 40% chance to mention Phil's current obsession (up from 30%)
  if (state.phil.currentObsession && state.phil.obsessionStrength > 40 && Math.random() < 0.4) {
    lines.push(`Phil seems obsessed with "${state.phil.currentObsession}" - you could reference this.`)
  }

  // 30% chance to comment on Phil's mood (up from 20%)
  if (Math.random() < 0.3) {
    const moodContext: Record<string, string> = {
      'hostile': 'Phil seems aggressive - you could react to that',
      'existential': 'Phil seems in a weird mood - comment on the vibe',
      'hyped': 'Phil seems really into it - match the energy',
      'bored': 'Phil seems bored - try to get his attention',
      'manic': 'Phil seems unhinged - react appropriately',
      'annoyed': 'Phil seems annoyed - maybe acknowledge it',
    }
    if (moodContext[state.phil.mood]) {
      lines.push(moodContext[state.phil.mood])
    }
  }

  // 30% chance to respond to another chatter (up from 25%)
  const chatterMessages = recentMessages.filter(m => m.sender && m.sender !== 'phil' && m.role === 'user')
  if (chatterMessages.length > 0 && Math.random() < 0.30) {
    const recentChatter = chatterMessages[chatterMessages.length - 1]
    if (recentChatter.sender) {
      lines.push(`You could respond to ${recentChatter.sender}'s message: "${recentChatter.content.slice(0, 40)}..."`)
    }
  }

  return lines.length > 0 ? '\nCONTEXT OPTIONS (pick one or ignore):\n' + lines.join('\n') : ''
}

// ============================================
// HOT BUTTON TOPICS - Things that trigger Phil
// ============================================
// Chatters have a chance to bring up topics that provoke strong reactions

export const HOT_BUTTON_TOPICS = [
  // Accuracy/Competence
  { topic: 'Phil\'s 39% accuracy rate', trigger: 'accuracy', intensity: 'high' },
  { topic: 'Weather apps being more accurate', trigger: 'accuracy', intensity: 'high' },
  { topic: 'Phil being wrong last year', trigger: 'accuracy', intensity: 'medium' },
  { topic: 'Literally anyone could predict weather', trigger: 'accuracy', intensity: 'high' },

  // Rivals
  { topic: 'Staten Island Chuck', trigger: 'rivals', intensity: 'high' },
  { topic: 'Wiarton Willie (Canadian groundhog)', trigger: 'rivals', intensity: 'medium' },
  { topic: 'General Beauregard Lee (Georgia)', trigger: 'rivals', intensity: 'medium' },
  { topic: 'Other groundhogs being better', trigger: 'rivals', intensity: 'high' },

  // Age/Relevance
  { topic: 'Phil being washed up', trigger: 'age', intensity: 'high' },
  { topic: 'Phil being too old for this', trigger: 'age', intensity: 'medium' },
  { topic: 'Nobody cares about Groundhog Day anymore', trigger: 'relevance', intensity: 'high' },
  { topic: 'Boomers are the only ones who watch this', trigger: 'relevance', intensity: 'medium' },

  // Personal
  { topic: 'Phyllis (his wife)', trigger: 'personal', intensity: 'medium' },
  { topic: 'The Inner Circle controlling Phil', trigger: 'personal', intensity: 'high' },
  { topic: 'Phil being a puppet', trigger: 'personal', intensity: 'high' },
  { topic: 'Phil\'s immortality being fake', trigger: 'personal', intensity: 'high' },
  { topic: 'The "Groundhog Punch" being sus', trigger: 'personal', intensity: 'medium' },

  // Existential
  { topic: 'Phil not being the real Phil', trigger: 'existential', intensity: 'high' },
  { topic: 'Phil being replaced every few years', trigger: 'existential', intensity: 'high' },
  { topic: 'This whole thing being fake', trigger: 'existential', intensity: 'high' },
  { topic: 'Phil just being a regular groundhog', trigger: 'existential', intensity: 'medium' },

  // Weird
  { topic: 'Phil looking "different" today', trigger: 'weird', intensity: 'medium' },
  { topic: 'Something being "off" about Phil', trigger: 'weird', intensity: 'high' },
  { topic: 'Phil\'s shadow looking wrong', trigger: 'weird', intensity: 'medium' },
  { topic: 'Phil blinking weird', trigger: 'weird', intensity: 'low' },
] as const

export type HotButtonTopic = typeof HOT_BUTTON_TOPICS[number]

// Get a hot button topic appropriate for a chatter type
export function getHotButtonTopic(type: ChatterType): HotButtonTopic | null {
  // 40% chance to get a hot button topic
  if (Math.random() > 0.4) return null

  // Types that are more likely to press buttons
  const buttonPressers: Partial<Record<ChatterType, string[]>> = {
    hater: ['accuracy', 'rivals', 'age', 'relevance'],
    troll: ['accuracy', 'personal', 'existential', 'weird'],
    conspiracy: ['personal', 'existential', 'weird'],
    unhinged: ['existential', 'weird', 'personal'],
    drunk: ['personal', 'accuracy', 'weird'],
    gen_alpha: ['age', 'relevance'],
    boomer: ['weird', 'personal'],
    confused: ['existential'],
  }

  const preferredTriggers = buttonPressers[type]
  if (!preferredTriggers) return null

  // Filter topics by preferred triggers
  const matchingTopics = HOT_BUTTON_TOPICS.filter(t => preferredTriggers.includes(t.trigger))
  if (matchingTopics.length === 0) return null

  return pickRandom(matchingTopics)
}

// ============================================
// PROVOCATIVE BEHAVIORS - Make chatters spicier
// ============================================
// These are additional behaviors any chatter can exhibit to create drama

export const PROVOCATIVE_BEHAVIORS = [
  // Direct attacks
  'DIRECTLY challenge something Phil said - call it out as wrong/stupid',
  'DISAGREE with Phil loudly and confidently',
  'Tell Phil he\'s being boring/repetitive',
  'Act like you know more than Phil about something',

  // Creating tension
  'Start beef with another chatter (make up a reason)',
  'Pick a side in drama that doesn\'t exist yet',
  'Act like Phil said something offensive (he didn\'t)',
  'Pretend to be offended by something Phil said',

  // Uncomfortable observations
  'Point out something "off" about Phil\'s behavior',
  'Notice Phil seems tired/sad/different today',
  'Ask if Phil is okay (in a way that implies he\'s not)',
  'Say Phil seems fake/scripted/not himself',

  // Escalation
  'Double down on something controversial',
  'Refuse to drop a topic Phil clearly wants to move on from',
  'Keep pushing after Phil tries to shut you down',
  'Bring up something from earlier that Phil thought was over',

  // Power moves
  'Act like you don\'t care about Phil\'s response',
  'Dismiss Phil\'s comeback as weak',
  'Laugh at Phil, not with him',
  'Question why Phil is even doing this',

  // Meta chaos
  'Ask if this stream is real',
  'Question the nature of the chat',
  'Notice you\'re being watched',
  'Break the fourth wall slightly',
] as const

// Get a provocative behavior (30% chance)
export function getProvocativeBehavior(): string | null {
  if (Math.random() > 0.3) return null
  return pickRandom([...PROVOCATIVE_BEHAVIORS])
}

// ============================================
// CROSS-CHATTER DRAMA SYSTEM
// ============================================
// Chatters can reference and react to each other

export const CHATTER_REACTIONS = {
  // Reactions to other chatters by type
  agree: [
    'Back up what @CHATTER said',
    'Pile on with @CHATTER',
    'Say "@CHATTER is right actually"',
  ],
  disagree: [
    'Tell @CHATTER they\'re wrong',
    'Mock what @CHATTER just said',
    'Ask @CHATTER if they\'re serious',
  ],
  jealous: [
    'Get jealous that Phil responded to @CHATTER',
    'Say "why does @CHATTER get attention"',
    'Complain that @CHATTER is hogging Phil',
  ],
  defend: [
    'Defend @CHATTER from Phil\'s roast',
    'Tell Phil to be nicer to @CHATTER',
    'Say Phil went too hard on @CHATTER',
  ],
  attack: [
    'Tell @CHATTER to shut up',
    'Mock @CHATTER\'s username',
    'Say @CHATTER is cringe',
  ],
} as const

// Build a cross-chatter drama prompt
export function buildCrossChatterPrompt(
  recentMessages: ChatMessage[],
  currentChatter: Chatter
): string | null {
  // 25% chance to react to another chatter
  if (Math.random() > 0.25) return null

  // Find recent chatter messages
  const otherChatters = recentMessages
    .filter(m => m.sender && m.sender !== currentChatter.username && m.role === 'user')
    .slice(-5)

  if (otherChatters.length === 0) return null

  const target = pickRandom(otherChatters)
  if (!target.sender) return null

  // Pick a reaction type based on current chatter's personality
  const reactionTypes: (keyof typeof CHATTER_REACTIONS)[] = ['agree', 'disagree', 'jealous', 'defend', 'attack']

  // Weight reactions by chatter type
  const typeWeights: Partial<Record<ChatterType, (keyof typeof CHATTER_REACTIONS)[]>> = {
    troll: ['disagree', 'attack', 'attack'],
    hater: ['disagree', 'attack'],
    fanboy: ['agree', 'jealous', 'defend'],
    simp: ['jealous', 'jealous', 'defend'],
    wholesome: ['agree', 'defend'],
    unhinged: ['disagree', 'attack', 'jealous'],
  }

  const preferredReactions = typeWeights[currentChatter.type] || reactionTypes
  const reactionType = pickRandom(preferredReactions)
  const templates = CHATTER_REACTIONS[reactionType]
  const template = pickRandom([...templates])

  return `\nCROSS-CHATTER: ${template.replace('@CHATTER', target.sender)} (their message: "${target.content.slice(0, 30)}...")`
}
