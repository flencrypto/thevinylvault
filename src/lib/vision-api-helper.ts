/**
 * Shared helper for making vision-capable LLM API calls with actual image data.
 *
 * Priority order:
 *  1. xAI (Grok) – vision-capable models that accept multimodal input
 *  2. DeepSeek – fallback vision provider
 *  3. spark.llm – text-only fallback (images are NOT sent; degraded experience)
 */

const KV_STORAGE_KEY = 'vinyl-vault-api-keys'

interface VisionCredentials {
  apiKey: string
  model: string
  baseUrl: string
  provider: 'xai' | 'deepseek'
}

/**
 * Resolve the best available vision API credentials from localStorage / Spark KV.
 * Returns null when no external vision API is configured.
 */
function getVisionCredentials(): VisionCredentials | null {
  try {
    // 1. Try xAI
    const xaiKey = localStorage.getItem('xai_api_key')
    if (xaiKey) {
      const model = localStorage.getItem('xai_model') || 'grok-4-1-fast-reasoning'
      return { apiKey: xaiKey, model, baseUrl: 'https://api.x.ai/v1', provider: 'xai' }
    }

    // 2. Try DeepSeek (only if it has a vision model)
    const deepseekKey = localStorage.getItem('deepseek_api_key')
    if (deepseekKey) {
      const model = localStorage.getItem('deepseek_model') || 'deepseek-chat'
      const isVision = model.toLowerCase().includes('vl') || model.toLowerCase().includes('vision')
      if (isVision) {
        return { apiKey: deepseekKey, model, baseUrl: 'https://api.deepseek.com/v1', provider: 'deepseek' }
      }
    }
  } catch {
    // localStorage may not be available
  }
  return null
}

/**
 * Async fallback: resolve credentials from Spark KV when localStorage is empty.
 * Mirrors the pattern used in XAIService._syncFromKv() and DeepSeekService.syncFromKv().
 * Also hydrates localStorage so subsequent synchronous reads succeed.
 */
async function getVisionCredentialsFromKv(): Promise<VisionCredentials | null> {
  const sparkKv = (globalThis as any)?.spark?.kv
  if (!sparkKv || typeof sparkKv.get !== 'function') return null

  try {
    const raw = await sparkKv.get(KV_STORAGE_KEY)
    if (!raw) return null

    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!parsed || typeof parsed !== 'object') return null

    // Hydrate all API keys into localStorage so services can read them synchronously
    const hydrateKey = (localKey: string, value: unknown) => {
      if (typeof value === 'string' && value) {
        localStorage.setItem(localKey, value)
      }
    }
    hydrateKey('openai_api_key', parsed.openaiKey)
    hydrateKey('discogs_consumer_key', parsed.discogsKey)
    hydrateKey('discogs_consumer_secret', parsed.discogsSecret)
    hydrateKey('discogs_personal_token', parsed.discogsUserToken)
    hydrateKey('ebay_client_id', parsed.ebayClientId)
    hydrateKey('ebay_app_id', parsed.ebayClientId)
    hydrateKey('ebay_client_secret', parsed.ebayClientSecret)
    hydrateKey('ebay_dev_id', parsed.ebayDevId)
    hydrateKey('imgbb_api_key', parsed.imgbbKey)
    hydrateKey('deepseek_api_key', parsed.deepseekApiKey)
    hydrateKey('telegram_bot_token', parsed.telegramBotToken)
    hydrateKey('telegram_chat_id', parsed.telegramChatId)
    hydrateKey('pinata_jwt', parsed.pinataJwt)

    // 1. Try xAI from KV (camelCase keys as stored by SettingsView)
    if (typeof parsed.xaiApiKey === 'string' && parsed.xaiApiKey) {
      const model = (typeof parsed.xaiModel === 'string' && parsed.xaiModel) || 'grok-4-1-fast-reasoning'
      // Hydrate localStorage for future synchronous reads
      localStorage.setItem('xai_api_key', parsed.xaiApiKey)
      localStorage.setItem('xai_model', model)
      return { apiKey: parsed.xaiApiKey, model, baseUrl: 'https://api.x.ai/v1', provider: 'xai' }
    }

    // 2. Try DeepSeek from KV (only if vision model)
    const deepseekKey = typeof parsed.deepseekApiKey === 'string' ? parsed.deepseekApiKey : null
    if (deepseekKey) {
      const model = (typeof parsed.deepseekModel === 'string' && parsed.deepseekModel) || 'deepseek-chat'
      const isVision = model.toLowerCase().includes('vl') || model.toLowerCase().includes('vision')
      if (isVision) {
        localStorage.setItem('deepseek_model', model)
        return { apiKey: deepseekKey, model, baseUrl: 'https://api.deepseek.com/v1', provider: 'deepseek' }
      }
    }
  } catch {
    // Ignore KV errors
  }
  return null
}

/**
 * Normalise an image source into a data-URL suitable for the OpenAI image_url format.
 * If already a valid data URL, returns it as-is. Otherwise treats the input as raw base64
 * and wraps it with a default image/jpeg MIME type.
 */
function toImageDataUrl(dataUrl: string): string {
  if (dataUrl.startsWith('data:')) {
    return dataUrl
  }
  return `data:image/jpeg;base64,${dataUrl}`
}

/**
 * Call a vision-capable LLM with images.
 *
 * @param systemPrompt – The system message describing the task
 * @param userPrompt   – The user message (textual instruction)
 * @param imageDataUrls – Array of data-URL strings (e.g. from FileReader.readAsDataURL)
 * @returns The raw text response from the model
 */
export async function callVisionModel(
  systemPrompt: string,
  userPrompt: string,
  imageDataUrls: string[]
): Promise<string> {
  // Try synchronous localStorage first, then async Spark KV fallback
  const creds = getVisionCredentials() || await getVisionCredentialsFromKv()

  if (creds) {
    return callExternalVisionAPI(creds, systemPrompt, userPrompt, imageDataUrls)
  }

  // Fallback: spark.llm (text-only – images are NOT sent)
  return callSparkLlmFallback(systemPrompt, userPrompt)
}

async function callExternalVisionAPI(
  creds: VisionCredentials,
  systemPrompt: string,
  userPrompt: string,
  imageDataUrls: string[]
): Promise<string> {
  const imageContent = imageDataUrls.map((dataUrl) => ({
    type: 'image_url' as const,
    image_url: {
      url: toImageDataUrl(dataUrl),
      detail: 'high' as const,
    },
  }))

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        ...imageContent,
      ],
    },
  ]

  const response = await fetch(`${creds.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${creds.apiKey}`,
    },
    body: JSON.stringify({
      model: creds.model,
      messages,
      max_tokens: 3000,
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    let msg = `Vision API (${creds.provider}) request failed: ${response.status}`
    try {
      const parsed = JSON.parse(body)
      msg = parsed.error?.message || parsed.message || msg
    } catch {
      if (body) msg = body
    }
    throw new Error(msg)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('Vision API returned empty response')
  }

  return content
}

async function callSparkLlmFallback(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const combinedPrompt = (spark as any).llmPrompt`${systemPrompt}\n\n${userPrompt}`
  return await (spark as any).llm(combinedPrompt, 'gpt-4o', true)
}

/**
 * Extract JSON from a model response that may be wrapped in markdown code fences.
 * Tries fenced blocks first, then falls back to finding the first balanced `{…}`.
 */
export function extractJSON(content: string): string {
  // 1. Prefer fenced JSON blocks
  const fenced = content.match(/```json\s*([\s\S]*?)\s*```/)
  if (fenced) return fenced[1].trim()

  // 2. Fall back to the first top-level `{…}` by finding balanced braces
  const start = content.indexOf('{')
  if (start === -1) return content.trim()

  let depth = 0
  for (let i = start; i < content.length; i++) {
    if (content[i] === '{') depth++
    else if (content[i] === '}') depth--
    if (depth === 0) {
      return content.substring(start, i + 1).trim()
    }
  }

  // Unbalanced braces – return from first `{` to end as a best effort
  return content.substring(start).trim()
}
