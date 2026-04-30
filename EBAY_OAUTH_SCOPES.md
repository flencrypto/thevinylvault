# eBay OAuth Scopes

Vinylasis integrates with eBay using the **OAuth 2.0 Client Credentials grant**
("application token" flow). This flow grants access to **public, application-level
data** only — it does **not** access a specific user's eBay account.

## Why Client Credentials only?

Vinylasis is a browser-only app (no backend server). The Authorization Code
grant required for user-context APIs (e.g. Sell APIs, user inventory, orders)
needs a confidential client secret exchange that cannot be performed safely
from a browser. We therefore only request **application scopes** that work with
`grant_type=client_credentials`.

Authorization-Code-only scopes (e.g. `sell.inventory`, `sell.account`,
`commerce.identity.readonly`) are intentionally **not** requested. If/when a
serverless proxy is added, the scope catalog below can be extended.

## Granted scopes

These are the scopes Vinylasis requests when minting an application token.
They map directly to public-data eBay APIs used by the bargain scanner,
valuation engine, and listing preview generator.

| Scope URI                                                       | API surface                                | Used by                                                     |
| --------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| `https://api.ebay.com/oauth/api_scope`                          | Browse API, Catalog API (public)           | `EbayBrowseService.searchVinylRecords`, `getItem`           |
| `https://api.ebay.com/oauth/api_scope/buy.marketing`            | Buy → Marketing API                        | "What's hot" / featured-listing surfaces (future)           |
| `https://api.ebay.com/oauth/api_scope/buy.item.feed`            | Buy → Feed API (item snapshots)            | Bulk listing feeds for the bargain scanner (future)         |
| `https://api.ebay.com/oauth/api_scope/buy.marketplace.insights` | Buy → Marketplace Insights (sold history)  | Sold-prices research / historical valuation                 |
| `https://api.ebay.com/oauth/api_scope/buy.deal`                 | Buy → Deal API                             | Deal scanner discount feeds                                 |
| `https://api.ebay.com/oauth/api_scope/buy.product.feed`         | Buy → Product Feed                         | Catalog enrichment                                          |
| `https://api.ebay.com/oauth/api_scope/buy.proxy.guest.order`    | Buy → Order (guest checkout, proxy)        | Reserved for future "buy now" deep-link checkout            |

The canonical machine-readable copy of this list lives in
[`src/lib/ebay-oauth-scopes.ts`](src/lib/ebay-oauth-scopes.ts) as
`EBAY_GRANTED_SCOPES`. Code that requests a token must request a subset of
that list; `EbayBrowseService.validateScopes()` enforces this at runtime.

## Default scope set

Most calls use the minimal default scope:

```
https://api.ebay.com/oauth/api_scope
```

This is sufficient for the Browse API (item search and item lookup) which
powers the deal scanner's eBay path today. Additional scopes are only requested
when the corresponding feature is actually invoked.

## Configuration

Credentials are entered by the user in **Settings → eBay API**:

- **Client ID** (a.k.a. App ID)
- **Client Secret** (a.k.a. Cert ID)
- **Developer ID** (informational — not used for OAuth)

These are stored in the Spark KV store under `vinyl-vault-api-keys` and
mirrored to `localStorage` (`ebay_client_id`, `ebay_client_secret`,
`ebay_app_id`, `ebay_dev_id`) for legacy callers.

The Settings panel exposes a **"Test eBay OAuth"** button that mints a token
using the default scope and reports success/failure plus the token's expiry.

## Marketplace Account Deletion

eBay separately requires every developer to subscribe to (or opt out of)
**Marketplace Account Deletion** notifications. That is unrelated to OAuth
scopes; see `api/ebay/deletion.ts` and the in-app checklist in Settings.

## Adding a new scope

1. Add the scope URI to `EBAY_GRANTED_SCOPES` in
   `src/lib/ebay-oauth-scopes.ts`, with a comment describing the API surface.
2. Update the table above.
3. When calling `ebayBrowseService.getAccessToken(scopes)`, pass the scope
   explicitly; `validateScopes()` will reject any scope not in the granted
   list.
