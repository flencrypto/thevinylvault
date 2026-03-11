import { CollectionItem, GRADE_DESCRIPTIONS, FORMAT_LABELS } from './types'

interface GeneratedDescription {
  itemId: string
  title: string
  description: string
  conditionSummary: string
  highlights: string[]
  seoKeywords: string[]
}

type DescriptionStyle = 'professional' | 'casual' | 'technical' | 'enthusiast'

export async function generateMarketplaceDescription(
  item: CollectionItem,
  style: DescriptionStyle = 'professional'
): Promise<GeneratedDescription> {
  const prompt = spark.llmPrompt`You are an expert vinyl record dealer creating compelling, accurate marketplace listings.

Create a professional marketplace description for the following vinyl record:

Artist: ${item.artistName}
Release: ${item.releaseTitle}
Year: ${item.year}
Country: ${item.country}
Format: ${FORMAT_LABELS[item.format]}
Catalog Number: ${item.catalogNumber || 'N/A'}

CONDITION GRADING:
Media Grade: ${item.condition.mediaGrade} (${GRADE_DESCRIPTIONS[item.condition.mediaGrade]})
Sleeve Grade: ${item.condition.sleeveGrade} (${GRADE_DESCRIPTIONS[item.condition.sleeveGrade]})
Grading Standard: ${item.condition.gradingStandard}
${item.condition.gradingNotes ? `Grading Notes: ${item.condition.gradingNotes}` : ''}

${item.notes ? `Additional Notes: ${item.notes}` : ''}

WRITING STYLE: ${style}
${style === 'professional' ? '- Use formal, trusted dealer language. Be precise and factual.' : ''}
${style === 'casual' ? '- Use friendly, approachable language. Sound like a passionate collector sharing their find.' : ''}
${style === 'technical' ? '- Include detailed technical information. Focus on pressing details, mastering, and audio quality.' : ''}
${style === 'enthusiast' ? '- Use collector terminology. Emphasize rarity, historical significance, and why this matters to enthusiasts.' : ''}

Generate a JSON response with the following structure:
{
  "title": "Brief, compelling title for the listing (artist - album)",
  "conditionSummary": "One sentence summarizing the overall condition",
  "description": "3-4 paragraph detailed description covering: 1) Release information and significance, 2) Detailed condition notes with specific observations, 3) What makes this pressing/edition special or noteworthy",
  "highlights": ["Array of 4-6 key selling points as bullet points"],
  "seoKeywords": ["Array of 8-12 relevant search keywords"]
}

IMPORTANT GUIDELINES:
- Be honest and accurate about condition, never exaggerate
- Include specific condition details (scuffs, marks, seam splits, etc.) if grading notes mention them
- Mention if it's a first pressing, special edition, or has any unique characteristics
- Use proper vinyl collector terminology
- Make highlights concise but compelling
- Include genre, label, and other searchable terms in keywords
- Keep description engaging but factual`

  try {
    const response = await spark.llm(prompt, 'gpt-4o', true)
    const parsed = JSON.parse(response)

    return {
      itemId: item.id,
      title: parsed.title,
      description: parsed.description,
      conditionSummary: parsed.conditionSummary,
      highlights: parsed.highlights || [],
      seoKeywords: parsed.seoKeywords || []
    }
  } catch (error) {
    console.error('Failed to generate marketplace description:', error)
    
    return generateFallbackDescription(item)
  }
}

function generateFallbackDescription(item: CollectionItem): GeneratedDescription {
  const title = `${item.artistName} - ${item.releaseTitle}`
  
  const conditionSummary = `${item.condition.mediaGrade} media, ${item.condition.sleeveGrade} sleeve - graded to ${item.condition.gradingStandard} standards.`
  
  const description = `${item.artistName} - ${item.releaseTitle} (${item.year})

This ${FORMAT_LABELS[item.format]} pressing from ${item.country} is in ${GRADE_DESCRIPTIONS[item.condition.mediaGrade].toLowerCase()} condition for the media and ${GRADE_DESCRIPTIONS[item.condition.sleeveGrade].toLowerCase()} for the sleeve.

${item.catalogNumber ? `Catalog Number: ${item.catalogNumber}\n` : ''}
All grading follows ${item.condition.gradingStandard} standards to ensure accuracy.

${item.condition.gradingNotes || ''}

${item.notes || ''}`

  const highlights = [
    `${item.condition.mediaGrade} media condition`,
    `${item.condition.sleeveGrade} sleeve condition`,
    `${item.year} ${item.country} pressing`,
    `${FORMAT_LABELS[item.format]} format`,
  ]

  if (item.catalogNumber) {
    highlights.push(`Catalog #: ${item.catalogNumber}`)
  }

  const seoKeywords = [
    item.artistName.toLowerCase(),
    item.releaseTitle.toLowerCase(),
    'vinyl',
    'record',
    FORMAT_LABELS[item.format].toLowerCase(),
    item.country.toLowerCase(),
    item.year.toString(),
  ]

  if (item.catalogNumber) {
    seoKeywords.push(item.catalogNumber.toLowerCase())
  }

  return {
    itemId: item.id,
    title,
    description,
    conditionSummary,
    highlights,
    seoKeywords
  }
}
