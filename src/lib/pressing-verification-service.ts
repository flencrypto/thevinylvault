import { ScoredPressingCandidate } from './pressing-identification-ai'
import { ItemImage } from './types'
import { getDiscogsReleaseInfo } from './marketplace-discogs'

interface VerificationResult {
  overallMatch: number
  imageMatch: number
  matrixMatch: number
  labelMatch: number
  details: string[]
  warnings: string[]
  discogsImages?: string[]
}

export async function verifyPressingMatch(
  candidate: ScoredPressingCandidate,
  userImages: ItemImage[],
  discogsApiToken?: string
): Promise<VerificationResult> {
  
  const result: VerificationResult = {
    overallMatch: candidate.confidence * 100,
    imageMatch: 0,
    matrixMatch: 0,
    labelMatch: 0,
    details: [],
    warnings: [],
    discogsImages: []
  }

  if (!candidate.discogsId || !discogsApiToken) {
    result.warnings.push('Discogs API not configured - cannot verify images')
    result.imageMatch = 50
    result.matrixMatch = candidate.matrixNumbers && candidate.matrixNumbers.length > 0 ? 70 : 50
    result.labelMatch = 50
    return result
  }

  try {
    const discogsRelease = await getDiscogsReleaseInfo(candidate.discogsId, { userToken: discogsApiToken })
    
    if (discogsRelease.images && discogsRelease.images.length > 0) {
      result.discogsImages = discogsRelease.images.map((img: any) => img.uri)
    }

    const userImageDescriptions = userImages.map(img => {
      return {
        type: img.type,
        dataUrl: img.dataUrl
      }
    })

    const discogsImageDescriptions = discogsRelease.images?.map((img: any) => ({
      type: img.type,
      uri: img.uri
    })) || []

    const matrixInfo = discogsRelease.identifiers?.filter(
      (id: any) => id.type.toLowerCase().includes('matrix') || id.type.toLowerCase().includes('runout')
    ) || []

    const labelInfo = discogsRelease.labels?.[0]

    const prompt = spark.llmPrompt`You are an expert vinyl record pressing verification system. Your task is to analyze user-uploaded images against Discogs database information to verify if they match the same pressing.

**USER IMAGES UPLOADED:**
${userImageDescriptions.map((img, idx) => `- Image ${idx + 1}: ${img.type} (data available for analysis)`).join('\n')}

**DISCOGS DATABASE RECORD:**
- Release ID: ${candidate.discogsId}
- Artist: ${candidate.artistName}
- Title: ${candidate.releaseTitle}
- Year: ${candidate.year}
- Country: ${candidate.country}
- Format: ${candidate.format}
- Catalog Number: ${candidate.catalogNumber || 'Not specified'}
- Label: ${labelInfo?.name || 'Unknown'}
${matrixInfo.length > 0 ? `- Matrix/Runout Numbers: ${matrixInfo.map((m: any) => m.value).join(', ')}` : '- No matrix information in database'}
${discogsImageDescriptions.length > 0 ? `- Database has ${discogsImageDescriptions.length} images available` : '- No images in database'}

**CANDIDATE'S MATCHED IDENTIFIERS:**
${candidate.matches.map((m: any) => `- ${m.type}: "${m.value}" (source: ${m.source}, confidence: ${Math.round(m.confidence * 100)}%)`).join('\n')}

**VERIFICATION TASK:**
Based on the information above, verify the likelihood that the user's record matches this specific Discogs pressing. Consider:

1. **Image Verification** (if user uploaded cover/label images):
   - Do the visible design elements match the expected pressing?
   - Is the label design consistent with the country and year?
   - Are there any clear mismatches in artwork or typography?

2. **Matrix/Runout Verification**:
   - Do the extracted matrix numbers match or closely match the Discogs data?
   - Are they consistent with the pressing variant?
   - Are there any contradictory identifiers?

3. **Label Verification**:
   - Does the visible label name match?
   - Is the catalog number consistent?
   - Does the label design match the era and region?

**SCORING GUIDELINES:**
- Image Match: 0-100% (how well the images match expectations)
- Matrix Match: 0-100% (how well matrix/runout data matches)
- Label Match: 0-100% (how well label information matches)

Return JSON with this structure:
{
  "imageMatch": 85,
  "matrixMatch": 90,
  "labelMatch": 95,
  "overallMatch": 90,
  "details": [
    "Catalog number PL 12030 exactly matches Discogs database",
    "Matrix 'A1/B1' consistent with 1977 UK first pressing pattern",
    "Label design matches RCA UK 1970s style"
  ],
  "warnings": [
    "No runout image provided - matrix verification limited to OCR text",
    "Only front cover supplied - back cover and label images would improve verification"
  ]
}

Be honest about uncertainty. If information is missing or ambiguous, reflect that in the scores and warnings.`

    const response = await spark.llm(prompt, 'gpt-4o', true)
    const aiResult = JSON.parse(response)

    result.imageMatch = aiResult.imageMatch || 50
    result.matrixMatch = aiResult.matrixMatch || 50
    result.labelMatch = aiResult.labelMatch || 50
    result.overallMatch = aiResult.overallMatch || candidate.confidence * 100
    result.details = aiResult.details || []
    result.warnings = aiResult.warnings || []

    if (matrixInfo.length === 0) {
      result.warnings.push('Discogs database has no matrix/runout information for comparison')
    }

    if (!discogsRelease.images || discogsRelease.images.length === 0) {
      result.warnings.push('Discogs database has no images for visual comparison')
    }

    if (userImages.length === 0) {
      result.warnings.push('No user images uploaded - verification is based only on metadata')
    }

  } catch (error) {
    console.error('Verification failed:', error)
    result.warnings.push('AI verification failed - using baseline confidence')
    result.imageMatch = 50
    result.matrixMatch = 50
    result.labelMatch = 50
  }

  return result
}
