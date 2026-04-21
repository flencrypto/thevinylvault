/**
 * localStorage-based polyfill for @github/spark/hooks `useKV`.
 *
 * Drop-in replacement that persists values in localStorage so the app
 * works correctly outside of the GitHub Spark environment (e.g. on
 * Netlify or GitHub Pages).
 */

import { useState, useCallback, useEffect, useRef } from 'react'

const STORAGE_PREFIX = 'vv_kv_'

function readStorage<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    if (raw === null) return undefined
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  } catch {
    // Ignore storage quota / security errors
  }
}

function deleteStorage(key: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key)
  } catch {
    // Ignore errors
  }
}

// Custom event used to synchronise multiple useKV instances on the same key
// within the same page (mirrors the Spark workbench postMessage behaviour).
const KV_EVENT = 'vv-kv-update'

interface KVUpdateEvent extends CustomEvent {
  detail: { key: string; value: unknown | undefined }
}

function dispatchKVEvent(key: string, value: unknown | undefined) {
  window.dispatchEvent(
    new CustomEvent(KV_EVENT, { detail: { key, value } }) as KVUpdateEvent
  )
}

/**
 * localStorage-backed replacement for the Spark `useKV` hook.
 *
 * Signature is identical to the original so imports can be swapped
 * without changing any call-sites.
 */
export function useKV<T = string>(
  key: string,
  initialValue?: T
): readonly [T | undefined, (newValue: T | ((old?: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T | undefined>(() => {
    const stored = readStorage<T>(key)
    return stored !== undefined ? stored : initialValue
  })

  // Keep a ref so callbacks always close over the latest value without
  // re-creating them on every render.
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  }, [value])

  // On first mount of this component instance, persist the initial value if
  // nothing is stored yet. The ref ensures this runs only once per mount
  // (even with StrictMode's double-invocation in dev); a StrictMode remount
  // will re-run the effect, but the readStorage check prevents overwriting
  // an existing stored value.
  const initialised = useRef(false)
  useEffect(() => {
    if (!initialised.current) {
      initialised.current = true
      if (initialValue !== undefined && readStorage(key) === undefined) {
        writeStorage(key, initialValue)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for updates from other instances sharing the same key.
  useEffect(() => {
    const handler = (e: Event) => {
      const { key: updatedKey, value: updatedValue } = (e as KVUpdateEvent).detail
      if (updatedKey === key) {
        setValue(updatedValue as T | undefined)
      }
    }
    window.addEventListener(KV_EVENT, handler)
    return () => window.removeEventListener(KV_EVENT, handler)
  }, [key])

  const userSetValue = useCallback(
    (newValue: T | ((old?: T) => T)) => {
      setValue((current) => {
        const next =
          typeof newValue === 'function'
            ? (newValue as (old?: T) => T)(current)
            : newValue
        writeStorage(key, next)
        dispatchKVEvent(key, next)
        return next
      })
    },
    [key]
  )

  const deleteValue = useCallback(() => {
    deleteStorage(key)
    dispatchKVEvent(key, undefined)
    setValue(undefined)
  }, [key])

  return [value, userSetValue, deleteValue] as const
}
