import type { RecordAnalysisResult } from './xai-service'

export type { RecordAnalysisResult }

export class DeepSeekService {
  private apiKey: string | null
  private model: string
  private baseUrl: string
  private readonly KV_STORAGE_KEY = 'vinyl-vault-api-keys'

  constructor() {
    this.apiKey = localStorage.getItem('deepseek_api_key')
    this.model = localStorage.getItem('deepseek_model') || 'deepseek-chat'
    this.baseUrl = 'https://api.deepseek.com/v1'

    // Best-effort sync of DeepSeek credentials from Spark KV into this service and localStorage.
    // This allows credentials entered in the Settings UI (which uses Spark KV) to be picked up here.
    void this.syncFromKv()
  }

  updateApiKey(key: string) {
    this.apiKey = key
    localStorage.setItem('deepseek_api_key', key)
    // Mirror changes into Spark KV so that Settings and this service stay in sync.
    void this.writeDeepSeekConfigToKv({ apiKey: key })
  }

  updateModel(model: string) {
    this.model = model
    localStorage.setItem('deepseek_model', model)
    // Mirror changes into Spark KV so that Settings and this service stay in sync.
    void this.writeDeepSeekConfigToKv({ model })
  }

  get isConfigured(): boolean {
    return !!this.apiKey
  }

  isVisionModel(modelName: string): boolean {
    if (!modelName) return false
    const normalized = modelName.toLowerCase()
    return normalized.includes('vl') || normalized.includes('vision')
  }

  private async syncFromKv(): Promise<void> {
    // Access Spark KV via globalThis to avoid relying on ambient type declarations.
    const sparkKv = (globalThis as any)?.spark?.kv
    if (!sparkKv || typeof sparkKv.get !== 'function') {
      return
    }

    try {
      const raw = await sparkKv.get(this.KV_STORAGE_KEY)
      if (!raw) return

      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (!parsed || typeof parsed !== 'object') return

      // SettingsView stores camelCase keys at the top level (e.g. deepseekApiKey)
      const kvApiKey = typeof parsed.deepseekApiKey === 'string' ? parsed.deepseekApiKey : null
      // Also support legacy nested format for backwards compatibility
      const legacyApiKey = parsed.deepseek?.apiKey
      const kvModel = typeof parsed.deepseekModel === 'string' ? parsed.deepseekModel : null
      const legacyModel = parsed.deepseek?.model

      const resolvedApiKey = kvApiKey || (typeof legacyApiKey === 'string' ? legacyApiKey : null)
      const resolvedModel = kvModel || (typeof legacyModel === 'string' ? legacyModel : null)

      if (resolvedApiKey) {
        this.apiKey = resolvedApiKey
        localStorage.setItem('deepseek_api_key', resolvedApiKey)
      }

      if (resolvedModel) {
        this.model = resolvedModel
        localStorage.setItem('deepseek_model', resolvedModel)
      }
    } catch {
      // Ignore KV errors; service will continue to rely on localStorage.
    }
  }

  private async writeDeepSeekConfigToKv(partial: { apiKey?: string; model?: string }): Promise<void> {
    const sparkKv = (globalThis as any)?.spark?.kv
    if (!sparkKv || typeof sparkKv.get !== 'function' || typeof sparkKv.set !== 'function') {
      return
    }

    try {
      const raw = await sparkKv.get(this.KV_STORAGE_KEY)
      const existing = raw
        ? (typeof raw === 'string' ? JSON.parse(raw) : raw)
        : {}

      const current = typeof existing === 'object' && existing !== null ? existing : {}

      // Store as top-level camelCase keys to align with SettingsView schema
      const updatedConfig = {
        ...current,
        ...(partial.apiKey !== undefined ? { deepseekApiKey: partial.apiKey } : {}),
        ...(partial.model !== undefined ? { deepseekModel: partial.model } : {})
      }

      await sparkKv.set(this.KV_STORAGE_KEY, updatedConfig)
    } catch {
      // Ignore KV errors; failure to persist to KV should not break normal operation.
    }
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
      throw new Error('DeepSeek API key not configured. Please add it in Settings.')
    }

    if (!this.isVisionModel(this.model)) {
      throw new Error(
        'Selected DeepSeek model does not support image analysis. Please choose a DeepSeek vision model (for example a VL model) or switch provider to OpenAI for OCR.'
      )
    }

    const base64Images = await Promise.all(
      imageFiles.map((file) => this.fileToBase64(file))
    )

    const messages = [
      {
        role: 'system',
        content: `You are a vinyl record identification expert specializing in pressing identification. Analyze record images and extract all visible information with special attention to first press vs reissue identification.

CRITICAL - Pressing Identification Rules:
1. DEADWAX/MATRIX ANALYSIS IS ESSENTIAL - Look for (capture Side A and Side B separately whenever possible):
   - Hand-etched vs machine-stamped matrix numbers (hand-etched often indicates early pressings)
   - Plant identifiers: "STERLING", "RL", "PORKY", "TML", "EMI", "CBS"
   - Mastering engineer initials or signatures
   - "A1", "B1" stampings indicate first stamper/cut
   - "-" or "/" separators in matrix numbers
   - Additional letters after main catalog number (e.g., "-A", "/1")

2. LABEL ANALYSIS for pressing identification:
   - Label design variations (logo style, color shades, rim text)
   - Address changes on labels (indicate different pressing periods)
   - "Made in..." country variations
   - Stereo/mono indicators and their placement
   - Copyright text differences

3. SLEEVE/COVER indicators:
   - Barcode presence = likely 1980s+ reissue (originals often lack barcodes)
   - Price codes (UK: K/T/S prefixes, US: $ prices)
   - Laminated vs non-laminated sleeves
   - "Digital Remaster" or "180g" stickers = modern reissue

4. YEAR vs ORIGINAL YEAR distinction:
   - Sleeve may show original release year
   - Label/barcode may reveal actual pressing year
   - Catalog number patterns indicate era

Return ONLY a JSON object with this exact structure:
{
  "artist": "string or null",
  "title": "string or null",
  "catalogueNumber": "string or null",
  "label": "string or null",
  "barcode": "string or null",
  "matrixRunoutA": "string or null",
  "matrixRunoutB": "string or null",
  "labelCode": "string or null",
  "rightsSociety": "string or null",
  "pressingPlant": "string or null",
  "labelRimText": "string or null",
  "identifierStrings": "array of strings (raw identifiers you can read, e.g., matrix/runout, barcode, label codes)",
  "year": "number or null (the pressing/year shown on this copy)",
  "originalYear": "number or null (if different from year, the original release year)",
  "reissueYear": "number or null (if this is a reissue, when it was reissued)",
  "country": "string or null",
  "format": "string or null (e.g., LP, 12\\", 7\\")",
  "genre": "string or null",
  "conditionEstimate": "string or null (NM/VG+/VG/G)",
  "pressingInfo": "string or null (full matrix/runout details as found)",
  "isFirstPress": "boolean or null (true if evidence suggests first pressing)",
  "pressingType": "string or null ('first_press', 'repress', 'reissue', 'unknown')",
  "pressingConfidence": "string ('high', 'medium', 'low' - how confident you are about pressing identification)",
  "pressingEvidence": "array of strings (specific visual evidence for pressing determination)",
  "confidence": "high|medium|low",
  "notes": "array of strings with additional observations"
}

Be precise. Only include info you can clearly read. For pressing identification, be conservative - only mark as first press if you see strong evidence (A1/B1 stampers, specific plant codes matching known first presses, etc.).`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze these record photos. Identify the artist, title, catalogue number, label, year, and CRITICALLY: examine the deadwax/matrix area and labels closely to determine if this is a first pressing, repress, or reissue. Explicitly extract Matrix Side A and Matrix Side B runouts separately whenever visible, and report any plant codes or label variations you can see.',
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
          max_tokens: 2000,
          temperature: 0.2,
        }),
      })

      if (!response.ok) {
        const errorMessage = await this.parseError(response, 'DeepSeek analysis failed')
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
        console.error('Failed to parse DeepSeek response:', content)
        throw new Error('Failed to parse record data')
      }
    } catch (error) {
      console.error('DeepSeek Analysis Error:', error)
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

export const deepSeekService = new DeepSeekService()
