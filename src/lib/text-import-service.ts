import { Format, MediaGrade, SleeveGrade } from '@/lib/types'

export interface ParsedImportItem {
  id: string
  artistName: string
  releaseTitle: string
  year: number
  format: Format
  country: string
  labelName?: string
  catalogNumber?: string
  mediaGrade: MediaGrade
  sleeveGrade: SleeveGrade
  notes?: string
  confidence: number
  rawText: string
  confirmed: boolean
}

const VALID_FORMATS: Format[] = ['LP', '7in', '12in', 'EP', 'Boxset']
const VALID_GRADES: MediaGrade[] = ['M', 'NM', 'EX', 'VG+', 'VG', 'G', 'F', 'P']

// Known country names/codes for conservative extraction from free-form text
const KNOWN_COUNTRIES = [
  'UK', 'US', 'USA', 'Germany', 'France', 'Italy', 'Japan', 'Canada',
  'Australia', 'Netherlands', 'Sweden', 'Denmark', 'Norway', 'Spain',
  'Portugal', 'Belgium', 'Switzerland', 'Austria', 'Poland', 'Czech',
  'Hungary', 'Brazil', 'Argentina', 'Mexico', 'India', 'South Africa',
  'New Zealand', 'Ireland', 'Finland',
]

function isValidFormat(f: string): f is Format {
  return VALID_FORMATS.includes(f as Format)
}

function isValidGrade(g: string): g is MediaGrade {
  return VALID_GRADES.includes(g as MediaGrade)
}

/** Sanitise an arbitrary value to a valid Format, defaulting to 'LP'. */
export function sanitizeFormat(f: unknown): Format {
  if (typeof f === 'string' && isValidFormat(f)) return f
  return 'LP'
}

/** Sanitise an arbitrary value to a valid MediaGrade, defaulting to 'VG+'. */
export function sanitizeGrade(g: unknown): MediaGrade {
  if (typeof g === 'string' && isValidGrade(g)) return g
  return 'VG+'
}

function generateId(): string {
  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Try to extract a known country from trailing extra text (e.g. "UK", "US").
 * Returns 'Unknown' if no recognised country is found, avoiding storing grade
 * strings, label names, or other junk as the country.
 */
function extractCountry(extra: string | undefined): string {
  if (!extra) return 'Unknown'
  const trimmed = extra.trim()
  for (const c of KNOWN_COUNTRIES) {
    if (trimmed.toUpperCase() === c.toUpperCase()) return c
  }
  return 'Unknown'
}

/** Simple regex fallback when no AI key is available */
export function parseWithRegex(rawText: string): ParsedImportItem[] {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  return lines.map((line) => {
    // Pattern with year: "Artist - Title (Year)" optionally followed by country
    const withYear = /^(.+?)\s*[-–—]\s*(.+?)\s*\((\d{4})\)(?:\s+(.+))?$/
    const matchYear = line.match(withYear)

    if (matchYear) {
      const [, artist, title, yearStr, extra] = matchYear
      return {
        id: generateId(),
        artistName: artist.trim(),
        releaseTitle: title.trim(),
        year: parseInt(yearStr, 10),
        format: 'LP' as Format,
        // Only store recognisable country names, not arbitrary trailing text
        country: extractCountry(extra),
        mediaGrade: 'VG+' as MediaGrade,
        sleeveGrade: 'VG+' as SleeveGrade,
        confidence: 0.4,
        rawText: line,
        confirmed: false,
      }
    }

    // Pattern without year: "Artist - Title" — use greedy match for title
    const noYear = /^(.+?)\s*[-–—]\s*(.+)$/
    const matchNoYear = line.match(noYear)

    if (matchNoYear) {
      const [, artist, title] = matchNoYear
      return {
        id: generateId(),
        artistName: artist.trim(),
        releaseTitle: title.trim(),
        year: 1970,
        format: 'LP' as Format,
        country: 'Unknown',
        mediaGrade: 'VG+' as MediaGrade,
        sleeveGrade: 'VG+' as SleeveGrade,
        confidence: 0.4,
        rawText: line,
        confirmed: false,
      }
    }
    // Fallback: treat whole line as title
    return {
      id: generateId(),
      artistName: 'Unknown Artist',
      releaseTitle: line,
      year: 1970,
      format: 'LP' as Format,
      country: 'Unknown',
      mediaGrade: 'VG+' as MediaGrade,
      sleeveGrade: 'VG+' as SleeveGrade,
      confidence: 0.2,
      rawText: line,
      confirmed: false,
    }
  })
}

/** Safely read a key from localStorage, guarding against SSR/non-browser envs. */
function safeGetLocalStorage(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key)
    }
  } catch {
    // Ignore – localStorage not available
  }
  return null
}

/** Map raw AI JSON item to a validated ParsedImportItem. */
function mapAIItem(item: Record<string, unknown>): ParsedImportItem {
  return {
    id: generateId(),
    artistName: typeof item.artistName === 'string' && item.artistName ? item.artistName : 'Unknown Artist',
    releaseTitle: typeof item.releaseTitle === 'string' && item.releaseTitle ? item.releaseTitle : 'Unknown Title',
    year: typeof item.year === 'number' && item.year > 0 ? item.year : 1970,
    format: sanitizeFormat(item.format),
    country: typeof item.country === 'string' && item.country ? item.country : 'Unknown',
    labelName: typeof item.labelName === 'string' && item.labelName ? item.labelName : undefined,
    catalogNumber: typeof item.catalogNumber === 'string' && item.catalogNumber ? item.catalogNumber : undefined,
    mediaGrade: sanitizeGrade(item.mediaGrade),
    sleeveGrade: sanitizeGrade(item.sleeveGrade) as SleeveGrade,
    notes: typeof item.notes === 'string' && item.notes ? item.notes : undefined,
    confidence: typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0.7,
    rawText: typeof item.rawText === 'string' && item.rawText ? item.rawText : '',
    confirmed: false,
  }
}

const SYSTEM_PROMPT =
  'You are a vinyl record cataloging assistant. Parse the provided text into a list of vinyl records. ' +
  'Each record entry in the text may be on one or multiple lines. Extract structured information for each record.'

function buildUserPrompt(rawText: string): string {
  return `Parse the following text and return a JSON array of vinyl record objects.
Each object must have these fields:
- artistName (string)
- releaseTitle (string)
- year (number, default 1970 if unknown)
- format (one of: 'LP', '7in', '12in', 'EP', 'Boxset', default 'LP')
- country (string, default 'Unknown')
- labelName (string or null)
- catalogNumber (string or null)
- mediaGrade (one of: 'M', 'NM', 'EX', 'VG+', 'VG', 'G', 'F', 'P', default 'VG+')
- sleeveGrade (one of: 'M', 'NM', 'EX', 'VG+', 'VG', 'G', 'F', 'P', default 'VG+')
- notes (string or null)
- confidence (number 0-1, how confident you are in the parse)
- rawText (the original source text for this entry)

Return ONLY the JSON array, no markdown, no explanation.

Text to parse:
${rawText}`
}

function parseAIResponse(content: string, rawText: string): ParsedImportItem[] {
  try {
    const jsonStr = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed)) return parseWithRegex(rawText)
    return parsed.map((item: Record<string, unknown>) => mapAIItem(item))
  } catch {
    return parseWithRegex(rawText)
  }
}

/** Parse free-form text into ParsedImportItems using spark.llm (or regex fallback).
 * @param rawText  - The free-form text to parse
 * @param openAIKey - Kept for API compatibility; the key is no longer sent from the client.
 *                    spark.llm is used when available; the key is only used as a last-resort
 *                    fallback when the spark runtime is absent (e.g. local dev without proxy).
 */
export async function parseTextToImportItems(rawText: string, openAIKey?: string): Promise<ParsedImportItem[]> {
  // Check if spark.llm is available (it is in production, not in test environments).
  const sparkGlobal: { llm?: unknown; llmPrompt?: unknown } | undefined =
    typeof spark !== 'undefined' ? spark : (globalThis as Record<string, unknown>).spark as typeof sparkGlobal
  if (sparkGlobal?.llm && sparkGlobal?.llmPrompt) {
    try {
      const userPrompt = buildUserPrompt(rawText)
      const prompt = sparkGlobal.llmPrompt`${SYSTEM_PROMPT}\n\n${userPrompt}`
      const content: string = await sparkGlobal.llm(prompt, 'gpt-4o-mini', true)
      return parseAIResponse(content, rawText)
    } catch (err) {
      console.warn('spark.llm parse failed, falling back to regex', err)
      return parseWithRegex(rawText)
    }
  }

  // Fallback: check for a locally-stored API key (only used when spark runtime is unavailable)
  const apiKey = openAIKey || safeGetLocalStorage('openai_api_key')
  if (!apiKey) {
    return parseWithRegex(rawText)
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(rawText) },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
    })

    if (!response.ok) {
      console.warn('OpenAI API error, falling back to regex parser', response.status)
      return parseWithRegex(rawText)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content ?? ''
    return parseAIResponse(content, rawText)
  } catch (err) {
    console.warn('Failed to parse AI response, falling back to regex', err)
    return parseWithRegex(rawText)
  }
}
