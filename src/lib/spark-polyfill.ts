/**
 * Polyfill for `window.spark` outside the GitHub Spark environment.
 *
 * When running on Netlify / GitHub Pages the `/_spark/*` back-end is not
 * available.  This module sets up `window.spark` before any app code runs so
 * that:
 *   • `spark.kv.*` delegates to localStorage (same storage layer as useKV)
 *   • `spark.llm` / `spark.llmPrompt` throw a clear error so callers can
 *     surface a meaningful UI message instead of crashing silently.
 *   • `spark.user` returns null – unauthenticated.
 *
 * If `window.spark` is already set (i.e. we ARE inside the Spark runtime)
 * this module replaces only the KV layer with localStorage so that data
 * actually persists in the browser between page loads.
 */

const STORAGE_PREFIX = 'vv_kv_'

function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    if (raw === null) return Promise.resolve(undefined)
    return Promise.resolve(JSON.parse(raw) as T)
  } catch {
    return Promise.resolve(undefined)
  }
}

function kvSet<T>(key: string, value: T): Promise<void> {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  } catch {
    // Ignore quota / security errors
  }
  return Promise.resolve()
}

function kvDelete(key: string): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key)
  } catch {
    // Ignore errors
  }
  return Promise.resolve()
}

function kvKeys(): Promise<string[]> {
  try {
    return Promise.resolve(
      Object.keys(localStorage)
        .filter((k) => k.startsWith(STORAGE_PREFIX))
        .map((k) => k.slice(STORAGE_PREFIX.length))
    )
  } catch {
    return Promise.resolve([])
  }
}

/** Template-tag that just concatenates the template literal fragments. */
function llmPromptPolyfill(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string {
  return strings.reduce(
    (acc, str, i) => acc + str + (values[i] !== undefined ? String(values[i]) : ''),
    ''
  )
}

/** Returns a rejected promise with a helpful message when Spark LLM is absent. */
async function llmPolyfill(_prompt: string): Promise<string> {
  throw new Error(
    'AI features require the GitHub Spark environment. ' +
      'This app is running without the Spark runtime – AI functions are unavailable.'
  )
}

const localKV = {
  keys: kvKeys,
  get: kvGet,
  set: kvSet,
  delete: kvDelete,
}

/**
 * Install / patch the global spark object.
 *
 * Always replaces spark.kv with a localStorage implementation so data
 * persists between page loads in production (Netlify / GitHub Pages).
 *
 * Should be called as early as possible – before React renders anything.
 */
export function installSparkPolyfill(): void {
  if (typeof window === 'undefined') return

  if (window.spark) {
    // Real Spark runtime is present – replace only the KV layer so that
    // collection data, settings, etc. persist in localStorage.
    window.spark.kv = localKV
  } else {
    // No Spark runtime – install full polyfill.
    window.spark = {
      llmPrompt: llmPromptPolyfill,
      llm: llmPolyfill,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user: async () => null as unknown as any,
      kv: localKV,
    }
  }
}

