import { ScoredPressingCandidate } from './pressing-identification-ai'
import { ItemImage } from './types'
import { getDiscogsReleaseInfo } from './marketplace-discogs'

declare const spark: Window['spark']

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

    const discogsImageDescriptions = discogsRelease.images?.map((img: any) => ({
      type: img.type,
      uri: img.uri
    })) || []

    const matrixInfo = discogsRelease.identifiers?.filter(
      (id: any) => id.type.toLowerCase().includes('matrix') || id.type.toLowerCase().includes('runout')
    ) || []

    const labelInfo = discogsRelease.labels?.[0]

    // Build the shared metadata context used by both vision and text-only paths
    const metadataContext = `**DISCOGS DATABASE RECORD:**
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
Verify the likelihood that the user's record matches this specific Discogs pressing. Consider:

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

Return JSON:
{
  "imageMatch": 85,
  "matrixMatch": 90,
  "labelMatch": 95,
  "overallMatch": 90,
  "details": ["Catalog number PL 12030 exactly matches Discogs database"],
  "warnings": ["No runout image provided - matrix verification limited to OCR text"]
}

Be honest about uncertainty. If information is missing or ambiguous, reflect that in the scores and warnings.`

    // Try to use xAI vision when user images are present, so the model actually
    // sees the images rather than receiving only a text description.
    const imagesWithData = userImages.filter(img => img.dataUrl)
    const hasImages = imagesWithData.length > 0

    let response: string

    if (hasImages) {
      // Attempt a vision API call via xAI so the model can inspect the actual images
      const sparkKv = (globalThis as any)?.spark?.kv
      let xaiApiKey = ''
      let xaiModel = 'grok-4-1-fast-reasoning'
      if (sparkKv && typeof sparkKv.get === 'function') {
        try {
          const raw = await sparkKv.get('vinyl-vault-api-keys')
          const keys = raw as Record<string, string> | null
          if (keys && typeof keys === 'object') {
            xaiApiKey = keys.xaiApiKey || ''
            xaiModel = keys.xaiModel || xaiModel
          }
        } catch { /* ignore */ }
      }

      if (xaiApiKey) {
        const userImagesNote = imagesWithData
          .map((img, idx) => `- Image ${idx + 1}: ${img.type}`)
          .join('\n')
        const systemMessage = `You are an expert vinyl record pressing verification system. Analyze the provided images against the Discogs database information below to verify if they match the same pressing.\n\n**USER IMAGES PROVIDED:**\n${userImagesNote}\n\n${metadataContext}`

        const apiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${xaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: xaiModel,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: systemMessage },
                  ...imagesWithData.map(img => ({
                    type: 'image_url' as const,
                    image_url: { url: img.dataUrl, detail: 'high' as const },
                  })),
                ],
              },
            ],
          }),
        })

        if (!apiResponse.ok) {
          throw new Error(`xAI API error ${apiResponse.status}: ${await apiResponse.text()}`)
        }

        const apiResult = await apiResponse.json()
        response = apiResult.choices?.[0]?.message?.content || '{}'
      } else {
        // xAI not configured — fall back to text-only with honest wording
        const fallbackPrompt = spark.llmPrompt`You are an expert vinyl record pressing verification system. Note: no image data is available for this verification — base your analysis only on the metadata below.

**USER IMAGES PROVIDED (content not available for this analysis):**
${imagesWithData.map((img, idx) => `- Image ${idx + 1}: ${img.type}`).join('\n')}

${metadataContext}`
        response = await spark.llm(fallbackPrompt, 'gpt-4o', true)
      }
    } else {
      // No images — metadata-only verification
      const metaOnlyPrompt = spark.llmPrompt`You are an expert vinyl record pressing verification system. No images were uploaded — perform a metadata-only verification using the information below.

${metadataContext}`
      response = await spark.llm(metaOnlyPrompt, 'gpt-4o', true)
    }

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
