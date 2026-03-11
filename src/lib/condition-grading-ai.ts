import { ItemImage, MediaGrade, SleeveGrade } from './types'

export interface DefectDetail {
  type: 'media' | 'sleeve'
  severity: 'minor' | 'moderate' | 'major'
  description: string
  location?: string
}

export interface ConditionAnalysisResult {
  mediaGrade?: MediaGrade
  sleeveGrade?: SleeveGrade
  defects: DefectDetail[]
  confidence: number
  reasoning: string
}

export async function analyzeConditionFromImages(
  images: ItemImage[]
): Promise<ConditionAnalysisResult> {
  const mediaImages = images.filter(img => 
    ['label', 'runout'].includes(img.type)
  )
  const sleeveImages = images.filter(img => 
    ['front_cover', 'back_cover', 'spine', 'insert'].includes(img.type)
  )

  const imageTypesSummary = images.map(img => img.type).join(', ')
  
  const imageDescriptions = images.map((img, index) => {
    return `Image ${index + 1}: ${img.type} (${img.mimeType})`
  }).join('\n')

  const prompt = spark.llmPrompt`You are an expert vinyl record grader specializing in condition assessment using the Goldmine grading standard.

I have uploaded ${images.length} image(s) of a vinyl record for condition analysis.

**Images Provided:**
${imageDescriptions}
(${images.length} total images: ${mediaImages.length} media images, ${sleeveImages.length} sleeve images)

**Uploaded Image Data:**
${images.map((img, idx) => `[Image ${idx + 1} - ${img.type}]: ${img.dataUrl}`).join('\n\n')}

**Goldmine Grading Scale:**
- **M (Mint)**: Perfect, unplayed condition. No marks, scratches, or defects. Still sealed or appears factory fresh.
- **NM (Near Mint)**: Looks and sounds like new. Minimal signs of handling. May have been played once or twice. No audible surface noise.
- **EX (Excellent)**: Minor signs of use. Light surface marks that don't affect play. Excellent sound quality with minimal noise.
- **VG+ (Very Good Plus)**: Light wear from handling and play. Some light surface marks/scuffs. Plays with minimal noise.
- **VG (Very Good)**: Noticeable wear but still plays well. Some surface noise and light scratches. No major damage.
- **G (Good)**: Significant wear. Consistent background noise. Scratches visible. Still plays through without skipping.
- **F (Fair)**: Heavy wear. May skip in places. Lots of surface noise. Significant scratches.
- **P (Poor)**: Damaged, barely playable. Major scratches, warping, or other serious damage.

**Your Task:**
1. Analyze the provided images for BOTH media (vinyl disc) and sleeve condition
2. Look for specific defects:
   
   **Media defects:**
   - Surface scratches (light marks, scuffs, deep scratches)
   - Spindle wear (wear around center hole)
   - Label damage (tears, stickers, writing, fading)
   - Warping or visible distortion
   - Dust, dirt, or residue
   
   **Sleeve defects:**
   - Ringwear (circular marks from disc pressing through)
   - Seam splits (tears along edges)
   - Corner wear or bending
   - Edge wear or fraying
   - Writing, stickers, or price tags
   - Water damage or discoloration
   - General creasing or folding

3. Assign appropriate Goldmine grades for media and sleeve SEPARATELY
4. Categorize each defect by severity:
   - **minor**: Doesn't significantly impact grade (small mark, light corner wear)
   - **moderate**: Noticeable but not severe (visible scratch, seam split <1 inch, ringwear)
   - **major**: Significant damage (deep scratches, large seam splits, heavy warping)

5. Provide a confidence score (0.0-1.0) based on:
   - Image quality and clarity
   - Number and angles of images
   - Visibility of key areas
   - Lighting conditions

**Return JSON in this exact format:**
{
  "mediaGrade": "VG+",
  "sleeveGrade": "VG",
  "defects": [
    {
      "type": "media",
      "severity": "minor",
      "description": "Light surface marks on side A",
      "location": "Side A, outer grooves"
    },
    {
      "type": "sleeve",
      "severity": "moderate",
      "description": "Ringwear visible on front cover",
      "location": "Front cover, center"
    }
  ],
  "confidence": 0.75,
  "reasoning": "Good quality images showing both media and sleeve. Media appears to have light surface wear consistent with VG+ grading. Sleeve shows moderate ringwear and light corner wear placing it at VG."
}

**Important Guidelines:**
- If you cannot see media clearly, omit "mediaGrade" from response
- If you cannot see sleeve clearly, omit "sleeveGrade" from response
- Be conservative in grading - when uncertain between two grades, choose the lower one
- List ALL visible defects, even minor ones
- Location field is optional but helpful when you can identify it
- Confidence should reflect image quality, not grading certainty`

  try {
    const response = await spark.llm(prompt, 'gpt-4o', true)
    const result = JSON.parse(response) as ConditionAnalysisResult
    
    return {
      mediaGrade: result.mediaGrade,
      sleeveGrade: result.sleeveGrade,
      defects: result.defects || [],
      confidence: Math.max(0, Math.min(1, result.confidence || 0)),
      reasoning: result.reasoning || 'Analysis completed'
    }
  } catch (error) {
    console.error('Condition analysis failed:', error)
    return {
      defects: [],
      confidence: 0,
      reasoning: 'Analysis failed due to an error'
    }
  }
}

export async function suggestGradingNotes(defects: DefectDetail[]): Promise<string> {
  if (defects.length === 0) {
    return 'No significant defects detected. Record appears to be in excellent condition.'
  }

  const mediaDefects = defects.filter(d => d.type === 'media')
  const sleeveDefects = defects.filter(d => d.type === 'sleeve')

  const prompt = spark.llmPrompt`You are writing professional grading notes for a vinyl record listing.

**Detected Defects:**

Media Defects (${mediaDefects.length}):
${mediaDefects.map(d => `- [${d.severity}] ${d.description} ${d.location ? `(${d.location})` : ''}`).join('\n')}

Sleeve Defects (${sleeveDefects.length}):
${sleeveDefects.map(d => `- [${d.severity}] ${d.description} ${d.location ? `(${d.location})` : ''}`).join('\n')}

Write concise, professional grading notes (2-4 sentences) that accurately describe the condition for a marketplace listing. Be honest about defects but professional in tone. Focus on the most significant issues first.

Return ONLY the grading notes text, no JSON.`

  try {
    const notes = await spark.llm(prompt, 'gpt-4o-mini', false)
    return notes.trim()
  } catch (error) {
    console.error('Failed to generate grading notes:', error)
    
    const majorDefects = defects.filter(d => d.severity === 'major')
    const moderateDefects = defects.filter(d => d.severity === 'moderate')
    
    if (majorDefects.length > 0) {
      return `Record shows significant wear including ${majorDefects.map(d => d.description.toLowerCase()).join(', ')}. ${moderateDefects.length > 0 ? `Also has ${moderateDefects.map(d => d.description.toLowerCase()).join(', ')}.` : ''}`
    } else if (moderateDefects.length > 0) {
      return `Record shows moderate wear including ${moderateDefects.map(d => d.description.toLowerCase()).join(', ')}.`
    } else {
      return `Record shows minor wear: ${defects.map(d => d.description.toLowerCase()).join(', ')}.`
    }
  }
}
