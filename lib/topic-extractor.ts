// Topic Extractor - Extract topics from messages for tracking and obsession mechanics

// Known topics Phil cares about (case-insensitive matching)
const KNOWN_TOPICS: Record<string, string[]> = {
  // Sports
  eagles: ['eagles', 'birds', 'philly', 'philadelphia eagles', 'nfl', 'jalen', 'hurts', 'sirianni'],
  football: ['football', 'super bowl', 'superbowl', 'nfl', 'touchdown', 'quarterback'],
  sports: ['sports', 'game', 'team', 'player', 'score'],

  // Weather & Predictions
  weather: ['weather', 'forecast', 'temperature', 'rain', 'snow', 'sunny', 'cloudy'],
  shadow: ['shadow', 'shadows', 'my shadow'],
  prediction: ['prediction', 'predict', 'accurate', 'accuracy', 'wrong', 'right', 'correct'],
  groundhog_day: ['groundhog day', 'february 2', 'feb 2', 'february 2nd', 'feb 2nd'],

  // Phil's World
  phyllis: ['phyllis', 'wife', 'married'],
  inner_circle: ['inner circle', 'handlers', 'top hat', 'top hats'],
  burrow: ['burrow', 'hole', 'home', 'house'],
  gobblers_knob: ['gobbler', 'knob', 'gobblers knob', 'punxsutawney'],
  groundhog_punch: ['punch', 'groundhog punch', 'drink', 'drinking', 'drunk', 'buzzed'],

  // Rivals
  staten_island_chuck: ['chuck', 'staten island', 'new york', 'nyc'],
  other_groundhogs: ['other groundhog', 'wiarton', 'willie', 'woodchuck'],

  // Meta Topics
  ai: ['ai', 'artificial', 'bot', 'robot', 'chatgpt', 'machine', 'computer'],
  fake: ['fake', 'real', 'simulation', 'simulated', 'scripted'],
  stream: ['stream', 'streaming', 'live', 'broadcast', 'viewers', 'chat'],

  // Pop Culture
  bill_murray: ['bill murray', 'murray', 'movie', 'groundhog day movie'],
  celebrities: ['celebrity', 'famous', 'star', 'hollywood'],

  // Common Triggers
  age: ['age', 'old', 'years', 'ancient', 'forever', '147', 'immortal'],
  death: ['die', 'dead', 'death', 'mortality', 'immortal', 'immortality'],
  food: ['food', 'eat', 'eating', 'hungry', 'carrot', 'carrots'],

  // Crypto/Money (for corruption)
  crypto: ['crypto', 'bitcoin', 'btc', 'ethereum', 'nft', 'blockchain', 'philcoin'],
  money: ['money', 'rich', 'wealth', 'cash', 'paid'],

  // Politics (Phil has opinions)
  politics: ['politics', 'president', 'election', 'government', 'congress'],

  // Relationships
  love: ['love', 'relationship', 'dating', 'single', 'crush'],
  hate: ['hate', 'enemy', 'enemies', 'hater', 'haters'],
}

// Meta keywords that trigger winter (chaos)
const META_KEYWORDS = ['ai', 'bot', 'fake', 'real', 'simulation', 'scripted', 'programmed', 'artificial']

// Boring/repetitive question patterns
const BORING_PATTERNS = [
  /what('s| is) your (favorite|fav)/i,
  /how old are you/i,
  /where (do|are) you/i,
  /can you/i,
  /do you like/i,
  /what do you think (of|about)/i,
]

export interface ExtractedTopics {
  topics: string[]
  isMeta: boolean // Contains AI/bot/fake references
  isBoring: boolean // Repetitive/basic question
  sentiment: 'positive' | 'negative' | 'neutral'
}

// Extract topics from a message
export function extractTopics(message: string): ExtractedTopics {
  const lowerMessage = message.toLowerCase()
  const foundTopics: Set<string> = new Set()

  // Check against known topics
  for (const [topic, keywords] of Object.entries(KNOWN_TOPICS)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        foundTopics.add(topic)
        break // Found this topic, move to next
      }
    }
  }

  // Check for meta keywords
  const isMeta = META_KEYWORDS.some(k => lowerMessage.includes(k))

  // Check for boring patterns
  const isBoring = BORING_PATTERNS.some(p => p.test(message))

  // Basic sentiment analysis
  const sentiment = analyzeSentiment(message)

  return {
    topics: Array.from(foundTopics),
    isMeta,
    isBoring,
    sentiment,
  }
}

// Basic sentiment analysis
function analyzeSentiment(message: string): 'positive' | 'negative' | 'neutral' {
  const lower = message.toLowerCase()

  const positiveWords = [
    'love', 'amazing', 'awesome', 'great', 'best', 'good', 'nice',
    'thanks', 'thank', 'appreciate', 'cool', 'funny', 'hilarious',
    'legend', 'legendary', 'goat', 'king', 'fan', 'support',
  ]

  const negativeWords = [
    'hate', 'suck', 'sucks', 'worst', 'bad', 'terrible', 'awful',
    'stupid', 'dumb', 'boring', 'fake', 'fraud', 'washed', 'trash',
    'cringe', 'ratio', 'mid', 'overrated',
  ]

  let positiveCount = 0
  let negativeCount = 0

  for (const word of positiveWords) {
    if (lower.includes(word)) positiveCount++
  }

  for (const word of negativeWords) {
    if (lower.includes(word)) negativeCount++
  }

  if (positiveCount > negativeCount) return 'positive'
  if (negativeCount > positiveCount) return 'negative'
  return 'neutral'
}

// Check if a message might contain a "fact" Phil could learn (corruption)
export function mightContainFact(message: string): string | null {
  // Patterns that look like fact statements
  const factPatterns = [
    /did you know (that )?(.+)/i,
    /i heard (that )?(.+)/i,
    /apparently (.+)/i,
    /fun fact:? (.+)/i,
    /the (.+) (is|are|was|were) (.+)/i,
    /(.+) (is|are) (actually|really) (.+)/i,
  ]

  for (const pattern of factPatterns) {
    const match = message.match(pattern)
    if (match) {
      // Extract the "fact" part
      const fact = match[match.length - 1] || match[2] || match[0]
      if (fact && fact.length > 10 && fact.length < 100) {
        return fact.trim()
      }
    }
  }

  return null
}

// Check if a message is challenging one of Phil's corrupted facts
export function isChallenging(message: string): boolean {
  const challengePatterns = [
    /that('s| is) (not true|false|wrong|incorrect|fake|bs|bullshit)/i,
    /actually,? (that('s| is) )?(not|wrong|false)/i,
    /no,? that('s| is)/i,
    /you('re| are) (wrong|incorrect|lying)/i,
    /that didn('t| did not) happen/i,
    /where did you hear that/i,
    /who told you that/i,
  ]

  return challengePatterns.some(p => p.test(message))
}

// Get topics that Phil might find interesting (for spring triggers)
export function isInterestingTopic(topic: string): boolean {
  const interestingTopics = [
    'eagles', 'football', 'shadow', 'groundhog_day', 'gobblers_knob',
    'inner_circle', 'groundhog_punch', 'bill_murray',
  ]
  return interestingTopics.includes(topic)
}

// Get topics that might bore Phil (for winter triggers)
export function isBoringTopic(topic: string): boolean {
  const boringTopics = ['food', 'love'] // Too many basic questions about these
  return boringTopics.includes(topic)
}
