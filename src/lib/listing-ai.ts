import { CollectionItem, MediaGrade, PriceEstimate, ItemImage } from './types'
import { ABTest } from './ab-testing-types'
import { analyzeWinningPatterns, generateOptimizedTitleFromPatterns } from './title-pattern-optimizer'

declare const spark: Window['spark']

export async function generateSEOKeywords(
  item: CollectionItem,
  channel: 'ebay' | 'discogs' | 'shopify'
): Promise<string[]> {
  const baseKeywords: string[] = []

  baseKeywords.push(item.artistName)
  baseKeywords.push(item.releaseTitle)
  baseKeywords.push(item.format)
  baseKeywords.push(`${item.year}`)
  baseKeywords.push(item.country)

  if (item.catalogNumber) {
    baseKeywords.push(item.catalogNumber)
  }

  baseKeywords.push('vinyl')
  baseKeywords.push('record')
  
  if (item.format === 'LP') {
    baseKeywords.push('LP', 'album')
  } else if (item.format === '7in') {
    baseKeywords.push('7"', '45', 'single')
  } else if (item.format === '12in') {
    baseKeywords.push('12"', 'maxi single')
  }

  if (item.condition.mediaGrade === 'M' || item.condition.mediaGrade === 'NM') {
    baseKeywords.push('mint', 'near mint', 'clean')
  } else if (item.condition.mediaGrade === 'EX') {
    baseKeywords.push('excellent', 'great condition')
  }

  if (item.year < 1970) {
    baseKeywords.push('vintage', 'original pressing', 'classic')
  } else if (item.year < 1980) {
    baseKeywords.push('70s', 'classic')
  } else if (item.year < 1990) {
    baseKeywords.push('80s')
  }

  const genreKeywords = inferGenreKeywords(item.artistName)
  baseKeywords.push(...genreKeywords)

  if (channel === 'ebay') {
    baseKeywords.push('collector', 'collectible')
    if (item.year < 1975) {
      baseKeywords.push('rare')
    }
  }

  try {
    const prompt = spark.llmPrompt`You are an SEO expert specializing in vinyl record marketplace listings.

Given this record:
- Artist: ${item.artistName}
- Title: ${item.releaseTitle}
- Year: ${item.year}
- Country: ${item.country}
- Format: ${item.format}
- Catalog: ${item.catalogNumber || 'N/A'}

Generate 8-12 additional highly relevant SEO keywords that would help this listing be discovered by serious collectors and buyers on ${channel}.

Focus on:
- Genre and sub-genre terms
- Artist era or movement (e.g., "60s psychedelic", "80s new wave")
- Label significance (if recognizable catalog number)
- Pressing characteristics that collectors search for
- Musical style descriptors
- Collector terms (audiophile, first press, original, reissue, etc.)

Return ONLY a JSON array of keyword strings. Be specific and relevant - avoid generic terms.
Example: ["british invasion", "mod revival", "power pop", "jangle pop", "C86", "indie pop", "Sarah Records"]`

    const response = await spark.llm(prompt, 'gpt-4o-mini', true)
    const aiKeywords = JSON.parse(response) as string[]
    
    if (Array.isArray(aiKeywords) && aiKeywords.length > 0) {
      return [...new Set([...baseKeywords, ...aiKeywords])]
    }
  } catch (error) {
    console.error('AI keyword generation failed, using base keywords:', error)
  }

  return [...new Set(baseKeywords)]
}

function inferGenreKeywords(artistName: string): string[] {
  const lowerArtist = artistName.toLowerCase()
  
  const genreMap: Record<string, string[]> = {
    'beatles': ['rock', 'pop', 'british invasion', '60s'],
    'pink floyd': ['progressive rock', 'psychedelic', 'classic rock'],
    'david bowie': ['glam rock', 'art rock', 'classic rock'],
    'led zeppelin': ['hard rock', 'heavy metal', 'classic rock'],
    'miles davis': ['jazz', 'bebop', 'fusion'],
    'kraftwerk': ['electronic', 'krautrock', 'synth'],
    'joy division': ['post-punk', 'new wave', 'alternative'],
    'black sabbath': ['heavy metal', 'doom metal', 'hard rock'],
  }

  for (const [artist, genres] of Object.entries(genreMap)) {
    if (lowerArtist.includes(artist)) {
      return genres
    }
  }

  return ['rock', 'pop']
}

export async function generateListingCopy(
  item: CollectionItem,
  channel: 'ebay' | 'discogs' | 'shopify',
  keywords: string[],
  options?: {
    usePatternOptimization?: boolean
    completedABTests?: ABTest[]
    autoOptimizeEnabled?: boolean
  }
): Promise<{ title: string; subtitle?: string; description: string; usedPatternOptimization?: boolean }> {
  let optimizedTitle: string | null = null
  let usedPatternOptimization = false

  const shouldOptimize = options?.usePatternOptimization || options?.autoOptimizeEnabled

  if (shouldOptimize && options?.completedABTests && options.completedABTests.length > 0) {
    try {
      const analysis = await analyzeWinningPatterns(options.completedABTests)
      if (analysis.topPatterns.length > 0) {
        optimizedTitle = await generateOptimizedTitleFromPatterns(item, channel, analysis.topPatterns)
        usedPatternOptimization = true
      }
    } catch (error) {
      console.error('Failed to use pattern optimization, falling back to standard generation:', error)
    }
  }
  const titleInstruction = optimizedTitle 
    ? `USE THIS EXACT TITLE (already optimized from winning patterns): "${optimizedTitle}"`
    : `Generate a title following the requirements below`

  const prompt = spark.llmPrompt`You are an expert vinyl record dealer with 20+ years of experience creating high-converting marketplace listings that balance SEO optimization with authentic expertise.

ITEM DETAILS:
Artist: ${item.artistName}
Title: ${item.releaseTitle}
Format: ${item.format}
Year: ${item.year}
Country: ${item.country}
Catalog Number: ${item.catalogNumber || 'N/A'}
Media Grade: ${item.condition.mediaGrade} (${item.condition.gradingStandard} Standard)
Sleeve Grade: ${item.condition.sleeveGrade} (${item.condition.gradingStandard} Standard)
Condition Notes: ${item.condition.gradingNotes || 'No additional notes'}

MARKETPLACE: ${channel.toUpperCase()}
TARGET KEYWORDS: ${keywords.join(', ')}

LISTING TITLE REQUIREMENTS:
${titleInstruction}
- Maximum 80 characters for eBay (critical for mobile visibility)
- Include: Artist, Title, Format, Year OR Catalog Number (not both - space is limited)
- Include condition grade if space allows (e.g., "VG+/VG")
- Use title case capitalization
- Front-load most important keywords (artist/title first)
- Avoid filler words like "Rare", "Wow", "Look", "L@@K"
- Examples:
  * "Beatles - Sgt Pepper LP UK 1st Press PCS 7027 1967 NM/EX Stereo"
  * "Pink Floyd Dark Side of the Moon LP 1973 Harvest SHVL 804 VG+/VG+"
  * "Miles Davis Kind of Blue LP Columbia CS 8163 1959 6-Eye EX/VG+"

SUBTITLE REQUIREMENTS (eBay only, 55 char max):
- Add secondary details not in title
- Highlight pressing uniqueness: "Original 1st Press", "Rare Promo Copy", "Gatefold Sleeve"
- Or condition highlights: "Near Mint Media", "Clean Labels", "No Splits"
- Examples: "Original UK 1st Pressing | Gatefold Sleeve", "6-Eye Label | Mono Mix | Superb Copy"

DESCRIPTION REQUIREMENTS:
Write a compelling 4-6 paragraph description that converts browsers into buyers:

PARAGRAPH 1 - Opening Hook (2-3 sentences):
- Lead with why this record matters (classic album, landmark pressing, collectible label)
- Mention artist significance or album cultural impact
- Create desire without hyperbole
- Example: "An exceptional copy of one of jazz's most influential albums. This is the original 6-eye Columbia pressing from 1959, featuring the iconic Kind of Blue sessions that revolutionized modal jazz."

PARAGRAPH 2 - Pressing Details (3-4 sentences):
- Specify exact pressing (1st press, reissue, country of manufacture)
- Catalog number and label details
- Format specifics (mono/stereo, gatefold, inserts, poster)
- Any pressing-specific features (matrix codes, label variants, unique details)
- Example: "This is the UK first pressing on Harvest Records (catalog SHVL 804), identifiable by the original solid blue triangle label and gatefold cover with poster and stickers included. Matrix numbers: A2/B2. All components are present and correct."

PARAGRAPH 3 - Condition Description (4-5 sentences):
- Be specific and honest about media condition
- Describe sleeve condition in detail
- Mention any defects clearly and their severity
- Reference the grading standard used
- Use collector language: "spindle trails", "light surface marks", "minor edge wear", "seam intact"
- Example: "Media grades ${item.condition.mediaGrade} with light surface marks that do not affect playback. Labels are clean with minimal spindle wear. Sleeve grades ${item.condition.sleeveGrade} with light ringwear to front cover and minor corner bumping. All seams are intact with no splits. Graded conservatively using ${item.condition.gradingStandard} standards."

PARAGRAPH 4 - Additional Notes & Closing (2-3 sentences):
- Any other relevant details from condition notes
- Professional closing about packaging/shipping care
- Invitation to ask questions
- Example: "This record has been stored in a smoke-free environment in protective inner sleeves. Will be shipped in a professional record mailer with cardboard stiffeners for maximum protection. Please don't hesitate to contact me with any questions."

TONE GUIDELINES:
- Professional but personable
- Confident without being pushy
- Honest about condition (builds trust)
- Knowledgeable (use proper terminology)
- Avoid: exclamation marks, all caps, excessive adjectives, clichés
- Good words: exceptional, excellent, classic, original, authentic, clean, well-preserved
- Avoid: rare!!, WOW, LOOK, amazing!!!, MINT (unless truly mint)

Return valid JSON with keys: title, subtitle (string or null), description

CRITICAL: Ensure title is exactly 80 characters or less. Ensure subtitle is 55 characters or less. Be honest about condition - over-grading damages reputation.`

  try {
    const response = await spark.llm(prompt, 'gpt-4o', true)
    const parsed = JSON.parse(response)
    
    return {
      title: optimizedTitle || parsed.title || generateFallbackTitle(item),
      subtitle: parsed.subtitle,
      description: parsed.description || generateFallbackDescription(item),
      usedPatternOptimization,
    }
  } catch (error) {
    console.error('LLM generation failed, using fallback:', error)
    return {
      title: optimizedTitle || generateFallbackTitle(item),
      subtitle: channel === 'ebay' ? `${item.condition.mediaGrade}/${item.condition.sleeveGrade} ${item.format} ${item.year}` : undefined,
      description: generateFallbackDescription(item),
      usedPatternOptimization,
    }
  }
}

function generateFallbackTitle(item: CollectionItem): string {
  const parts = [
    item.artistName,
    '-',
    item.releaseTitle,
    item.format,
  ]

  if (item.catalogNumber) {
    parts.push(item.catalogNumber)
  }

  parts.push(`${item.year}`)
  parts.push(`${item.condition.mediaGrade}/${item.condition.sleeveGrade}`)

  return parts.join(' ').substring(0, 80)
}

function generateFallbackDescription(item: CollectionItem): string {
  return `${item.artistName} - ${item.releaseTitle}

Format: ${item.format}
Year: ${item.year}
Country: ${item.country}
${item.catalogNumber ? `Catalog Number: ${item.catalogNumber}` : ''}

Condition:
Media: ${item.condition.mediaGrade} (${item.condition.gradingStandard} Standard)
Sleeve: ${item.condition.sleeveGrade} (${item.condition.gradingStandard} Standard)

${item.condition.gradingNotes ? `Notes: ${item.condition.gradingNotes}` : ''}

This record has been carefully graded using the ${item.condition.gradingStandard} grading standard. Please review the condition details before purchasing.

${item.notes ? `Additional Information:\n${item.notes}` : ''}

Shipping: We package all records with care using proper mailers and protection.

Thank you for your interest!`
}

export function suggestListingPrice(estimate: PriceEstimate, condition: MediaGrade): number {
  const conditionMultipliers: Record<string, number> = {
    'M': 1.25,
    'NM': 1.15,
    'EX': 1.0,
    'VG+': 0.90,
    'VG': 0.75,
    'G': 0.60,
    'F': 0.45,
    'P': 0.25,
  }

  const multiplier = conditionMultipliers[condition] || 1.0
  const conditionAdjustedPrice = estimate.estimateMid * multiplier

  const negotiationBuffer = 1.10
  const marketingPrice = conditionAdjustedPrice * negotiationBuffer

  const roundedPrice = Math.round(marketingPrice * 100) / 100

  if (roundedPrice >= 100) {
    return Math.round(roundedPrice / 5) * 5
  } else if (roundedPrice >= 20) {
    return Math.round(roundedPrice)
  } else {
    return Math.round(roundedPrice * 4) / 4
  }
}

export function generateEbayHTMLDescription(
  item: CollectionItem,
  description: string,
  hostedImages: ItemImage[]
): string {
  const imagesWithUrls = hostedImages.filter(img => img.imgbbUrl || img.imgbbDisplayUrl)
  
  const imageGalleryHTML = imagesWithUrls.length > 0 ? `
    <div style="margin: 30px 0; text-align: center; background: #f8f9fa; padding: 20px; border-radius: 8px;">
      <h3 style="margin: 0 0 20px 0; color: #222; font-size: 20px; font-weight: 600; text-align: center;">📸 Photo Gallery</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; max-width: 900px; margin: 0 auto;">
        ${imagesWithUrls.map((img, idx) => `
          <div style="border: 2px solid #ddd; border-radius: 8px; padding: 10px; background: #fff; transition: transform 0.2s;">
            <img src="${img.imgbbDisplayUrl || img.imgbbUrl}" alt="${img.type.replace('_', ' ')} - Image ${idx + 1}" style="width: 100%; height: auto; display: block; border-radius: 4px; max-height: 300px; object-fit: contain;" />
            <p style="margin: 10px 0 0 0; font-size: 12px; color: #666; text-transform: capitalize; font-weight: 500;">${img.type.replace(/_/g, ' ')}</p>
          </div>
        `).join('')}
      </div>
    </div>
  ` : ''

  const conditionHTML = `
    <div style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border: 3px solid #2c3e50; border-radius: 12px; padding: 25px; margin: 30px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <h3 style="margin: 0 0 20px 0; color: #2c3e50; font-size: 22px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 1px;">🎵 Condition Details</h3>
      <table style="width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden;">
        <tr style="background: #34495e;">
          <td style="padding: 15px; font-weight: 700; width: 40%; color: #fff; border-bottom: 2px solid #2c3e50;">Media Grade:</td>
          <td style="padding: 15px; color: #fff; font-weight: 600; border-bottom: 2px solid #2c3e50;">${item.condition.mediaGrade}</td>
        </tr>
        <tr style="background: #ecf0f1;">
          <td style="padding: 15px; font-weight: 700; border-bottom: 1px solid #bdc3c7;">Sleeve Grade:</td>
          <td style="padding: 15px; border-bottom: 1px solid #bdc3c7;">${item.condition.sleeveGrade}</td>
        </tr>
        <tr style="background: #fff;">
          <td style="padding: 15px; font-weight: 700; border-bottom: 1px solid #bdc3c7;">Grading Standard:</td>
          <td style="padding: 15px; border-bottom: 1px solid #bdc3c7;">${item.condition.gradingStandard}</td>
        </tr>
        ${item.condition.gradingNotes ? `
        <tr style="background: #ecf0f1;">
          <td style="padding: 15px; font-weight: 700; vertical-align: top;">Grading Notes:</td>
          <td style="padding: 15px; line-height: 1.6;">${item.condition.gradingNotes}</td>
        </tr>
        ` : ''}
      </table>
    </div>
  `

  const recordDetailsHTML = `
    <div style="background: #fff; border: 2px solid #3498db; border-radius: 12px; padding: 25px; margin: 30px 0; box-shadow: 0 4px 6px rgba(52,152,219,0.2);">
      <h3 style="margin: 0 0 20px 0; color: #3498db; font-size: 22px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 1px;">💿 Record Information</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background: #ecf0f1;">
          <td style="padding: 15px; font-weight: 700; width: 40%; border-bottom: 1px solid #bdc3c7;">Artist:</td>
          <td style="padding: 15px; border-bottom: 1px solid #bdc3c7; font-size: 16px;">${item.artistName}</td>
        </tr>
        <tr style="background: #fff;">
          <td style="padding: 15px; font-weight: 700; border-bottom: 1px solid #bdc3c7;">Title:</td>
          <td style="padding: 15px; border-bottom: 1px solid #bdc3c7; font-size: 16px;">${item.releaseTitle}</td>
        </tr>
        <tr style="background: #ecf0f1;">
          <td style="padding: 15px; font-weight: 700; border-bottom: 1px solid #bdc3c7;">Format:</td>
          <td style="padding: 15px; border-bottom: 1px solid #bdc3c7;">${item.format}</td>
        </tr>
        <tr style="background: #fff;">
          <td style="padding: 15px; font-weight: 700; border-bottom: 1px solid #bdc3c7;">Year:</td>
          <td style="padding: 15px; border-bottom: 1px solid #bdc3c7;">${item.year}</td>
        </tr>
        <tr style="background: #ecf0f1;">
          <td style="padding: 15px; font-weight: 700; border-bottom: 1px solid #bdc3c7;">Country:</td>
          <td style="padding: 15px; border-bottom: 1px solid #bdc3c7;">${item.country}</td>
        </tr>
        ${item.catalogNumber ? `
        <tr style="background: #fff;">
          <td style="padding: 15px; font-weight: 700;">Catalog Number:</td>
          <td style="padding: 15px; font-family: 'Courier New', monospace; background: #f8f9fa; border-radius: 4px;">${item.catalogNumber}</td>
        </tr>
        ` : ''}
      </table>
    </div>
  `

  const fullHTML = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 30px 20px; color: #2c3e50; background: #fff; line-height: 1.8;">
      
      <div style="text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 40px 20px; border-radius: 12px; margin-bottom: 40px; box-shadow: 0 6px 12px rgba(0,0,0,0.15);">
        <h1 style="margin: 0 0 10px 0; font-size: 32px; font-weight: 700; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">
          ${item.artistName}
        </h1>
        <h2 style="margin: 0; font-size: 24px; font-weight: 400; opacity: 0.95;">
          ${item.releaseTitle}
        </h2>
        <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid rgba(255,255,255,0.3);">
          <span style="display: inline-block; background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px; font-size: 14px; margin: 0 5px;">
            ${item.format}
          </span>
          <span style="display: inline-block; background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px; font-size: 14px; margin: 0 5px;">
            ${item.year}
          </span>
          <span style="display: inline-block; background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px; font-size: 14px; margin: 0 5px;">
            ${item.country}
          </span>
        </div>
      </div>
      
      ${imageGalleryHTML}
      
      <div style="margin: 40px 0; padding: 30px; background: #f8f9fa; border-left: 5px solid #3498db; border-radius: 8px;">
        <h3 style="margin: 0 0 20px 0; color: #2c3e50; font-size: 20px; font-weight: 600;">📝 Description</h3>
        ${(description || '').split('\n\n').map(para => para.trim() ? `<p style="margin: 15px 0; font-size: 15px; line-height: 1.8; color: #34495e;">${para}</p>` : '').join('')}
      </div>
      
      ${recordDetailsHTML}
      
      ${conditionHTML}
      
      <div style="background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%); border: 2px solid #e17055; border-radius: 12px; padding: 25px; margin: 30px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h3 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 18px; font-weight: 700; text-align: center;">📦 Shipping & Handling</h3>
        <p style="margin: 10px 0; font-size: 15px; text-align: center; color: #2c3e50; line-height: 1.6;">
          <strong>All vinyl records are carefully packaged</strong> using professional record mailers, protective sleeves, and cardboard stiffeners to ensure safe delivery. We ship within 1-2 business days of receiving payment.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 50px; padding-top: 30px; border-top: 3px solid #ecf0f1;">
        <p style="color: #7f8c8d; font-size: 14px; margin: 5px 0;">
          ✨ Thank you for your interest in this record! ✨
        </p>
        <p style="color: #95a5a6; font-size: 13px; margin: 10px 0;">
          Please don't hesitate to ask if you have any questions.
        </p>
        <div style="margin-top: 20px; padding: 15px; background: #ecf0f1; border-radius: 8px; display: inline-block;">
          <p style="margin: 0; color: #2c3e50; font-weight: 600; font-size: 14px;">
            🎧 Happy collecting! 🎧
          </p>
        </div>
      </div>
      
    </div>
  `

  return fullHTML
}

export async function generateBulkListings(
  items: CollectionItem[],
  channel: 'ebay' | 'discogs' | 'shopify'
): Promise<Array<{ itemId: string; title: string; description: string; price: number }>> {
  const listings: Array<{ itemId: string; title: string; description: string; price: number }> = []

  for (const item of items) {
    const keywords = await generateSEOKeywords(item, channel)
    const copy = await generateListingCopy(item, channel, keywords)
    const estimate = { estimateMid: 50, currency: item.purchaseCurrency } as PriceEstimate
    const price = suggestListingPrice(estimate, item.condition.mediaGrade)

    listings.push({
      itemId: item.id,
      title: copy.title,
      description: copy.description,
      price,
    })
  }

  return listings
}

export interface EbayListingPackage {
  title: string
  subtitle?: string
  htmlDescription: string
  plainDescription: string
  price: number
  currency: string
  imageUrls: string[]
  seoKeywords: string[]
  condition: {
    media: string
    sleeve: string
  }
  requiresImgBBUpload: boolean
  missingImageCount: number
}

export async function generateEbayListingPackage(
  item: CollectionItem,
  images: ItemImage[],
  channel: 'ebay' | 'discogs' | 'shopify' = 'ebay'
): Promise<EbayListingPackage> {
  const keywords = await generateSEOKeywords(item, channel)
  const copy = await generateListingCopy(item, channel, keywords)
  const estimate = { estimateMid: 50, currency: item.purchaseCurrency } as PriceEstimate
  const price = suggestListingPrice(estimate, item.condition.mediaGrade)

  const hostedImages = images.filter(img => img.imgbbUrl || img.imgbbDisplayUrl)
  const unhostedImages = images.filter(img => !img.imgbbUrl && !img.imgbbDisplayUrl)
  
  const imageUrls = hostedImages.map(img => img.imgbbDisplayUrl || img.imgbbUrl || '').filter(Boolean)
  
  const htmlDescription = generateEbayHTMLDescription(item, copy.description, hostedImages)

  return {
    title: copy.title,
    subtitle: copy.subtitle,
    htmlDescription,
    plainDescription: copy.description,
    price,
    currency: item.purchaseCurrency,
    imageUrls,
    seoKeywords: keywords,
    condition: {
      media: item.condition.mediaGrade,
      sleeve: item.condition.sleeveGrade
    },
    requiresImgBBUpload: unhostedImages.length > 0,
    missingImageCount: unhostedImages.length
  }
}
