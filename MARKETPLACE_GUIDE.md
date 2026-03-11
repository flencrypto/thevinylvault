# Real Marketplace Integration Guide

VinylVault connects to **live eBay and Discogs APIs** to scan thousands of actual marketplace listings for undervalued records. This guide explains how to set up the integration.

## 🔌 APIs Used

- **eBay Finding API** (`https://svcs.ebay.com/services/search/FindingService/v1`)
- **Discogs Marketplace API** (`https://api.discogs.com/marketplace/search`)

Both are called directly from your browser - no backend server needed!

## 📊 Integration Flow

```
┌─────────────────┐
│   VinylVault    │
│   (Your App)    │
└────────┬────────┘
         │
         ├──── 1. Configure API Credentials ───┐
         │                                     │
         ├──── 2. Create Watchlist Items ─────┤
         │                                     │
         └──── 3. Scan Market ────────────────┤
                                              │
         ┌────────────────────────────────────┘
         │
         ├──────────────────────────┬────────────────────────────┐
         │                          │                            │
    ┌────▼────┐              ┌──────▼───────┐          ┌────────▼────────┐
    │  eBay   │              │   Discogs    │          │   GPT-4 AI      │
    │ Finding │◄─────────────┤  Marketplace │◄─────────┤  Bargain        │
    │   API   │  Real-time   │     API      │  Real    │  Analysis       │
    └────┬────┘  Listings    └──────┬───────┘  Listings└────────┬────────┘
         │                          │                            │
         │                          │                            │
         └──────────────────────────┴────────────────────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │  Bargain Cards      │
                         │  Score: 40-100      │
                         │  Signals + Upside   │
                         └─────────────────────┘
```

## 🎯 What Makes This Different

Unlike mock data or scrapers, VinylVault uses **official marketplace APIs**:

✅ **Real Data**: Actual live listings from eBay and Discogs sellers  
✅ **Official**: Uses documented public APIs (no terms of service violations)  
✅ **Direct**: No intermediary servers - your browser talks to APIs directly  
✅ **Privacy**: Your API keys stay in browser storage, never sent elsewhere  
✅ **Legal**: Proper authentication via official developer programs  
✅ **Reliable**: No breaking from HTML changes; stable API contracts

## 🔑 Getting eBay API Credentials

### Step 1: Create eBay Developer Account
1. Visit [https://developer.ebay.com/](https://developer.ebay.com/)
2. Click "Get started" or "Sign in"
3. Use your existing eBay account or create a new one
4. Complete the developer registration

### Step 2: Create an Application
1. Go to "My Account" → "Application Keys"
2. Click "Create an Application Key"
3. Choose your environment:
   - **Sandbox**: For testing (free, fake listings)
   - **Production**: For real marketplace data (requires approval)
4. Fill in the application details:
   - Application Title: "VinylVault"
   - Brief Description: "Vinyl collection management and bargain hunting"

### Step 3: Get Your App ID
1. Once created, you'll see your keyset
2. Copy the **App ID (Client ID)** - this is what you need
3. Keep this secure - don't share it publicly

### Step 4: Configure in VinylVault
1. Open VinylVault
2. Navigate to the "Bargains" tab
3. Click the ⚙️ Settings icon (top right)
4. Enable "eBay marketplace scanning"
5. Paste your App ID
6. Click "Test eBay Connection" to verify
7. Save settings

## 🔑 Getting Discogs API Credentials

### Personal Access Token (Simple & Recommended)

VinylVault uses **Personal Access Tokens** for Discogs integration - no OAuth setup needed!

**Step-by-step guide:**

1. Visit [https://www.discogs.com/settings/developers](https://www.discogs.com/settings/developers)
2. Log in to your Discogs account
3. Scroll to the "Personal Access Tokens" section
4. Click "Generate new token"
5. Enter a token name: `VinylVault`
6. Click "Generate"
7. **Copy the token immediately** - you won't see it again!

### Configure in VinylVault

1. Open VinylVault app
2. Navigate to the **Settings** tab (gear icon in bottom nav)
3. Find the "Discogs API" section
4. Paste your Personal Access Token
5. Click "Test" to verify the connection
6. You should see "Discogs API connected!" 🎉

**Troubleshooting:**
- ❌ **Don't use OAuth** - VinylVault doesn't need Consumer Key/Secret
- ✅ **Only use Personal Access Token** - paste it in the single token field
- 🔒 Token is stored locally in your browser only
- 🔄 If test fails, regenerate a new token and try again

## 🎯 How It Works

Once configured, here's what happens when you click "Scan Market":

1. **Watchlist Query Building**
   - VinylVault takes your watchlist items
   - Builds search queries (e.g., "Pink Floyd Dark Side LP")

2. **Real API Calls**
   ```
   GET https://svcs.ebay.com/services/search/FindingService/v1
   → Returns actual live eBay listings
   
   GET https://api.discogs.com/marketplace/search
   → Returns actual Discogs marketplace listings
   ```

3. **AI Bargain Analysis**
   - Each listing is analyzed by GPT-4
   - Scores calculated based on:
     - Price vs estimated market value
     - Title quality and accuracy
     - Condition description
     - Seller category mismatches
     - Promo/test pressing keywords
     - Missing but valuable metadata

4. **Results**
   - Listings with bargain score ≥ 40% are saved
   - Sorted by bargain score (highest first)
   - Each shows estimated upside potential

## 📊 What You Get

### Real API Response Examples

When you scan marketplaces, here's the actual data structure returned:

#### eBay Finding API Response
```javascript
// Real eBay API response (simplified)
{
  "searchResult": {
    "item": [{
      "itemId": "123456789012",
      "title": "The Beatles - Revolver UK 1st Press PMC 7009 VG+/VG+",
      "sellingStatus": {
        "currentPrice": { 
          "value": "45.00",
          "currencyId": "GBP" 
        }
      },
      "condition": { "conditionDisplayName": "Very Good Plus (VG+)" },
      "listingInfo": { "listingType": "FixedPrice" },
      "location": "London, United Kingdom",
      "sellerInfo": { "sellerUserName": "ukvinylcollector" },
      "viewItemURL": "https://www.ebay.co.uk/itm/123456789012"
    }]
  }
}
```

**VinylVault normalizes this to:**
```typescript
{
  id: "ebay-123456789012",
  source: "ebay",
  externalId: "123456789012",
  title: "The Beatles - Revolver UK 1st Press PMC 7009 VG+/VG+",
  price: 45.00,
  currency: "GBP",
  condition: "Very Good Plus (VG+)",
  seller: "ukvinylcollector",
  location: "London, United Kingdom",
  url: "https://www.ebay.co.uk/itm/123456789012",
  listedAt: "2024-01-15T10:30:00Z"
}
```

#### Discogs Marketplace API Response
```javascript
// Real Discogs API response (simplified)
{
  "pagination": {
    "items": 150,
    "page": 1
  },
  "listings": [{
    "id": 987654321,
    "status": "For Sale",
    "price": {
      "value": 38.50,
      "currency": "GBP"
    },
    "seller": {
      "username": "recordshopvinyl",
      "rating": "99.8%"
    },
    "release": {
      "id": 123456,
      "description": "The Beatles - Revolver (LP, Album, RE, Gat)",
      "year": 1966,
      "catalog_number": "PMC 7009",
      "images": [
        { "uri": "https://i.discogs.com/...", "type": "primary" }
      ]
    },
    "condition": "Near Mint (NM or M-)",
    "sleeve_condition": "Very Good Plus (VG+)",
    "ships_from": "United Kingdom",
    "uri": "/sell/item/987654321",
    "posted": "2024-01-15T08:20:00Z"
  }]
}
```

**VinylVault normalizes this to:**
```typescript
{
  id: "discogs-987654321",
  source: "discogs",
  externalId: "987654321",
  title: "The Beatles - Revolver (LP, Album, RE, Gat)",
  description: undefined,  // Discogs doesn't include full description in search
  price: 38.50,
  currency: "GBP",
  condition: "Near Mint (NM or M-) / Very Good Plus (VG+)",
  seller: "recordshopvinyl",
  location: "United Kingdom",
  imageUrls: ["https://i.discogs.com/..."],
  url: "https://www.discogs.com/sell/item/987654321",
  listedAt: "2024-01-15T08:20:00Z"
}
```

### AI Bargain Analysis Output

Each normalized listing is then analyzed by GPT-4:

```typescript
{
  bargainScore: 78,  // 0-100 score
  estimatedValue: 85.00,
  estimatedUpside: 46.50,  // £85 estimated - £38.50 listing price
  signals: [
    {
      type: "low_price",
      score: 85,
      description: "Listed at £38.50 but UK 1st pressings typically sell for £80-£120",
      evidence: "Recent eBay sold listings: £92, £88, £105"
    },
    {
      type: "title_mismatch",
      score: 45,
      description: "Title uses generic 'RE' notation but image shows original PMC label",
      evidence: "PMC 7009"
    }
  ],
  matchedRelease: {
    artistName: "The Beatles",
    releaseTitle: "Revolver",
    year: 1966,
    catalogNumber: "PMC 7009"
  }
}
```

### Combined Bargain Card

```typescript
{
  id: "bargain-xyz123",
  listing: { /* normalized listing from above */ },
  bargainScore: 78,
  estimatedValue: 85.00,
  estimatedUpside: 46.50,
  signals: [ /* AI signals from above */ ],
  matchedRelease: { /* matched release */ },
  savedAt: "2024-01-15T12:00:00Z",
  viewed: false
}
```

### Bargain Signals

VinylVault looks for these signals:

- **Title Mismatch**: "Beatles LP" instead of full title → possible misdescribed gem
- **Low Price**: Listed at £20 but market value is £80 → 75% upside
- **Wrong Category**: Rare jazz record in "Rock" category → fewer bidders
- **Job Lot**: "5 LPs including..." → hidden valuable records
- **Promo Keywords**: "promo", "test pressing", "white label" → rare variants
- **Poor Metadata**: Missing catalog number, vague description → undervalued

## 🔒 Privacy & Rate Limits

- **eBay**: 5,000 calls/day for most applications
- **Discogs**: 60 calls/minute, authenticated
- Your API keys stay in your browser's local storage
- All API calls are made directly from your browser
- No data is sent to VinylVault servers (there are none!)

## 🚀 Tips for Best Results

1. **Add Specific Watches**: "Pink Floyd Dark Side Moon" is better than just "Pink Floyd"
2. **Use Multiple Sources**: Enable both eBay and Discogs
3. **Scan Regularly**: Marketplace changes constantly
4. **Check Listings Quickly**: Good bargains sell fast
5. **Verify Before Buying**: Always check the actual listing carefully

## ❓ Troubleshooting

### eBay Issues

**"eBay API error: 401 Unauthorized"**
- Your App ID is incorrect or expired
- Solution: Log into developer.ebay.com and verify your App ID
- Re-generate your application keys if needed
- Make sure you're using the **App ID (Client ID)**, not the Cert ID

**"eBay API error: 403 Forbidden"**
- Your application may not have Finding API access
- Solution: Check your app's API access in the developer portal
- Ensure your app is not in "sandbox" mode unless you intended it

**"eBay API error: 500 Internal Server Error"**
- eBay's API is temporarily down (rare)
- Solution: Wait a few minutes and try again
- Check [eBay Developer Status](https://developer.ebay.com/support/api-status)

### Discogs Issues

**"Discogs API error: 401 Unauthorized"**
- Your token is incorrect, expired, or revoked
- Solution: Go to [discogs.com/settings/developers](https://www.discogs.com/settings/developers)
- Generate a **new Personal Access Token**
- Copy it immediately (you can't see it again after creation)
- Delete the old token if you generated a new one

**"Discogs API error: 429 Too Many Requests"**
- You've exceeded the rate limit (60 requests/minute for authenticated users)
- Solution: VinylVault automatically rate-limits to 1 request/second
- If scanning large watchlists, this is normal behavior
- Wait 1 minute and try again

**"Discogs API error: 404 Not Found"**
- The endpoint or release doesn't exist
- Solution: This shouldn't happen with marketplace search
- Check your network connection
- Try again with different search terms

### General Issues

**"No listings found"**
- Your watchlist search terms may be too specific
- Solution 1: Broaden your searches (e.g., "Pink Floyd" instead of "Pink Floyd Dark Side Moon 1973 UK")
- Solution 2: Add more watchlist items
- Solution 3: Try different marketplaces (enable both eBay and Discogs)
- Check that at least one marketplace is enabled in settings

**"Scan Market button is disabled"**
- API credentials are not configured or invalid
- Solution: Click the ⚙️ settings icon
- Verify at least one marketplace is enabled
- Test your connection to ensure credentials are valid
- Save your settings

**"Scan is very slow"**
- Discogs has a strict 1-request-per-second rate limit
- Solution: This is expected behavior and prevents your account from being banned
- Large watchlists (10+ items) can take 20-30 seconds
- Consider reducing watchlist size or being more specific with search terms
- Progress is shown in real-time via toast notifications

**"Bargain scores seem wrong"**
- AI analysis depends on available market data
- Low scores (0-39): Likely overpriced or accurately priced
- Medium scores (40-69): Possible deals, worth investigating
- High scores (70-100): Strong bargain potential
- Solution: Always verify listings manually before purchasing
- Use the "View Listing" button to check actual item condition and seller reputation

**"Same listing appears multiple times"**
- Rare but can happen if a seller has multiple identical items
- Each listing has a unique external ID (check the listing URL)
- You can delete duplicates using the trash icon on bargain cards

**"Listings in wrong currency"**
- Both APIs return prices in original listing currency
- VinylVault displays prices as-is without conversion
- Solution: Check the currency indicator on each bargain card
- Filter by location in watchlist items if you prefer specific markets

### Connection Testing

Before scanning, **always test your connections**:

1. Open Settings (⚙️ icon in Bargains view)
2. Enter your API credentials
3. Click "Test eBay Connection" (if enabled)
4. Click "Test Discogs Connection" (if enabled)
5. Wait for success confirmation
6. If tests fail, double-check your credentials

### Rate Limits & Quotas

**eBay:**
- Production Apps: 5,000 calls/day
- Sandbox Apps: Limited to test data
- Per-second: No published limit but ~10/sec is safe

**Discogs:**
- Authenticated Users: 60 calls/minute (strictly enforced)
- Unauthenticated: 25 calls/minute
- VinylVault automatically paces requests at 1/second

### Getting Help

If you're still stuck:

1. Check the browser console (F12) for detailed error messages
2. Verify your API credentials are correct
3. Test with a simple search (e.g., one watchlist item: "Beatles")
4. Try each marketplace individually to isolate the issue
5. Check the official API status pages:
   - [eBay API Status](https://developer.ebay.com/support/api-status)
   - [Discogs Developer Forum](https://www.discogs.com/forum/developers)

## 📚 API Documentation

- [eBay Finding API Docs](https://developer.ebay.com/Devzone/finding/Concepts/FindingAPIGuide.html)
- [Discogs API Docs](https://www.discogs.com/developers)

---

**Ready to find bargains?** Set up your API credentials and start scanning!
