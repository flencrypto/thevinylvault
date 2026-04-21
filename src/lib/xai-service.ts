export interface RecordAnalysisResult {
  artist: string | null
  title: string | null
  catalogueNumber: string | null
  label: string | null
  barcode: string | null
  matrixRunoutA: string | null
  matrixRunoutB: string | null
  year: number | null
  country: string | null
  format: string | null
  genre: string | null
  conditionEstimate: string | null
  pressingInfo: string | null
  pressingType: 'first_press' | 'repress' | 'reissue' | 'unknown'
  confidence: 'high' | 'medium' | 'low'
  notes: string[]
}

export class XAIService {
  private apiKey: string | null
  private model: string
  private baseUrl: string

  constructor() {
    this.apiKey = null
    this.model = 'grok-4-1-fast-reasoning'
    this.baseUrl = 'https://api.x.ai/v1'
    this.loadCredentialsFromStorage()
  }

  /**
   * Load xAI credentials from localStorage, with Spark KV fallback.
   *
   * Priority:
   *  1. Direct keys: 'xai_api_key' and 'xai_model'
   *  2. Fallback: Spark KV object with camelCase keys (xaiApiKey, xaiModel)
   */
  private loadCredentialsFromStorage() {
    try {
      // Primary: direct keys, as originally implemented
      const directApiKey = localStorage.getItem('xai_api_key')
      const directModel = localStorage.getItem('xai_model')

      if (directApiKey) {
        this.apiKey = directApiKey
      }
      if (directModel) {
        this.model = directModel
      }

      // Fallback: try to hydrate from Spark KV via globalThis
      if (!directApiKey || !directModel) {
        void this._syncFromKv()
      }
    } catch {
      // If anything goes wrong, fall back to defaults
    }
  }

  private async _syncFromKv(): Promise<void> {
    const sparkKv = (globalThis as any)?.spark?.kv
    if (!sparkKv || typeof sparkKv.get !== 'function') return

    try {
      const raw = await sparkKv.get('vinyl-vault-api-keys')
      if (!raw) return

      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (!parsed || typeof parsed !== 'object') return

      // SettingsView stores camelCase keys at the top level
      if (!this.apiKey && typeof parsed.xaiApiKey === 'string') {
        this.apiKey = parsed.xaiApiKey
        localStorage.setItem('xai_api_key', parsed.xaiApiKey)
      }
      if (typeof parsed.xaiModel === 'string' && parsed.xaiModel) {
        this.model = parsed.xaiModel
        localStorage.setItem('xai_model', parsed.xaiModel)
      }
    } catch {
      // Ignore KV errors
    }
  }

  updateApiKey(key: string) {
    this.apiKey = key
    // Keep direct key for backwards compatibility
    localStorage.setItem('xai_api_key', key)

    // Sync to Spark KV using camelCase schema (matches SettingsView)
    const sparkKv = (globalThis as any)?.spark?.kv
    if (sparkKv && typeof sparkKv.get === 'function') {
      void (sparkKv.get('vinyl-vault-api-keys') as Promise<Record<string, unknown>>)
        .then((raw) => {
          const kv = raw && typeof raw === 'object' ? raw : {}
          return sparkKv.set('vinyl-vault-api-keys', { ...kv, xaiApiKey: key })
        })
        .catch(() => { /* Ignore KV sync errors */ })
    }
  }

  updateModel(model: string) {
    this.model = model
    // Keep direct key for backwards compatibility
    localStorage.setItem('xai_model', model)

    // Sync to Spark KV using camelCase schema (matches SettingsView)
    const sparkKv = (globalThis as any)?.spark?.kv
    if (sparkKv && typeof sparkKv.get === 'function') {
      void (sparkKv.get('vinyl-vault-api-keys') as Promise<Record<string, unknown>>)
        .then((raw) => {
          const kv = raw && typeof raw === 'object' ? raw : {}
          return sparkKv.set('vinyl-vault-api-keys', { ...kv, xaiModel: model })
        })
        .catch(() => { /* Ignore KV sync errors */ })
    }
  }

  get isConfigured(): boolean {
    return !!this.apiKey
  }

  async getRuntimeConfig(): Promise<{ apiKey: string | null; model: string; baseUrl: string }> {
    await this._syncFromKv()
    return {
      apiKey: this.apiKey,
      model: this.model,
      baseUrl: this.baseUrl,
    }
  }

  isVisionModel(modelName: string): boolean {
    if (!modelName) return false
    const name = modelName.toLowerCase()
    return name.startsWith('grok-4') || name.includes('vision')
  }

  private async parseError(response: Response, fallbackMessage: string): Promise<string> {
    const rawBody = await response.text()
    if (!rawBody) {
      return fallbackMessage
    }
    try {
      const parsed = JSON.parse(rawBody)
      return parsed.error?.message || parsed.message || fallbackMessage
    } catch {
      return rawBody
    }
  }

  async analyzeRecordImages(imageFiles: File[]): Promise<RecordAnalysisResult> {
    if (!this.apiKey) {
      throw new Error('xAI API key not configured. Please add it in Settings.')
    }

    if (!this.isVisionModel(this.model)) {
      throw new Error(
        'Selected xAI model does not support image analysis. Please choose a vision-capable model (e.g. grok-4-1-fast-reasoning) in Settings.'
      )
    }

    const base64Images = await Promise.all(
      imageFiles.map((file) => this.fileToBase64(file))
    )

    const messages = [
      {
        role: 'system',
        content: `You are a vinyl record identification expert with deep knowledge of pressing identification, label history, and matrix/runout groove systems. Analyse record images thoroughly and extract ALL visible text and identifiers.

CRITICAL - Pressing Identification Rules:

1. DEADWAX/MATRIX ANALYSIS IS ESSENTIAL:
   - Capture Side A and Side B matrix strings separately
   - If only one label/side is shown, determine which side (look for "Side 1"/"Side 2", "A"/"B", or the side number printed on the label) and store in the correct field (matrixRunoutA for Side 1/A, matrixRunoutB for Side 2/B)
   - UK EMI/Parlophone matrix system: XEX, YEX, ZEX, AAX, BBX prefixes. Stamper suffixes are critical — "1N" = first stamper/earliest pressing; "2N", "3N", etc. = later stampers (higher number = further from first press). Only "-1N" or "-2N" stampers qualify as first or second pressing.
   - "(XEX.504)" printed ON the label text is a LABEL CODE identifying the matrix side — store this in "labelCode". The actual deadwax matrix etched/stamped in the runout groove (e.g. "XEX 504-3N") is the true matrix — store in matrixRunoutA or matrixRunoutB.
   - US plant identifiers in deadwax: "STERLING", "RL" (Robert Ludwig), "PORKY" / "PORKY PRIME CUT" (George Peckham), "TML", "DR", "MR", "W", "PR"
   - Mastering engineer initials or hand-etched signatures
   - "A1"/"B1" cut suffix = first stamper (first pressing); A2/B2 = second stamper, etc.

2. LABEL ANALYSIS for pressing identification:
   - Read ALL text on the label including fine print, rim text, and addresses
   - UK catalogue number prefixes: PMC = Parlophone Mono Catalogue, PCS = Parlophone Columbia Stereo, R = HMV (mono), CSD = HMV (stereo), SCX/SX = Columbia, MONO/STEREO explicit markings
   - Label design eras: e.g. Parlophone black/yellow logo (1960s UK original) vs later designs
   - Address changes on labels indicate different pressing periods
   - "Made in Gt. Britain" / "Made in England" / "Made in U.K." = UK pressing
   - "SOLD IN U.K. SUBJECT TO RESALE PRICE CONDITIONS" = UK original pressing (pre-RPM abolition, before 1964)
   - "RECORDING FIRST PUBLISHED [YEAR]" printed on label = original release year
   - Rights societies: NCB, BIEM, MCPS, ASCAP, BMI, SOCAN
   - Stereo/mono indicators and their placement

3. SLEEVE/COVER indicators:
   - Barcode presence = likely 1980s+ reissue (originals often lack barcodes)
   - Price codes (UK: K/T/S prefixes, US: $ prices)
   - Laminated vs non-laminated sleeves
   - "Digital Remaster", "180g", "Half-Speed Mastered" stickers = modern reissue

4. TRACKLIST EXTRACTION:
   - If track titles are visible on the label or sleeve, extract them as an array
   - Include track numbers and side indicators if visible

5. YEAR vs ORIGINAL YEAR distinction:
   - "RECORDING FIRST PUBLISHED [YEAR]" on label = original release year
   - Sleeve may show original release year; label/barcode may reveal actual pressing year
   - Catalogue number patterns indicate era

Return ONLY a valid JSON object with this exact structure:
{
  "artist": "string or null",
  "title": "string or null",
  "catalogueNumber": "string or null",
  "label": "string or null",
  "barcode": "string or null",
  "matrixRunoutA": "string or null (Side A/1 deadwax matrix exactly as etched)",
  "matrixRunoutB": "string or null (Side B/2 deadwax matrix exactly as etched)",
  "labelCode": "string or null (e.g. label-printed codes like XEX.504, distinct from deadwax)",
  "rightsSociety": "string or null",
  "pressingPlant": "string or null",
  "labelRimText": "string or null (full text on the label rim/edge)",
  "identifierStrings": ["array", "of", "all", "raw", "identifiers", "visible"],
  "tracklist": ["array of track titles in order, or empty array if none visible"],
  "year": 1964,
  "originalYear": 1964,
  "reissueYear": null,
  "country": "string or null",
  "format": "string or null (LP, 12\\", 7\\", EP, etc.)",
  "genre": "string or null",
  "conditionEstimate": "string or null (NM/VG+/VG/G+/G/F)",
  "pressingInfo": "string or null (human-readable summary of all matrix/runout details)",
  "isFirstPress": null,
  "pressingType": "string or null ('first_press', 'early_press', 'repress', 'reissue', 'unknown')",
  "pressingConfidence": "string ('high', 'medium', 'low')",
  "pressingEvidence": ["array of specific visual evidence strings"],
  "confidence": "high|medium|low",
  "notes": ["array of additional observations"]
}

Be thorough and precise. Read every visible character. For pressing identification, correctly interpret stamper suffixes: 1N/A1/B1 = first press; higher numbers = later. State the exact matrix string found.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyse these record photos. Read ALL visible text carefully including fine print, rim text, and any etching in the deadwax/runout area. Identify the artist, title, catalogue number, label, year, and tracklist. CRITICALLY: determine which side(s) are shown, extract the exact deadwax/matrix strings for each side separately, interpret the stamper suffix to assess pressing generation, and classify the pressing type. Report every identifier string you can read.',
          },
          ...base64Images.map((base64) => ({
            type: 'image_url' as const,
            image_url: {
              url: `data:image/jpeg;base64,${base64}`,
              detail: 'high' as const,
            },
          })),
        ],
      },
    ]

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          max_tokens: 3000,
          temperature: 0.2,
        }),
      })

      if (!response.ok) {
        const errorMessage = await this.parseError(response, 'xAI analysis failed')
        throw new Error(errorMessage)
      }

      const data = await response.json()
      const content = data.choices[0].message.content

      const jsonMatch = content.match(
        /```json\s*([\s\S]*?)\s*```|(\{[\s\S]*\})/
      )
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[2] : content

      try {
        return JSON.parse(jsonStr.trim())
      } catch {
        console.error('Failed to parse xAI response:', content)
        throw new Error('Failed to parse record data')
      }
    } catch (error) {
      console.error('xAI Analysis Error:', error)
      throw error
    }
  }

  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }
}

export const xaiService = new XAIService()
