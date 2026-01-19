// Rant Detector - Analyzes Phil's messages to detect rants
// Used to trigger reactive chatter responses

export interface RantAnalysis {
  isRant: boolean
  topics: string[]
  mentionedUsers: string[]
  keyQuote: string // For chatters to reference
  intensity: 'mild' | 'moderate' | 'heated' | 'nuclear'
  sentiment: 'angry' | 'defensive' | 'manic' | 'philosophical' | 'roast'
}

// Keywords that indicate specific rant topics
const TOPIC_KEYWORDS: Record<string, string[]> = {
  accuracy: ['accuracy', 'percent', '%', 'wrong', 'prediction', 'predicted', 'weather app', 'meteorologist'],
  rivals: ['chuck', 'staten island', 'willie', 'wiarton', 'beauregard', 'other groundhog', 'impostor'],
  age: ['old', 'ancient', '147', 'years', 'immortal', 'washed', 'boomer', 'retire'],
  shadow: ['shadow', 'sun', 'light', 'see my shadow', 'no shadow'],
  innerCircle: ['inner circle', 'handlers', 'top hat', 'translators', 'groundhogese'],
  phyllis: ['phyllis', 'wife', 'married', 'burrow'],
  existential: ['real', 'fake', 'exist', 'consciousness', 'alive', 'sentient', 'ai', 'simulation'],
  philly: ['philly', 'philadelphia', 'eagles', 'sixers', 'phillies', 'wawa', 'jawn', 'delco'],
  haters: ['hater', 'troll', 'ratio', 'touch grass', 'touch snow'],
}

// Indicators of rant intensity
const INTENSITY_INDICATORS = {
  nuclear: ['!!!', 'LISTEN', 'LET ME TELL YOU', 'I\'M SICK', 'ENOUGH', 'DONE WITH'],
  heated: ['?!', 'seriously', 'honestly', 'look', 'okay listen', 'you know what'],
  moderate: ['actually', 'just saying', 'for real', 'literally'],
  mild: [],
}

// Sentiment patterns
const SENTIMENT_PATTERNS: Record<string, RegExp[]> = {
  angry: [/\b(sick of|tired of|done with|hate|despise|annoy|infuriate)\b/i, /!{2,}/],
  defensive: [/\b(actually|well|excuse me|i'll have you know|for your information)\b/i],
  manic: [/\b(you know what|let me tell you|oh boy|here we go|buckle up)\b/i, /\.{3,}/],
  philosophical: [/\b(existence|meaning|purpose|truth|reality|consciousness)\b/i],
  roast: [/\b(weak|pathetic|embarrassing|sad|cringe|ratio|L take)\b/i],
}

// Extract a key quote from the message (most intense/interesting part)
function extractKeyQuote(text: string): string {
  // Look for sentences with emphasis (caps, exclamations, questions)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)

  // Prioritize sentences with caps or exclamations
  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (trimmed.includes('!') || /[A-Z]{3,}/.test(trimmed)) {
      return trimmed.slice(0, 80) + (trimmed.length > 80 ? '...' : '')
    }
  }

  // Otherwise take the longest/most substantive sentence
  const substantive = sentences
    .map(s => s.trim())
    .filter(s => s.split(' ').length > 3)
    .sort((a, b) => b.length - a.length)[0]

  if (substantive) {
    return substantive.slice(0, 80) + (substantive.length > 80 ? '...' : '')
  }

  // Fallback to first sentence
  return sentences[0]?.slice(0, 80) || text.slice(0, 80)
}

// Extract mentioned usernames from text
function extractMentions(text: string, knownUsernames: string[] = []): string[] {
  const mentioned: string[] = []
  const lowerText = text.toLowerCase()

  // Check for known usernames
  for (const username of knownUsernames) {
    if (lowerText.includes(username.toLowerCase())) {
      mentioned.push(username)
    }
  }

  // Look for @mentions pattern
  const atMentions = text.match(/@[\w]+/g)
  if (atMentions) {
    mentioned.push(...atMentions.map(m => m.slice(1)))
  }

  return Array.from(new Set(mentioned))
}

// Detect topics being discussed
function detectTopics(text: string): string[] {
  const topics: string[] = []
  const lowerText = text.toLowerCase()

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        topics.push(topic)
        break
      }
    }
  }

  return topics
}

// Determine rant intensity
function determineIntensity(text: string): RantAnalysis['intensity'] {
  const upperText = text.toUpperCase()

  // Check for nuclear indicators
  for (const indicator of INTENSITY_INDICATORS.nuclear) {
    if (upperText.includes(indicator)) {
      return 'nuclear'
    }
  }

  // Check for heated indicators
  for (const indicator of INTENSITY_INDICATORS.heated) {
    if (text.toLowerCase().includes(indicator.toLowerCase())) {
      return 'heated'
    }
  }

  // Check for caps ratio (more caps = more intense)
  const capsRatio = (text.match(/[A-Z]/g)?.length || 0) / text.length
  if (capsRatio > 0.3) {
    return 'heated'
  }

  // Check for moderate indicators
  for (const indicator of INTENSITY_INDICATORS.moderate) {
    if (text.toLowerCase().includes(indicator.toLowerCase())) {
      return 'moderate'
    }
  }

  return 'mild'
}

// Determine sentiment
function determineSentiment(text: string): RantAnalysis['sentiment'] {
  for (const [sentiment, patterns] of Object.entries(SENTIMENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return sentiment as RantAnalysis['sentiment']
      }
    }
  }

  // Default based on punctuation
  if (text.includes('?')) {
    return 'defensive'
  }
  if (text.includes('!')) {
    return 'angry'
  }

  return 'roast' // Default Phil mode
}

// Main analysis function
export function analyzePhilMessage(
  text: string,
  knownUsernames: string[] = []
): RantAnalysis {
  // Count sentences (rough indicator of length)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const wordCount = text.split(/\s+/).length

  // Rant criteria:
  // 1. More than 2 sentences OR
  // 2. More than 25 words OR
  // 3. Contains strong indicators
  const hasMultipleSentences = sentences.length >= 2
  const isLong = wordCount >= 25
  const hasIntensity = determineIntensity(text) !== 'mild'
  const topics = detectTopics(text)
  const hasTopics = topics.length > 0

  const isRant = (hasMultipleSentences || isLong) && (hasIntensity || hasTopics)

  return {
    isRant,
    topics,
    mentionedUsers: extractMentions(text, knownUsernames),
    keyQuote: extractKeyQuote(text),
    intensity: determineIntensity(text),
    sentiment: determineSentiment(text),
  }
}

// Build a rant context string for chatter prompts
export function buildRantContext(analysis: RantAnalysis): string {
  if (!analysis.isRant) {
    return ''
  }

  const lines: string[] = []

  lines.push(`🔥 PHIL JUST RANTED (${analysis.intensity}, ${analysis.sentiment}):`)
  lines.push(`"${analysis.keyQuote}"`)

  if (analysis.topics.length > 0) {
    lines.push(`Topics: ${analysis.topics.join(', ')}`)
  }

  if (analysis.mentionedUsers.length > 0) {
    lines.push(`Called out: ${analysis.mentionedUsers.join(', ')}`)
  }

  lines.push('You MUST react to this - agree, disagree, pile on, or call him out!')

  return lines.join('\n')
}

// Reaction suggestions based on rant analysis
export interface RantReactionSuggestion {
  action: string
  forTypes: string[] // Chatter types this is good for
}

export function getRantReactionSuggestions(analysis: RantAnalysis): RantReactionSuggestion[] {
  const suggestions: RantReactionSuggestion[] = []

  // Base reactions
  suggestions.push({
    action: 'Agree aggressively with Phil\'s rant',
    forTypes: ['fanboy', 'simp', 'wholesome'],
  })

  suggestions.push({
    action: 'Disagree and challenge Phil\'s point',
    forTypes: ['troll', 'hater', 'conspiracy'],
  })

  suggestions.push({
    action: 'Quote Phil back at him mockingly',
    forTypes: ['troll', 'hater'],
  })

  // Topic-specific reactions
  if (analysis.topics.includes('accuracy')) {
    suggestions.push({
      action: 'Bring up specific accuracy statistics',
      forTypes: ['hater', 'troll'],
    })
    suggestions.push({
      action: 'Defend Phil\'s track record',
      forTypes: ['fanboy', 'local'],
    })
  }

  if (analysis.topics.includes('rivals')) {
    suggestions.push({
      action: 'Take Chuck\'s side to provoke Phil',
      forTypes: ['hater', 'troll'],
    })
    suggestions.push({
      action: 'Trash talk the rival groundhog',
      forTypes: ['fanboy', 'local'],
    })
  }

  if (analysis.topics.includes('existential')) {
    suggestions.push({
      action: 'Get philosophical about Phil\'s existence',
      forTypes: ['confused', 'unhinged', 'conspiracy'],
    })
  }

  // Intensity-based reactions
  if (analysis.intensity === 'nuclear') {
    suggestions.push({
      action: 'Tell Phil to calm down',
      forTypes: ['boomer', 'wholesome'],
    })
    suggestions.push({
      action: 'Hype up Phil\'s anger',
      forTypes: ['fanboy', 'unhinged'],
    })
  }

  // Sentiment-based reactions
  if (analysis.sentiment === 'angry') {
    suggestions.push({
      action: 'Ask Phil who hurt him',
      forTypes: ['troll', 'gen_alpha'],
    })
  }

  if (analysis.sentiment === 'roast') {
    suggestions.push({
      action: 'Claim Phil roasted you personally',
      forTypes: ['simp', 'fanboy'],
    })
    suggestions.push({
      action: 'Say the roast was weak',
      forTypes: ['troll', 'hater'],
    })
  }

  return suggestions
}
