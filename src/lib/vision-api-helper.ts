/**
 * Shared helper for making vision-capable LLM API calls with actual image data.
 *
 * Priority order:
 *  1. xAI (Grok) – vision-capable models that accept multimodal input
 *  2. DeepSeek – fallback vision provider
 *  3. spark.llm – text-only fallback (images are NOT sent; degraded experience)
 */

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
 * Extract the raw base64 payload from a data-URL string.
 * Returns the portion after "base64," so it can be used directly in image_url content.
 */
function dataUrlToBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf('base64,')
  if (idx !== -1) {
    return dataUrl.substring(idx + 7)
  }
  return dataUrl
}

/**
 * Detect the MIME type from a data-URL (defaults to image/jpeg).
 */
function dataUrlMimeType(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);/)
  return match ? match[1] : 'image/jpeg'
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
  const creds = getVisionCredentials()

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
      url: `data:${dataUrlMimeType(dataUrl)};base64,${dataUrlToBase64(dataUrl)}`,
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
 */
export function extractJSON(content: string): string {
  const match = content.match(/```json\s*([\s\S]*?)\s*```|(\{[\s\S]*\})/)
  return match ? (match[1] || match[2]).trim() : content.trim()
}
