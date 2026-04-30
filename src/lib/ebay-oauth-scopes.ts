/**
 * Canonical list of eBay OAuth scopes Vinylasis is permitted to request via
 * the Client Credentials grant ("application token" flow).
 *
 * See `EBAY_OAUTH_SCOPES.md` for the human-readable description of each
 * scope and the API surface it unlocks.
 *
 * IMPORTANT: This list MUST be a strict subset of the scopes actually
 * granted to the developer's eBay application keyset. `validateScopes()`
 * enforces that any token request stays within this set.
 */

/**
 * Default scope used when no explicit scope is requested. Sufficient for
 * the public Browse API (item search, item details).
 */
export const EBAY_DEFAULT_SCOPE = 'https://api.ebay.com/oauth/api_scope'

/**
 * All application-level scopes Vinylasis is permitted to request via the
 * Client Credentials grant. Authorization-Code-only scopes (Sell APIs,
 * commerce.identity, etc.) are intentionally excluded.
 */
export const EBAY_GRANTED_SCOPES: readonly string[] = Object.freeze([
  // Public Browse / Catalog APIs.
  'https://api.ebay.com/oauth/api_scope',
  // Buy → Marketing API (featured / "what's hot" listings).
  'https://api.ebay.com/oauth/api_scope/buy.marketing',
  // Buy → Item Feed API (bulk public item snapshots).
  'https://api.ebay.com/oauth/api_scope/buy.item.feed',
  // Buy → Marketplace Insights (sold-history pricing).
  'https://api.ebay.com/oauth/api_scope/buy.marketplace.insights',
  // Buy → Deal API (discounted listings feed).
  'https://api.ebay.com/oauth/api_scope/buy.deal',
  // Buy → Product Feed (catalog enrichment).
  'https://api.ebay.com/oauth/api_scope/buy.product.feed',
  // Buy → Order (proxy guest checkout — reserved).
  'https://api.ebay.com/oauth/api_scope/buy.proxy.guest.order',
])

const GRANTED_SET = new Set(EBAY_GRANTED_SCOPES)

/**
 * Result of a scope-subset validation.
 */
export interface ScopeValidationResult {
  /** True iff every requested scope is in `EBAY_GRANTED_SCOPES`. */
  valid: boolean
  /** Requested scopes that are NOT in the granted list. */
  invalid: string[]
  /** Normalised, de-duplicated scope list (in input order). */
  normalised: string[]
}

/**
 * Normalise a scope input into a clean string array.
 * Accepts either a single space-separated string (the on-the-wire OAuth
 * format) or an array of scope URIs.
 */
export function normaliseScopes(scopes: string | readonly string[] | undefined): string[] {
  if (!scopes) return [EBAY_DEFAULT_SCOPE]
  const raw = Array.isArray(scopes)
    ? scopes
    : String(scopes).split(/\s+/)
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of raw) {
    const trimmed = s.trim()
    if (!trimmed) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out.length > 0 ? out : [EBAY_DEFAULT_SCOPE]
}

/**
 * Validate that every requested scope is in the granted-scope catalogue.
 */
export function validateScopes(
  requested: string | readonly string[] | undefined,
): ScopeValidationResult {
  const normalised = normaliseScopes(requested)
  const invalid = normalised.filter((s) => !GRANTED_SET.has(s))
  return {
    valid: invalid.length === 0,
    invalid,
    normalised,
  }
}

/**
 * True iff `scope` is in `EBAY_GRANTED_SCOPES`.
 */
export function isGrantedScope(scope: string): boolean {
  return GRANTED_SET.has(scope)
}
