import { ImageAnalysisResult, PressingCandidate, Format } from './types'
import { callVisionModel, extractJSON } from './vision-api-helper'

export async function analyzeVinylImage(imageDataUrl: string, imageType: string): Promise<ImageAnalysisResult> {
  const systemPrompt = `You are a vinyl record identification expert. You analyze vinyl record images to extract identifying information with high precision.`

  const userPrompt = `You are analyzing a vinyl record ${imageType} image to extract identifying information.

Examine this image and extract:
1. Any visible text (artist names, album titles, song names, label text)
2. Record label names (e.g., "Columbia", "Atlantic", "Parlophone")
3. Matrix/runout numbers (usually etched near the center, format like "A1", "B2", or alphanumeric codes)
4. Catalog numbers (usually on the label or spine, format like "PL 12030", "NSPL 18326")
5. Barcodes (if visible)

Be thorough but only report text you can actually see. For matrix numbers, look for hand-etched or stamped codes in the runout groove area.

Return your analysis as JSON with this structure:
{
  "extractedText": ["array of all visible text"],
  "identifiedLabels": ["array of record label names found"],
  "matrixNumbers": ["array of matrix/runout codes"],
  "catalogNumbers": ["array of catalog numbers"],
  "barcodes": ["array of barcodes"],
  "confidence": 0.85
}

The confidence score should reflect how clear and readable the image is.`

  try {
    const response = await callVisionModel(systemPrompt, userPrompt, [imageDataUrl])
    const result = JSON.parse(extractJSON(response)) as ImageAnalysisResult
    return result
  } catch (error) {
    console.error('Image analysis failed:', error)
    return {
      extractedText: [],
      identifiedLabels: [],
      matrixNumbers: [],
      catalogNumbers: [],
      barcodes: [],
      confidence: 0
    }
  }
}

export async function identifyPressing(
  analysisResults: ImageAnalysisResult[],
  userHints?: {
    artist?: string
    title?: string
    year?: number
    country?: string
  }
): Promise<PressingCandidate[]> {
  const allExtractedText = analysisResults.flatMap(r => r.extractedText)
  const allLabels = analysisResults.flatMap(r => r.identifiedLabels)
  const allMatrixNumbers = analysisResults.flatMap(r => r.matrixNumbers)
  const allCatalogNumbers = analysisResults.flatMap(r => r.catalogNumbers)
  const allBarcodes = analysisResults.flatMap(r => r.barcodes)
  
  const avgConfidence = analysisResults.reduce((sum, r) => sum + r.confidence, 0) / analysisResults.length

  const prompt = (spark as any).llmPrompt`You are a vinyl record pressing identification expert. Based on extracted image data and user hints, identify the most likely pressing.

**Extracted Image Data:**
- All visible text: ${allExtractedText.join(', ')}
- Record labels identified: ${allLabels.join(', ')}
- Matrix/runout numbers: ${allMatrixNumbers.join(', ')}
- Catalog numbers: ${allCatalogNumbers.join(', ')}
- Barcodes: ${allBarcodes.join(', ')}

**User Hints:**
${userHints?.artist ? `- Artist: ${userHints.artist}` : ''}
${userHints?.title ? `- Title: ${userHints.title}` : ''}
${userHints?.year ? `- Year: ${userHints.year}` : ''}
${userHints?.country ? `- Country: ${userHints.country}` : ''}

Generate up to 3 pressing candidates ranked by likelihood. For each candidate, provide:
1. A unique ID (generate a UUID-style string)
2. Pressing name (e.g., "UK 1st Press", "US Reissue", "Japanese Pressing")
3. Release title
4. Artist name
5. Year
6. Country code (UK, US, DE, JP, etc.)
7. Format (LP, 7in, 12in, EP, or Boxset)
8. Catalog number if identified
9. Matrix numbers if identified
10. Confidence score (0.0-1.0)
11. Which identifiers were matched (array of strings)
12. Brief reasoning for this identification

Return as JSON with this structure:
{
  "candidates": [
    {
      "id": "unique-id",
      "pressingName": "UK 1st Press",
      "releaseTitle": "Low",
      "artistName": "David Bowie",
      "year": 1977,
      "country": "UK",
      "format": "LP",
      "catalogNumber": "PL 12030",
      "matrixNumbers": ["A1", "B1"],
      "confidence": 0.92,
      "matchedIdentifiers": ["PL 12030", "A1/B1", "RCA label"],
      "reasoning": "Catalog number PL 12030 matches UK first pressing, matrix numbers A1/B1 confirm first pressing variant"
    }
  ]
}`

  try {
    const response = await (spark as any).llm(prompt, 'gpt-4o', true)
    const result = JSON.parse(extractJSON(response)) as { candidates: PressingCandidate[] }
    
    return result.candidates.map(candidate => ({
      ...candidate,
      confidence: Math.min(candidate.confidence, avgConfidence + 0.15)
    }))
  } catch (error) {
    console.error('Pressing identification failed:', error)
    return []
  }
}

export async function suggestConditionGrade(
  imageDataUrls: string[],
  imageTypes: string[]
): Promise<{
  mediaGrade?: string
  sleeveGrade?: string
  defects: string[]
  confidence: number
  reasoning: string
}> {
  const imageDescriptions = imageTypes.map((type, idx) => `${type} (image ${idx + 1})`).join(', ')

  const systemPrompt = `You are an expert vinyl record grader using the Goldmine grading standard. You examine actual record images to assess condition.`

  const userPrompt = `Analyze these ${imageDataUrls.length} images: ${imageDescriptions}

Goldmine Grading Scale:
- M (Mint): Perfect, unplayed
- NM (Near Mint): Looks and sounds like new, minimal signs of handling
- EX (Excellent): Minor signs of use, excellent sound quality
- VG+ (Very Good Plus): Light wear, plays with minimal noise
- VG (Very Good): Noticeable wear, some surface noise
- G (Good): Significant wear, consistent background noise
- F (Fair): Heavy wear, may skip
- P (Poor): Damaged, barely playable

Look for:
- Surface scratches, scuffs, marks
- Spindle wear on label
- Sleeve condition: ringwear, seam splits, corner wear, writing, stickers
- Warping or visible damage

Return JSON:
{
  "mediaGrade": "VG+",
  "sleeveGrade": "VG",
  "defects": ["light surface marks", "minor spindle wear", "corner wear on sleeve"],
  "confidence": 0.75,
  "reasoning": "Brief explanation of the grades assigned"
}`

  try {
    const response = await callVisionModel(systemPrompt, userPrompt, imageDataUrls)
    const result = JSON.parse(extractJSON(response))
    return result
  } catch (error) {
    console.error('Condition grading failed:', error)
    return {
      defects: [],
      confidence: 0,
      reasoning: 'Analysis failed'
    }
  }
}
