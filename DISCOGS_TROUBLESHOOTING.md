# Discogs API Troubleshooting Guide

## Common Connection Errors

### ❌ Error: "404 - The requested resource was not found"

**Cause:** Your Personal Access Token is invalid or wasn't copied correctly.

**Solution:**
1. Go to [Discogs Developer Settings](https://www.discogs.com/settings/developers)
2. Scroll to "Personal Access Tokens"
3. **Delete your old token** (if any)
4. Click "Generate new token"
5. Name it `VinylVault`
6. **Copy the entire token immediately** - it's shown only once!
7. Paste it into VinylVault Settings → Discogs API → Personal Access Token
8. Click "Test" to verify

**Common mistakes:**
- ❌ Copying only part of the token
- ❌ Adding extra spaces before or after
- ❌ Using an expired or deleted token
- ❌ Trying to use OAuth URLs instead of the token

---

### ❌ Error: "401 - Authentication failed"

**Cause:** The token is not being sent correctly or has been revoked.

**Solution:**
1. Verify you copied the **complete** token (no spaces, no line breaks)
2. Check that the token wasn't revoked in Discogs settings
3. Generate a fresh token and try again

---

### ⚠️ You DON'T Need OAuth!

VinylVault uses **Personal Access Tokens**, not OAuth.

**Ignore these URLs - they are NOT used:**
- ❌ `https://api.discogs.com/oauth/request_token`
- ❌ `https://www.discogs.com/oauth/authorize`
- ❌ `https://api.discogs.com/oauth/access_token`
- ❌ Consumer Key
- ❌ Consumer Secret

**What you DO need:**
- ✅ Personal Access Token from the Discogs Developer Settings page

---

## Testing Your Connection

### Quick Test (In Settings)

1. Open VinylVault
2. Go to **Settings** tab
3. Find "Discogs API" section
4. Enter your Personal Access Token
5. Click **Test** button
6. Should see: "Discogs API connected! Found 1 test listing(s)."

### Advanced Test (Database Search)

1. In Settings, click **Advanced Test & Database Search**
2. Try the **Connection Test** tab first
3. Then try **Database Search Test** with:
   - Artist: `Pink Floyd`
   - Title: `The Dark Side of the Moon`
4. Click "Search Discogs Database"
5. Should see real pressing results from Discogs

---

## What the API Does

VinylVault connects to Discogs to:

1. **Pressing Identification** - Match your vinyl photos to real Discogs database entries
2. **Market Data** - Get pricing trends and comparable sales
3. **Bargain Detection** - Find undervalued records on marketplaces

All data comes from the **official Discogs API**, stored locally in your browser.

---

## Rate Limits

Discogs allows:
- **60 requests per minute** (authenticated)
- **25 requests per minute** (unauthenticated)

VinylVault respects these limits with automatic throttling.

---

## Privacy & Security

- ✅ Your token is stored **only in your browser** (localStorage)
- ✅ Never sent to any server except Discogs API
- ✅ Not visible to anyone else
- ✅ You can delete it anytime from Settings

---

## Still Having Issues?

1. **Clear your token** in Settings and start fresh
2. **Check browser console** for detailed error messages (F12 → Console tab)
3. **Verify token permissions** - make sure it wasn't revoked in Discogs
4. **Try a different browser** to rule out extension conflicts

---

## How to Get Your Token (Step-by-Step with Screenshots)

### Step 1: Visit Discogs Developer Settings
Go to: [https://www.discogs.com/settings/developers](https://www.discogs.com/settings/developers)

### Step 2: Find Personal Access Tokens Section
Scroll down to the "Personal Access Tokens" section (NOT "OAuth Applications")

### Step 3: Generate New Token
- Click "Generate new token"
- Enter token name: `VinylVault`
- Click "Generate"

### Step 4: Copy Token Immediately
⚠️ **IMPORTANT:** The token is shown **only once**! Copy it now.

The token looks like: `AbCdEfGhIjKlMnOpQrStUvWxYz123456789ABCDE`

### Step 5: Paste in VinylVault
1. Open VinylVault Settings
2. Find "Discogs API" section
3. Paste the token in "Personal Access Token" field
4. Click "Test"
5. Should see success message! 🎉

---

## Example: Working vs Broken

### ✅ Working Configuration
```
Personal Access Token: ✓ (valid token pasted)
Test Result: "Discogs API connected! Found 1 test listing(s)."
```

### ❌ Broken Configuration
```
Personal Access Token: (empty or invalid)
Test Result: "404 - The requested resource was not found"
```

---

## Technical Details

**API Endpoint Used:**
```
GET https://api.discogs.com/marketplace/search?query=vinyl&per_page=1
```

**Authentication Header:**
```
Authorization: Discogs token=YOUR_TOKEN_HERE
```

**Expected Response:**
```json
{
  "pagination": { "items": 100, "page": 1, "pages": 100 },
  "listings": [ { "id": 123456, "release": {...}, "price": {...} } ]
}
```

If you see this structure in the Network tab (F12), your token is working!
