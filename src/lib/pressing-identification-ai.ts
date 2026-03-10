import { PressingCandidate, ImageAnalysisResult, Format } from './types'

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

  const prompt = spark.llmPrompt`You are an expert vinyl record pressing identification system. Your task is to analyze extracted image data, OCR runout values, manual hints, and optionally Discogs metadata to produce ranked pressing candidates with detailed evidence.

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

**SCORING SIGNALS:**
When scoring candidates, consider these factors (in priority order):
1. Catalog number exact match (highest weight)
2. Barcode match (very high weight)
3. Matrix/runout similarity (high weight)
4. Country match
5. Format match
6. Label text similarity
7. Year plausibility (within ±2 years)

**TASK:**
Generate up to 3 pressing candidates ranked by total score. For each candidate:
1. Calculate a confidence score (0.0-1.0) based on the scoring signals above
2. Provide specific evidence snippets explaining why this candidate matched
3. List all matched identifiers with their sources
4. Include detailed pressing information

If the data is genuinely ambiguous or insufficient, DO NOT fabricate certainty. Return fewer candidates with honest confidence scores rather than padding with guesses.

Return JSON with this structure:
{
  "candidates": [
    {
      "id": "uuid-style-string",
      "pressingName": "UK 1st Press",
      "releaseTitle": "Low",
      "artistName": "David Bowie",
      "year": 1977,
      "country": "UK",
      "format": "LP",
      "catalogNumber": "PL 12030",
      "matrixNumbers": ["A1/B1"],
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
          "source": "image_ocr",
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

export async function searchDiscogsDatabase(
  query: {
    artist?: string
    title?: string
    catalogNumber?: string
    barcode?: string
    format?: string
    country?: string
    year?: number
  }
): Promise<Array<{
  id: string
  title: string
  artist: string
  year: number
  country: string
  format: string[]
  catalogNumber?: string
  label?: string
}>> {
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
      "id": "discogs-12345",
      "title": "Low",
      "artist": "David Bowie",
      "year": 1977,
      "country": "UK",
      "format": ["LP", "Album"],
      "catalogNumber": "PL 12030",
      "label": "RCA Victor"
    }
  ]
}`

  try {
    const response = await spark.llm(prompt, 'gpt-4o', true)
    const result = JSON.parse(response) as { results: Array<any> }
    return result.results || []
  } catch (error) {
    console.error('Discogs search simulation failed:', error)
    return []
  }
}
