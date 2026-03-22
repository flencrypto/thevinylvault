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

function isValidFormat(f: string): f is Format {
  return VALID_FORMATS.includes(f as Format)
}

function isValidGrade(g: string): g is MediaGrade {
  return VALID_GRADES.includes(g as MediaGrade)
}

function sanitizeFormat(f: unknown): Format {
  if (typeof f === 'string' && isValidFormat(f)) return f
  return 'LP'
}

function sanitizeGrade(g: unknown): MediaGrade {
  if (typeof g === 'string' && isValidGrade(g)) return g
  return 'VG+'
}

function generateId(): string {
  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Simple regex fallback when no OpenAI key is available */
function parseWithRegex(rawText: string): ParsedImportItem[] {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  return lines.map((line) => {
    // Try "Artist - Title (Year)" or "Artist - Title" patterns
    const dashPattern = /^(.+?)\s*[-–—]\s*(.+?)(?:\s*\((\d{4})\))?(?:\s+(.+))?$/
    const match = line.match(dashPattern)

    if (match) {
      const [, artist, title, yearStr, extra] = match
      const year = yearStr ? parseInt(yearStr, 10) : 1970
      // Try to find country from extra info
      const country = extra ? extra.trim() : 'Unknown'
      return {
        id: generateId(),
        artistName: artist.trim(),
        releaseTitle: title.trim(),
        year,
        format: 'LP' as Format,
        country,
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

/** Parse free-form text into ParsedImportItems using OpenAI (or regex fallback) */
export async function parseTextToImportItems(rawText: string): Promise<ParsedImportItem[]> {
  const apiKey = localStorage.getItem('openai_api_key')

  if (!apiKey) {
    return parseWithRegex(rawText)
  }

  const systemPrompt =
    'You are a vinyl record cataloging assistant. Parse the provided text into a list of vinyl records. ' +
    'Each record entry in the text may be on one or multiple lines. Extract structured information for each record.'

  const userPrompt = `Parse the following text and return a JSON array of vinyl record objects. 
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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
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

    // Strip possible markdown fences
    const jsonStr = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed = JSON.parse(jsonStr)

    if (!Array.isArray(parsed)) {
      return parseWithRegex(rawText)
    }

    return parsed.map(
      (item: Record<string, unknown>): ParsedImportItem => ({
        id: generateId(),
        artistName: typeof item.artistName === 'string' && item.artistName ? item.artistName : 'Unknown Artist',
        releaseTitle: typeof item.releaseTitle === 'string' && item.releaseTitle ? item.releaseTitle : 'Unknown Title',
        year: typeof item.year === 'number' && item.year > 0 ? item.year : 1970,
        format: sanitizeFormat(item.format),
        country: typeof item.country === 'string' && item.country ? item.country : 'Unknown',
        labelName: typeof item.labelName === 'string' && item.labelName ? item.labelName : undefined,
        catalogNumber:
          typeof item.catalogNumber === 'string' && item.catalogNumber ? item.catalogNumber : undefined,
        mediaGrade: sanitizeGrade(item.mediaGrade),
        sleeveGrade: sanitizeGrade(item.sleeveGrade) as SleeveGrade,
        notes: typeof item.notes === 'string' && item.notes ? item.notes : undefined,
        confidence: typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0.7,
        rawText: typeof item.rawText === 'string' && item.rawText ? item.rawText : '',
        confirmed: false,
      }),
    )
  } catch (err) {
    console.warn('Failed to parse OpenAI response, falling back to regex', err)
    return parseWithRegex(rawText)
  }
}
