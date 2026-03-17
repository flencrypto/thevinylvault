import { ImageType } from './types'
import { callVisionModel, extractJSON } from './vision-api-helper'

export type ImageClassification = 
  | 'front_cover' 
  | 'back_cover' 
  | 'label' 
  | 'runout' 
  | 'insert' 
  | 'spine' 
  | 'unknown'

export interface MetadataExtraction {
  artistName?: string
  title?: string
  catalogNumber?: string
  labelName?: string
  barcode?: string
  sideMarker?: string
  matrixRunoutText?: string
  editionClues?: {
    mono?: boolean
    stereo?: boolean
    promo?: boolean
    testPressing?: boolean
    reissue?: boolean
    originalPressing?: boolean
  }
}

export type DefectType = 
  | 'seam_split' 
  | 'ringwear' 
  | 'staining' 
  | 'creasing' 
  | 'sticker_residue' 
  | 'writing_on_sleeve' 
  | 'scuffs_on_label' 
  | 'scratches' 
  | 'spindle_wear'
  | 'corner_wear'
  | 'edge_wear'
  | 'surface_marks'

export interface ConditionDefect {
  type: DefectType
  confidence: number
  severity: 'minor' | 'moderate' | 'major'
  location?: string
  description: string
}

export interface ImageAnalysisOutput {
  imageType: ImageClassification
  extractedMetadata: MetadataExtraction
  conditionDefects: ConditionDefect[]
  confidence: number
  notes: string[]
  rawAIOutput?: string
  uncertainties?: string[]
}

export interface ListingAssistOutput {
  sellerNotes: string[]
  conditionSummary: string
  gradeSuggestion?: {
    media?: string
    sleeve?: string
    reasoning: string
  }
}

export async function classifyImage(imageDataUrl: string): Promise<{
  imageType: ImageClassification
  confidence: number
  reasoning: string
}> {
  const systemPrompt = `You are an expert at identifying vinyl record image types. Classify vinyl record photographs into one of these categories:
- front_cover: The front album artwork
- back_cover: The back of the album sleeve showing track listing or additional artwork
- label: The record label visible on the vinyl disc itself
- runout: Close-up of the runout groove area showing matrix/runout etchings
- insert: Inner sleeve, lyric sheet, or other paper inserts
- spine: The spine edge of the album sleeve
- unknown: Cannot be confidently classified`

  const userPrompt = `Classify this vinyl record image. Look at the actual image content to determine the type.

Return your analysis as JSON:
{
  "imageType": "front_cover",
  "confidence": 0.85,
  "reasoning": "Shows album artwork with artist name and title visible"
}`

  try {
    const response = await callVisionModel(systemPrompt, userPrompt, [imageDataUrl])
    const result = JSON.parse(extractJSON(response))
    
    return {
      imageType: result.imageType || 'front_cover',
      confidence: result.confidence || 0.7,
      reasoning: result.reasoning || 'Classification based on image analysis'
    }
  } catch (error) {
    console.error('Image classification failed:', error)
    
    return {
      imageType: 'front_cover',
      confidence: 0.5,
      reasoning: 'Defaulting to front_cover - please verify manually'
    }
  }
}

export async function extractMetadata(
  imageDataUrl: string, 
  imageType: ImageClassification
): Promise<MetadataExtraction & { confidence: number; uncertainties: string[] }> {
  const systemPrompt = `You are an expert at reading text and metadata from vinyl record images. You have deep knowledge of record labels, catalog numbering systems, and pressing identification.`

  const userPrompt = `Image type: ${imageType}

Extract the following information from this image. ONLY report information you can actually see - do not infer or guess:

1. **Artist name** - As printed on the sleeve/label
2. **Title** - Album or single title
3. **Catalog number** - Usually alphanumeric code like "PL 12030", "NSPL 18326"
4. **Label name** - Record company/label (e.g., "RCA", "Columbia", "Atlantic")
5. **Barcode** - If visible
6. **Side marker** - Labels like "Side A", "Side 1", "Face A"
7. **Matrix/runout text** - Hand-etched or stamped codes in the runout groove area (for runout images)
8. **Edition clues** - Look for text indicating:
   - MONO or STEREO
   - PROMO, PROMOTIONAL, or DJ COPY
   - TEST PRESSING
   - REISSUE or REMASTER
   - ORIGINAL PRESSING or FIRST PRESSING

Return as JSON:
{
  "artistName": "David Bowie",
  "title": "Low",
  "catalogNumber": "PL 12030",
  "labelName": "RCA",
  "barcode": "123456789012",
  "sideMarker": "Side A",
  "matrixRunoutText": "A1-SOMETHING-X",
  "editionClues": {
    "mono": false,
    "stereo": true,
    "promo": false,
    "testPressing": false,
    "reissue": false,
    "originalPressing": true
  },
  "confidence": 0.87,
  "uncertainties": ["Catalog number partially obscured", "Matrix text difficult to read"]
}

Mark uncertain readings in the uncertainties array. Only include fields where you found actual visible information.`

  try {
    const response = await callVisionModel(systemPrompt, userPrompt, [imageDataUrl])
    const result = JSON.parse(extractJSON(response))
    return result
  } catch (error) {
    console.error('Metadata extraction failed:', error)
    return {
      confidence: 0,
      uncertainties: ['Extraction failed']
    }
  }
}

export async function detectConditionDefects(
  imageDataUrl: string,
  imageType: ImageClassification
): Promise<{
  defects: ConditionDefect[]
  confidence: number
  notes: string[]
}> {
  const isMedia = imageType === 'label' || imageType === 'runout'
  const isSleeve = imageType === 'front_cover' || imageType === 'back_cover' || imageType === 'spine' || imageType === 'insert'

  const systemPrompt = `You are an expert vinyl record grader analyzing condition defects. You examine images carefully for any signs of wear, damage, or imperfections.`

  const userPrompt = `Image type: ${imageType}
${isMedia ? 'Focus on: Media/label condition issues' : ''}
${isSleeve ? 'Focus on: Sleeve/packaging condition issues' : ''}

Detect ALL visible defects in this image. Report ONLY what you can actually observe - do not infer hidden damage.

${isMedia ? `
**Media/Label Defects to look for:**
- scuffs_on_label: Scuff marks or scratches on the paper label
- scratches: Visible scratches on the vinyl surface
- spindle_wear: Wear around the center hole from record player spindles
- surface_marks: Surface scuffs, light marks, or hairlines on vinyl
` : ''}

${isSleeve ? `
**Sleeve Defects to look for:**
- seam_split: Split or separation along the seams/edges
- ringwear: Circular wear marks from the record inside
- staining: Water damage, discoloration, or stains
- creasing: Creases, bends, or folds in the cardboard
- sticker_residue: Adhesive residue from removed stickers
- writing_on_sleeve: Pen, marker, or handwritten text
- corner_wear: Damage or fraying at corners
- edge_wear: Fraying or damage along edges
` : ''}

For each defect:
- Type: Use exact defect type from the list above
- Confidence: 0.0-1.0 (how certain you are this defect exists)
- Severity: "minor" (barely noticeable) | "moderate" (noticeable) | "major" (significant)
- Location: Describe where on the item (e.g., "top right corner", "near center", "spine edge")
- Description: Brief observable fact (e.g., "2cm seam split on top edge")

Return as JSON:
{
  "defects": [
    {
      "type": "ringwear",
      "confidence": 0.85,
      "severity": "moderate",
      "location": "front cover center",
      "description": "Circular wear mark approximately 3cm diameter"
    }
  ],
  "confidence": 0.88,
  "notes": ["Image quality allows clear defect detection", "Good lighting and focus"]
}

If no defects are visible, return an empty defects array. Be thorough but conservative - only report defects you can actually see.`

  try {
    const response = await callVisionModel(systemPrompt, userPrompt, [imageDataUrl])
    const result = JSON.parse(extractJSON(response))
    return result
  } catch (error) {
    console.error('Condition detection failed:', error)
    return {
      defects: [],
      confidence: 0,
      notes: ['Detection failed']
    }
  }
}

export async function generateListingNotes(
  defects: ConditionDefect[],
  metadata?: MetadataExtraction
): Promise<ListingAssistOutput> {
  const defectsList = defects.map(d => 
    `${d.type} (${d.severity}): ${d.description}`
  ).join('\n')

  const systemPrompt = `You are an expert at writing professional vinyl record condition descriptions for marketplace listings.`

  const userPrompt = `Based on the detected defects, generate professional seller notes that are:
- Honest and accurate
- Professional and neutral in tone
- Clear and specific
- Following industry conventions

**Detected defects:**
${defectsList || 'No defects detected'}

${metadata ? `**Additional context:**
Artist: ${metadata.artistName || 'Unknown'}
Title: ${metadata.title || 'Unknown'}
Label: ${metadata.labelName || 'Unknown'}
Catalog: ${metadata.catalogNumber || 'Unknown'}
` : ''}

Generate:
1. **sellerNotes**: Array of 3-6 professional condition statements (e.g., "Light ringwear to front sleeve", "Label clean with minor spindle wear")
2. **conditionSummary**: One-sentence overall summary suitable for marketplace headlines
3. **gradeSuggestion**: Suggested Goldmine grades based on defects

Return as JSON:
{
  "sellerNotes": [
    "Sleeve shows light ringwear to front cover",
    "Minor corner wear at top right",
    "Label clean with minimal spindle marks",
    "Vinyl has light surface marks but plays well"
  ],
  "conditionSummary": "Very Good Plus copy with light wear, plays excellently",
  "gradeSuggestion": {
    "media": "VG+",
    "sleeve": "VG",
    "reasoning": "Light surface marks keep media at VG+, sleeve shows typical light wear for VG grade"
  }
}

If no defects, emphasize excellent condition appropriately.`

  try {
    // Listing notes generation is text-only (no images needed)
    const combinedPrompt = (spark as any).llmPrompt`${systemPrompt}\n\n${userPrompt}`
    const response = await (spark as any).llm(combinedPrompt, 'gpt-4o', true)
    const result = JSON.parse(extractJSON(response))
    return result
  } catch (error) {
    console.error('Listing notes generation failed:', error)
    return {
      sellerNotes: [],
      conditionSummary: 'Condition analysis unavailable'
    }
  }
}

export async function analyzeImageComplete(
  imageDataUrl: string,
  userProvidedType?: ImageType
): Promise<ImageAnalysisOutput> {
  let imageType: ImageClassification = userProvidedType || 'unknown'
  let classificationConfidence = 1.0

  if (!userProvidedType) {
    const classification = await classifyImage(imageDataUrl)
    imageType = classification.imageType
    classificationConfidence = classification.confidence
  }

  const [metadataResult, conditionResult] = await Promise.all([
    extractMetadata(imageDataUrl, imageType),
    detectConditionDefects(imageDataUrl, imageType)
  ])

  const overallConfidence = Math.min(
    classificationConfidence,
    metadataResult.confidence,
    conditionResult.confidence
  )

  return {
    imageType,
    extractedMetadata: metadataResult,
    conditionDefects: conditionResult.defects,
    confidence: overallConfidence,
    notes: conditionResult.notes,
    uncertainties: metadataResult.uncertainties,
    rawAIOutput: JSON.stringify({
      classification: { imageType, confidence: classificationConfidence },
      metadata: metadataResult,
      condition: conditionResult
    }, null, 2)
  }
}

export async function batchAnalyzeImages(
  images: Array<{ dataUrl: string; type?: ImageType; id: string }>
): Promise<Map<string, ImageAnalysisOutput>> {
  const results = new Map<string, ImageAnalysisOutput>()

  for (const image of images) {
    const analysis = await analyzeImageComplete(image.dataUrl, image.type)
    results.set(image.id, analysis)
  }

  return results
}
