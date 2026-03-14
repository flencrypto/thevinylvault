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

function normalizeIdentifier(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim()
}

function calculateConfidenceBand(score: number): 'high' | 'medium' | 'low' | 'ambiguous' {
  if (score >= 0.80) return 'high'
  if (score >= 0.60) return 'medium'
  if (score >= 0.40) return 'low'
  return 'ambiguous'
}

export async function identifyPressing(
  input: PressingIdentificationInput
): Promise<ScoredPressingCandidate[]> {
  
  const allExtractedText = input.imageAnalysis?.flatMap(r => r.extractedText) || []
  const allLabels = input.imageAnalysis?.flatMap(r => r.identifiedLabels) || []
  const allMatrixNumbers = [
    ...(input.imageAnalysis?.flatMap(r => r.matrixNumbers) || []),
    ...(input.ocrRunoutValues || [])
  ]
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

  const prompt = spark.llmPrompt`You are an expert vinyl record pressing identification system. Your task is to analyze extracted image data, OCR runout values, manual hints, and Discogs database results to produce ranked pressing candidates with detailed evidence.

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
1. Catalog number exact match (highest weight)
2. Barcode match (very high weight)
3. Matrix/runout similarity (high weight)
4. Country match
5. Format match
6. Label text similarity
7. Year plausibility (within ±2 years)

${discogsReleases.length > 0 ? `
**IMPORTANT:** Discogs database matches have been provided above. PRIORITIZE these real database entries over AI-generated guesses. When a Discogs release matches the extracted data well, use that release's information to create pressing candidates with high confidence. Include the Discogs ID in the candidate's id field as "discogs-{id}".
` : ''}

**TASK:**
Generate up to 3 pressing candidates ranked by total score. For each candidate:
1. Calculate a confidence score (0.0-1.0) based on the scoring signals above
2. Provide specific evidence snippets explaining why this candidate matched
3. List all matched identifiers with their sources (including 'discogs_database' when applicable)
4. Include detailed pressing information
5. For Discogs-based candidates:
   - Use format "discogs-{id}" for the id field
   - Include discogsId as a number
   - Include discogsUrl as "https://www.discogs.com/release/{id}"
   - If variant/pressing information is available in Discogs data, include it as discogsVariant
   - Include imageUrls array if available from Discogs

If the data is genuinely ambiguous or insufficient, DO NOT fabricate certainty. Return fewer candidates with honest confidence scores rather than padding with guesses.

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
      "reasoning": "Catalog number PL 12030 matches UK first pressing",
      "evidenceSnippets": [
        "Catalog number 'PL 12030' is exact match for UK RCA 1st press",
        "Matrix 'A1/B1' indicates first press stamper",
        "RCA label confirmed from image analysis"
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
    
    return result.candidates.map(candidate => {
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
  const prompt = spark.llmPrompt`You are simulating a Discogs database search for vinyl records.

Generate 2-5 realistic pressing records that match this search query:
${query.artist ? `Artist: ${query.artist}` : ''}
${query.title ? `Title: ${query.title}` : ''}
${query.catalogNumber ? `Catalog number: ${query.catalogNumber}` : ''}
${query.barcode ? `Barcode: ${query.barcode}` : ''}
${query.format ? `Format: ${query.format}` : ''}
${query.country ? `Country: ${query.country}` : ''}
${query.year ? `Year: ${query.year}` : ''}

Return realistic results based on your knowledge of vinyl pressing history. Include major pressings (UK, US, Japanese, German) and notable variants when relevant.

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
