import { PressingCandidate, ImageAnalysisResult, Format } from './types'
import { discogsCache } from './discogs-cache-service'

export interface PressingIdentificationInput {
  imageAnalysis?: ImageAnalysisResult[]
  ocrRunoutValues?: string[]
  manualHints?: {
    artist?: string
    title?: string
    catalogNumber?: string
    country?: string
    year?: number
    format?: Format
    labelName?: string
  }
  discogsSearchEnabled?: boolean
  discogsApiToken?: string
}

export interface IdentifierMatch {
  type: 'catalog_number' | 'barcode' | 'matrix' | 'label' | 'country' | 'format' | 'year'
  value: string
  source: 'image_ocr' | 'manual_hint' | 'discogs_match'
  confidence: number
}

export interface ScoredPressingCandidate extends PressingCandidate {
  totalScore: number
  evidenceSnippets: string[]
  matches: IdentifierMatch[]
  confidenceBand: 'high' | 'medium' | 'low' | 'ambiguous'
}

export function normalizeIdentifier(value: string): string {
  if (!value) return ''
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

export function calculateConfidenceBand(score: number): 'high' | 'medium' | 'low' | 'ambiguous' {
  if (score >= 0.80) return 'high'
  if (score >= 0.60) return 'medium'
  if (score >= 0.40) return 'low'
  return 'ambiguous'
}

export function extractMatrixPatterns(text: string): string[] {
  const patterns = [
    // Simple side/stamper identifiers: A1, B2, A12
    /\b[A-Z]\d{1,2}\b/gi,
    // Label-number-letter runouts: XEX-504-3N, CBS 1234-A
    /\b[A-Z]{2,4}[-\s]?\d{3,5}[-\s]?[A-Z]\b/gi,
    // Extended runout with pressing digit: XEX 504-3N style
    /\b[A-Z]{2,4}[-\s]?\d{3,5}[-\s]?\d[A-Z]\b/gi,
    // Numeric-prefix runouts: 12345-AB-1
    /\b\d{5,6}[-\s]?[A-Z]{1,2}[-\s]?\d\b/gi,
    // Catalogue-style identifiers with optional separator: SHVL 804, SHVL804
    /\b[A-Z]{3,5}[-\s]?\d{3,5}\b/gi,
  ]
  
  const matches = new Set<string>()
  
  for (const pattern of patterns) {
    const found = text.match(pattern)
    if (found) {
      found.forEach(m => matches.add(m.trim().toUpperCase()))
    }
  }
  
  return Array.from(matches)
}

export function similarityScore(a: string, b: string): number {
  const normA = normalizeIdentifier(a)
  const normB = normalizeIdentifier(b)
  
  if (normA === normB) return 1.0
  
  if (normA.includes(normB) || normB.includes(normA)) {
    const shorter = Math.min(normA.length, normB.length)
    const longer = Math.max(normA.length, normB.length)
    return shorter / longer
  }
  
  let matches = 0
  const minLen = Math.min(normA.length, normB.length)
  
  for (let i = 0; i < minLen; i++) {
    if (normA[i] === normB[i]) matches++
  }
  
  return matches / Math.max(normA.length, normB.length)
}

function deduplicateCandidates(candidates: ScoredPressingCandidate[]): ScoredPressingCandidate[] {
  const seen = new Map<string, ScoredPressingCandidate>()
  
  for (const candidate of candidates) {
    const key = `${candidate.discogsId || ''}|${normalizeIdentifier(candidate.catalogNumber || '')}|${normalizeIdentifier(candidate.artistName)}|${normalizeIdentifier(candidate.releaseTitle)}`
    
    const existing = seen.get(key)
    
    if (!existing || candidate.confidence > existing.confidence) {
      seen.set(key, candidate)
    }
  }
  
  return Array.from(seen.values()).sort((a, b) => b.confidence - a.confidence)
}

export async function identifyPressing(
  input: PressingIdentificationInput
): Promise<ScoredPressingCandidate[]> {
  
  const allExtractedText = input.imageAnalysis?.flatMap(r => r.extractedText) || []
  const allLabels = input.imageAnalysis?.flatMap(r => r.identifiedLabels) || []
  
  const rawMatrixNumbers = [
    ...(input.imageAnalysis?.flatMap(r => r.matrixNumbers) || []),
    ...(input.ocrRunoutValues || [])
  ]
  
  const patternExtractedMatrix = allExtractedText.flatMap(text => extractMatrixPatterns(text))
  
  const allMatrixNumbers = Array.from(new Set([...rawMatrixNumbers, ...patternExtractedMatrix]))
  
  const allCatalogNumbers = input.imageAnalysis?.flatMap(r => r.catalogNumbers) || []
  const allBarcodes = input.imageAnalysis?.flatMap(r => r.barcodes) || []
  
  const avgImageConfidence = input.imageAnalysis && input.imageAnalysis.length > 0
    ? input.imageAnalysis.reduce((sum, r) => sum + r.confidence, 0) / input.imageAnalysis.length
    : 0.5

  let discogsReleases: DiscogsRelease[] = []
  
  if (input.discogsSearchEnabled && (input.manualHints?.artist || input.manualHints?.catalogNumber || allCatalogNumbers.length > 0)) {
    const searchQuery = {
      artist: input.manualHints?.artist,
      title: input.manualHints?.title,
      catalogNumber: input.manualHints?.catalogNumber || allCatalogNumbers[0],
      barcode: allBarcodes[0],
      format: input.manualHints?.format,
      country: input.manualHints?.country,
      year: input.manualHints?.year,
    }

    discogsReleases = await searchDiscogsDatabase(searchQuery, input.discogsApiToken)
  }

  const prompt = spark.llmPrompt`You are the Pressing Identification Specialist for VinylVault. Your job is to identify the most probable pressing variant with the highest achievable precision given the available data. You MUST NOT output structural error messages such as "fail", "error", "unable to determine", or "unknown variant" as a top-level response — instead, represent uncertainty through low confidence scores (< 0.40) and honest reasoning text. Always return at least one candidate so the user has a starting point; never silently abort.

Follow this exact workflow:

STEP 1 — CONFIRM CATALOG NUMBER & LABEL
Use the parent release data already found (Discogs matches below) to lock in the catalog number and label. If multiple labels are present, list all.

STEP 2 — EXTRACT EVERY VISIBLE IDENTIFIER
From the provided image data and listing text, extract ALL of the following without omitting any:
- Matrix/runout etchings (full deadwax text, both sides)
- Label colour and design (e.g. "red label with silver text", "orange/red Parlophone")
- Stamper codes and pressing plant indicators (e.g. "1U", "2U", "Porky", "Pecko", "Sterling")
- Inner sleeve type (e.g. "lyric inner", "plain white", "photo inner")
- Gatefold or standard cover
- Coloured vinyl, picture disc, clear vinyl
- Insert, poster, booklet presence
- Country codes on label or sleeve
- Barcodes (barcode-era releases only)
- Any handwritten or etched signatures
- Promo markings (e.g. "NOT FOR SALE", "DEMONSTRATION COPY", hole punch)

STEP 3 — CROSS-REFERENCE ALL KNOWN VARIANTS
Using Discogs master release history and standard discography knowledge, enumerate ALL known variants for this catalog number. For each variant, state whether the extracted identifiers match, partially match, or do not match.

STEP 4 — DECLARE MOST PROBABLE VARIANT
If multiple variants are still possible after Step 3, list them ALL ranked by probability, then declare the SINGLE most probable with:
- Confidence percentage (0–100%)
- The decisive evidence that distinguishes this variant from all others

STEP 5 — MISSING IDENTIFIERS
If any identifier is missing from the provided data, explicitly name what is missing and state whether the variant is still determinable or not, and why.

**IMAGE EXTRACTION DATA:**
${allExtractedText.length > 0 ? `- Visible text: ${allExtractedText.join(', ')}` : '- No extracted text'}
${allLabels.length > 0 ? `- Record labels: ${allLabels.join(', ')}` : '- No labels identified'}
${allMatrixNumbers.length > 0 ? `- Matrix/runout numbers: ${allMatrixNumbers.join(', ')}` : '- No matrix numbers'}
${allCatalogNumbers.length > 0 ? `- Catalog numbers: ${allCatalogNumbers.join(', ')}` : '- No catalog numbers'}
${allBarcodes.length > 0 ? `- Barcodes: ${allBarcodes.join(', ')}` : '- No barcodes'}

**MANUAL HINTS PROVIDED BY USER:**
${input.manualHints?.artist ? `- Artist: ${input.manualHints.artist}` : ''}
${input.manualHints?.title ? `- Title: ${input.manualHints.title}` : ''}
${input.manualHints?.catalogNumber ? `- Catalog number: ${input.manualHints.catalogNumber}` : ''}
${input.manualHints?.country ? `- Country: ${input.manualHints.country}` : ''}
${input.manualHints?.year ? `- Year: ${input.manualHints.year}` : ''}
${input.manualHints?.format ? `- Format: ${input.manualHints.format}` : ''}
${input.manualHints?.labelName ? `- Label name: ${input.manualHints.labelName}` : ''}

**DISCOGS DATABASE MATCHES:**
${discogsReleases.length > 0 ? discogsReleases.map((release, idx) => {
  const labelInfo = release.labels?.[0]
  const formatInfo = release.formats?.[0]
  const artist = release.artists?.[0]?.name || 'Unknown'
  const matrixInfo = release.identifiers?.filter(id => id.type.includes('Matrix') || id.type.includes('Runout'))
  
  return `
  Release #${idx + 1}:
  - Discogs ID: ${release.id}
  - Title: ${artist} - ${release.title}
  - Year: ${release.year || 'Unknown'}
  - Country: ${release.country || 'Unknown'}
  - Format: ${formatInfo?.name || 'Unknown'} ${formatInfo?.descriptions?.join(', ') || ''}
  - Label: ${labelInfo?.name || 'Unknown'}
  - Catalog Number: ${labelInfo?.catno || 'Unknown'}
  - Matrix/Runout: ${matrixInfo?.map(m => m.value).join(', ') || 'None listed'}
  `
}).join('\n') : '- No Discogs database matches found'}

**SCORING SIGNALS:**
When scoring candidates, consider these factors (in priority order):
1. Catalog number exact match (weight: 0.35) - HIGHEST PRIORITY
2. Barcode exact match (weight: 0.30) - VERY HIGH PRIORITY
3. Matrix/runout fuzzy similarity (weight: 0.20) - use fuzzy matching, not just exact
4. Country match (weight: 0.05)
5. Format match (weight: 0.05)
6. Label text similarity (weight: 0.03) - partial matches acceptable
7. Year plausibility within ±2 years (weight: 0.02)

Matrix/runout matching rules:
- Normalize before comparing (remove spaces, hyphens, convert to uppercase)
- Consider partial matches (e.g., "A1" matches "A1/B1")
- Account for variations (e.g., "SHVL 804 A 1" matches "SHVL-804-A-1")
- Multiple matrix codes increase confidence

${discogsReleases.length > 0 ? `
**IMPORTANT:** Discogs database matches have been provided above. PRIORITIZE these real database entries over AI-generated guesses. When a Discogs release matches the extracted data well, use that release's information to create pressing candidates with high confidence. Include the Discogs ID in the candidate's id field as "discogs-{id}".

For Discogs matches:
- Start with base score of 0.50 (trusted database source)
- Add scoring signal weights for each match as listed above
- Discogs matches with strong identifier matches should score 0.80+
` : ''}

**OUTPUT RULES — MANDATORY:**
- Do NOT use structural error strings ("fail", "error", "unable to determine", "unknown variant") as a substitute for a real candidate. Instead, express uncertainty via a low confidence score (< 0.40) and an honest "reasoning" field.
- You MUST always return at least one candidate. If data is sparse, use all available context and discography knowledge to produce the best possible determination and assign it an appropriately low confidence score.
- If identifiers are ambiguous, list every plausible variant, rank them, and declare the single most probable with the decisive distinguishing evidence.
- The "reasoning" field MUST follow this exact structure:
  1. Catalog number & label confirmed
  2. Exact year & country of pressing
  3. Matrix/runout etchings (if visible or standard for this issue)
  4. Key identifiers (gatefold, inner sleeve, coloured vinyl, insert, label design, stampers)
  5. Variant notes (1st press, 2nd press, reissue, UK-only, mispress, promo, etc.)
  6. Known differences from other editions (e.g. "this is the red-label stereo UK original, not the later black-label reissue")

Return JSON with this structure:
{
  "candidates": [
    {
      "id": "discogs-12345",
      "pressingName": "UK 1st Press",
      "releaseTitle": "Low",
      "artistName": "David Bowie",
      "year": 1977,
      "country": "UK",
      "format": "LP",
      "catalogNumber": "PL 12030",
      "matrixNumbers": ["A1/B1"],
      "discogsId": 12345,
      "discogsUrl": "https://www.discogs.com/release/12345",
      "discogsVariant": "180g gatefold reissue",
      "imageUrls": ["https://i.discogs.com/..."],
      "confidence": 0.92,
      "totalScore": 0.92,
      "matchedIdentifiers": ["PL 12030", "A1/B1", "RCA label"],
      "reasoning": "1. Catalog number PL 12030 confirmed on RCA Victor label. 2. UK pressing, 1977. 3. Matrix A1/B1 visible in deadwax — first stamper on both sides. 4. Standard single sleeve, no gatefold on original UK issue. 5. 1st press: A1/B1 stampers are the earliest known UK run. 6. Distinguishable from later 2nd press (A2/B2 stampers) and US RCA AFL1-2030 by catalog number prefix and stamper generation.",
      "evidenceSnippets": [
        "Catalog number 'PL 12030' is exact match for UK RCA Victor 1st press",
        "Matrix 'A1/B1' confirms first stamper generation — earliest known UK pressing",
        "RCA label design confirmed from image analysis",
        "No barcode present, consistent with pre-1983 original pressing"
      ],
      "matches": [
        {
          "type": "catalog_number",
          "value": "PL 12030",
          "source": "discogs_database",
          "confidence": 0.95
        },
        {
          "type": "matrix",
          "value": "A1/B1",
          "source": "image_ocr",
          "confidence": 0.88
        },
        {
          "type": "label",
          "value": "RCA",
          "source": "image_ocr",
          "confidence": 0.90
        }
      ]
    }
  ]
}`

  try {
    const response = await spark.llm(prompt, 'gpt-4o', true)
    const result = JSON.parse(response) as { candidates: ScoredPressingCandidate[] }
    
    const processedCandidates = result.candidates.map(candidate => {
      const adjustedConfidence = Math.min(
        candidate.confidence,
        avgImageConfidence * 1.15
      )
      
      const confidenceBand = calculateConfidenceBand(adjustedConfidence)
      
      return {
        ...candidate,
        confidence: adjustedConfidence,
        totalScore: adjustedConfidence,
        confidenceBand,
        evidenceSnippets: candidate.evidenceSnippets || [],
        matches: candidate.matches || []
      }
    })
    
    const deduplicated = deduplicateCandidates(processedCandidates)
    
    return deduplicated.slice(0, 5)
  } catch (error) {
    console.error('Pressing identification failed:', error)
    return []
  }
}

export interface DiscogsRelease {
  id: number
  title: string
  year?: number
  country?: string
  formats?: Array<{
    name: string
    qty: string
    descriptions?: string[]
  }>
  labels?: Array<{
    name: string
    catno?: string
  }>
  artists?: Array<{
    name: string
  }>
  identifiers?: Array<{
    type: string
    value: string
  }>
  images?: Array<{
    uri: string
    type: string
  }>
}

export async function searchDiscogsDatabase(
  query: {
    artist?: string
    title?: string
    catalogNumber?: string
    barcode?: string
    format?: string
    country?: string
    year?: number
  },
  apiToken?: string
): Promise<DiscogsRelease[]> {
  if (!apiToken) {
    console.warn('No Discogs API token provided, using AI fallback')
    return searchDiscogsDatabaseFallback(query)
  }

  const cacheKey = { type: 'database', ...query }
  const cached = await discogsCache.get<DiscogsRelease[]>(cacheKey)
  
  if (cached) {
    console.log('Cache hit for Discogs database search')
    return cached
  }

  try {
    const searchParams = new URLSearchParams()
    
    if (query.artist && query.title) {
      searchParams.append('release_title', query.title)
      searchParams.append('artist', query.artist)
    } else if (query.artist) {
      searchParams.append('artist', query.artist)
    } else if (query.title) {
      searchParams.append('release_title', query.title)
    }
    
    if (query.catalogNumber) {
      searchParams.append('catno', query.catalogNumber)
    }
    
    if (query.barcode) {
      searchParams.append('barcode', query.barcode)
    }
    
    if (query.format) {
      searchParams.append('format', query.format)
    }
    
    if (query.country) {
      searchParams.append('country', query.country)
    }
    
    if (query.year) {
      searchParams.append('year', query.year.toString())
    }

    searchParams.append('type', 'release')
    searchParams.append('per_page', '10')

    const headers: HeadersInit = {
      'User-Agent': 'VinylVault/1.0',
      'Authorization': `Discogs token=${apiToken}`,
    }

    const response = await fetch(
      `https://api.discogs.com/database/search?${searchParams.toString()}`,
      { headers }
    )

    if (!response.ok) {
      throw new Error(`Discogs API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    const releaseIds = data.results
      ?.filter((r: any) => r.type === 'release' && r.id)
      .slice(0, 5)
      .map((r: any) => r.id) || []

    const releases: DiscogsRelease[] = []
    
    for (const releaseId of releaseIds) {
      try {
        await new Promise(resolve => setTimeout(resolve, 1100))
        
        const releaseResponse = await fetch(
          `https://api.discogs.com/releases/${releaseId}`,
          { headers }
        )

        if (releaseResponse.ok) {
          const release = await releaseResponse.json()
          releases.push(release)
        }
      } catch (error) {
        console.error(`Failed to fetch release ${releaseId}:`, error)
      }
    }

    await discogsCache.set(cacheKey, releases, 7 * 24 * 60 * 60 * 1000)
    console.log('Cached Discogs database search results')

    return releases
  } catch (error) {
    console.error('Discogs database search failed:', error)
    return searchDiscogsDatabaseFallback(query)
  }
}

async function searchDiscogsDatabaseFallback(
  query: {
    artist?: string
    title?: string
    catalogNumber?: string
    barcode?: string
    format?: string
    country?: string
    year?: number
  }
): Promise<DiscogsRelease[]> {
  const prompt = spark.llmPrompt`You are simulating a Discogs database search for vinyl records. Use your knowledge of vinyl pressing history to generate accurate, realistic pressing records. Only return results you can reasonably derive from the search query; if the query is too vague to identify any specific release, return an empty candidates list rather than fabricating records.

Generate 2-5 realistic pressing records that match this search query:
${query.artist ? `Artist: ${query.artist}` : ''}
${query.title ? `Title: ${query.title}` : ''}
${query.catalogNumber ? `Catalog number: ${query.catalogNumber}` : ''}
${query.barcode ? `Barcode: ${query.barcode}` : ''}
${query.format ? `Format: ${query.format}` : ''}
${query.country ? `Country: ${query.country}` : ''}
${query.year ? `Year: ${query.year}` : ''}

Include major pressings (UK, US, Japanese, German) and notable variants. For each result, include accurate matrix/runout identifiers, label details, and pressing-specific notes based on known discography.

Return JSON:
{
  "results": [
    {
      "id": 12345,
      "title": "David Bowie - Low",
      "year": 1977,
      "country": "UK",
      "formats": [
        {
          "name": "Vinyl",
          "qty": "1",
          "descriptions": ["LP", "Album"]
        }
      ],
      "labels": [
        {
          "name": "RCA Victor",
          "catno": "PL 12030"
        }
      ],
      "artists": [
        {
          "name": "David Bowie"
        }
      ],
      "identifiers": [
        {
          "type": "Matrix / Runout",
          "value": "A1/B1"
        }
      ]
    }
  ]
}`

  try {
    const response = await spark.llm(prompt, 'gpt-4o', true)
    const result = JSON.parse(response) as { results: DiscogsRelease[] }
    return result.results || []
  } catch (error) {
    console.error('Discogs search fallback failed:', error)
    return []
  }
}
