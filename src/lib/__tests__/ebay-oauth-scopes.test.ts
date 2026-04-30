import { describe, it, expect } from 'vitest'
import {
  EBAY_DEFAULT_SCOPE,
  EBAY_GRANTED_SCOPES,
  isGrantedScope,
  normaliseScopes,
  validateScopes,
} from '../ebay-oauth-scopes'

describe('ebay-oauth-scopes', () => {
  it('exposes the default scope as a member of granted scopes', () => {
    expect(EBAY_GRANTED_SCOPES).toContain(EBAY_DEFAULT_SCOPE)
  })

  it('granted scopes are a frozen, deduplicated list', () => {
    expect(Object.isFrozen(EBAY_GRANTED_SCOPES)).toBe(true)
    expect(new Set(EBAY_GRANTED_SCOPES).size).toBe(EBAY_GRANTED_SCOPES.length)
  })

  it('granted scopes are application-level only (no Sell APIs)', () => {
    for (const scope of EBAY_GRANTED_SCOPES) {
      expect(scope.startsWith('https://api.ebay.com/oauth/api_scope')).toBe(true)
      expect(scope).not.toMatch(/\/sell\./)
      expect(scope).not.toMatch(/commerce\.identity/)
    }
  })

  describe('normaliseScopes', () => {
    it('returns the default scope when input is empty', () => {
      expect(normaliseScopes(undefined)).toEqual([EBAY_DEFAULT_SCOPE])
      expect(normaliseScopes('')).toEqual([EBAY_DEFAULT_SCOPE])
      expect(normaliseScopes([])).toEqual([EBAY_DEFAULT_SCOPE])
    })

    it('splits a space-separated string', () => {
      const out = normaliseScopes(`${EBAY_DEFAULT_SCOPE} https://api.ebay.com/oauth/api_scope/buy.deal`)
      expect(out).toEqual([
        EBAY_DEFAULT_SCOPE,
        'https://api.ebay.com/oauth/api_scope/buy.deal',
      ])
    })

    it('deduplicates while preserving order', () => {
      const dup = 'https://api.ebay.com/oauth/api_scope/buy.deal'
      expect(normaliseScopes([EBAY_DEFAULT_SCOPE, dup, EBAY_DEFAULT_SCOPE, dup]))
        .toEqual([EBAY_DEFAULT_SCOPE, dup])
    })

    it('trims whitespace and drops empties', () => {
      expect(normaliseScopes(`  ${EBAY_DEFAULT_SCOPE}   `)).toEqual([EBAY_DEFAULT_SCOPE])
    })
  })

  describe('validateScopes', () => {
    it('accepts an empty/undefined request as the default scope', () => {
      const r = validateScopes(undefined)
      expect(r.valid).toBe(true)
      expect(r.invalid).toEqual([])
      expect(r.normalised).toEqual([EBAY_DEFAULT_SCOPE])
    })

    it('accepts every granted scope', () => {
      const r = validateScopes(EBAY_GRANTED_SCOPES)
      expect(r.valid).toBe(true)
      expect(r.invalid).toEqual([])
    })

    it('rejects unknown / Sell API scopes', () => {
      const sellScope = 'https://api.ebay.com/oauth/api_scope/sell.inventory'
      const r = validateScopes([EBAY_DEFAULT_SCOPE, sellScope])
      expect(r.valid).toBe(false)
      expect(r.invalid).toEqual([sellScope])
      // Normalised list still includes the rejected entry so callers can show diagnostics.
      expect(r.normalised).toEqual([EBAY_DEFAULT_SCOPE, sellScope])
    })

    it('rejects garbage strings', () => {
      const r = validateScopes('not-a-scope')
      expect(r.valid).toBe(false)
      expect(r.invalid).toEqual(['not-a-scope'])
    })
  })

  describe('isGrantedScope', () => {
    it('returns true for granted scopes and false otherwise', () => {
      expect(isGrantedScope(EBAY_DEFAULT_SCOPE)).toBe(true)
      expect(isGrantedScope('https://api.ebay.com/oauth/api_scope/sell.account')).toBe(false)
      expect(isGrantedScope('')).toBe(false)
    })
  })
})
