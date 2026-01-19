// Text utilities for cleaning up AI-generated content

/**
 * Strip Gemini search grounding citation markers from text
 * Matches patterns like [cite: 1], [cite:2], [1], [cite], etc.
 */
export function stripCitations(text: string): string {
  return text
    .replace(/\[cite:\s*\d*\]/gi, '')
    .replace(/\[cite\]/gi, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')  // Clean up any double spaces left behind
    .trim()
}
