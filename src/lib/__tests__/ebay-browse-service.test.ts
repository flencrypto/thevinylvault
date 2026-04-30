import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { EbayBrowseService } from '../ebay-browse-service'
import { EBAY_DEFAULT_SCOPE, EBAY_GRANTED_SCOPES } from '../ebay-oauth-scopes'

describe('EbayBrowseService', () => {
  let service: EbayBrowseService
  let fetchMock: ReturnType<typeof vi.fn>
  const originalFetch = globalThis.fetch
  const originalLocalStorage = globalThis.localStorage

  beforeEach(() => {
    service = new EbayBrowseService()
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    // Provide credentials via localStorage fallback.
    const store = new Map<string, string>([
      ['ebay_client_id', 'test-client-id'],
      ['ebay_client_secret', 'test-secret'],
    ])
    const fakeStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage
    Object.defineProperty(globalThis, 'localStorage', {
      value: fakeStorage,
      configurable: true,
    })
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'localStorage', {
        value: fakeStorage,
        configurable: true,
      })
    }
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  it('exposes the granted scope catalogue', () => {
    expect(service.getGrantedScopes()).toEqual([...EBAY_GRANTED_SCOPES])
    // Ensure it returns a defensive copy (mutation does not affect canonical list).
    service.getGrantedScopes().push('https://example.com/evil')
    expect(service.getGrantedScopes()).toEqual([...EBAY_GRANTED_SCOPES])
  })

  it('refuses to mint a token for a non-granted scope', async () => {
    await expect(
      service.getAccessToken(['https://api.ebay.com/oauth/api_scope/sell.inventory']),
    ).rejects.toThrow(/unsupported eBay OAuth scope/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('mints a token via Client Credentials with the requested scope', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: 'abc123', expires_in: 7200 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const token = await service.getAccessToken()
    expect(token).toBe('abc123')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.ebay.com/identity/v1/oauth2/token')
    expect((init as RequestInit).method).toBe('POST')
    const body = String((init as RequestInit).body)
    expect(body).toContain('grant_type=client_credentials')
    expect(body).toContain(`scope=${encodeURIComponent(EBAY_DEFAULT_SCOPE)}`)

    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe(
      `Basic ${btoa('test-client-id:test-secret')}`,
    )
  })

  it('caches tokens per scope-set and re-uses them within TTL', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ access_token: 'tok', expires_in: 7200 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    await service.getAccessToken()
    await service.getAccessToken()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // A different scope-set triggers a fresh request.
    await service.getAccessToken([
      EBAY_DEFAULT_SCOPE,
      'https://api.ebay.com/oauth/api_scope/buy.deal',
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('testConnection bypasses the cache and reports success', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ access_token: 'tok', expires_in: 7200 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    const first = await service.testConnection()
    const second = await service.testConnection()
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    // testConnection should always hit the network, not the cache.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('testConnection wraps network failures in a structured error', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response('invalid_client', { status: 401 })),
    )
    const res = await service.testConnection()
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toMatch(/eBay OAuth 401/)
    }
  })

  it('testConnection rejects unsupported scopes without hitting the network', async () => {
    const res = await service.testConnection([
      'https://api.ebay.com/oauth/api_scope/sell.account',
    ])
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toMatch(/Unsupported scope/i)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('hasCredentials returns false when neither KV nor localStorage has keys', async () => {
    const empty = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    } as Storage
    Object.defineProperty(globalThis, 'localStorage', { value: empty, configurable: true })
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'localStorage', { value: empty, configurable: true })
    }
    expect(await service.hasCredentials()).toBe(false)
  })

  it('hasCredentials returns false when localStorage property access throws SecurityError', async () => {
    // Simulate a sandboxed/privacy-mode environment where touching the
    // localStorage property itself raises before any method call.
    const throwing = {
      get localStorage(): Storage {
        throw new DOMException('Access denied', 'SecurityError')
      },
    }
    Object.defineProperty(globalThis, 'localStorage', {
      get() {
        throw new DOMException('Access denied', 'SecurityError')
      },
      configurable: true,
    })
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'localStorage', {
        get: () => throwing.localStorage,
        configurable: true,
      })
    }
    await expect(service.hasCredentials()).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
