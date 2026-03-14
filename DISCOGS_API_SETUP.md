# Discogs API Setup Guide

## Overview

VinylVault uses the Discogs API to enable **verified database pressing identification**. With your Personal Access Token configured, the app can:

- ✅ Search the Discogs database for pressing matches
- ✅ Verify pressing details against millions of catalog entries
- ✅ Retrieve accurate release information, matrix numbers, and variants
- ✅ Cross-reference image analysis with real database records
- ✅ Provide higher confidence matches with verifiable provenance

---

## How to Get Your Discogs Personal Access Token

### Step 1: Create a Discogs Account
If you don't already have one, sign up at [discogs.com](https://www.discogs.com)

### Step 2: Navigate to Developer Settings
1. Go to [https://www.discogs.com/settings/developers](https://www.discogs.com/settings/developers)
2. Log in if prompted

### Step 3: Generate a Personal Access Token
1. Scroll down to the **"Personal Access Tokens"** section
2. Click **"Generate new token"**
3. Enter a name for your token (e.g., "VinylVault")
4. Click **"Generate"**
5. **⚠️ IMPORTANT**: Copy the token immediately - it's only shown once!

### Step 4: Add Token to VinylVault
1. Open VinylVault
2. Go to **Settings** (gear icon)
3. Find the **"Discogs API"** section
4. Paste your token in the **"Personal Access Token"** field
5. Click **"Test"** to verify the connection
6. Click **"Save Settings"**

---

## Using Discogs API for Pressing Identification

Once your token is configured, VinylVault will automatically use the Discogs database when identifying pressings:

### 1. New Listing Tab
- Upload record photos (cover, label, runout)
- Add manual hints (artist, title, catalog number)
- Enable **"Use Discogs Database"** toggle (enabled by default)
- Click **"Identify Pressing"**

### 2. Results with Discogs Data
When Discogs is enabled, you'll see:
- 🎯 Higher confidence matches
- 🔗 Direct links to Discogs release pages
- ✓ Verified catalog numbers and matrix numbers
- 📊 Match percentage showing likelihood
- 🏷️ Variant and issue information

### 3. Batch Identification
- Select multiple items in Collection view
- Click **"Batch Identify"**
- Discogs database searches run for each item
- Results show verified matches with confidence scores

---

## API Rate Limits

Discogs API has the following limits:
- **60 requests per minute** for authenticated requests (with token)
- **25 requests per minute** for unauthenticated requests

VinylVault handles rate limiting automatically with:
- ⏳ Exponential backoff retry logic
- 💾 Local caching of successful queries
- 📊 Cache stats visible in Settings

---

## Troubleshooting

### "Authentication failed (401)"
- Your token is invalid or expired
- Regenerate a new token in Discogs Developer Settings
- Make sure you copied the complete token string

### "Resource not found (404)"
- Token format is incorrect
- Ensure you're using a **Personal Access Token** (not OAuth credentials)
- Token should be a long alphanumeric string

### "Rate limit exceeded (429)"
- You've made too many requests in 1 minute
- Wait 60 seconds and try again
- VinylVault's cache reduces the need for repeated requests

### "Connection timed out"
- Check your internet connection
- Discogs API may be temporarily unavailable
- Try again in a few minutes

---

## Privacy & Security

- ✅ Your Discogs token is stored **locally on your device only**
- ✅ Token is never transmitted to any server except Discogs API
- ✅ All API calls go directly from your browser to Discogs
- ✅ You can revoke your token anytime in Discogs Developer Settings

---

## Advanced Features

### Test & Database Search
In Settings → Discogs API section:
- Click **"Advanced Test & Database Search"**
- Try searching for specific releases
- Verify your token permissions
- View detailed API response data

### Cache Management
In Settings → Discogs API Cache:
- View cache statistics
- See total cached queries
- Clear cache if needed
- Monitor storage usage

### Confidence Threshold Tuning
In Settings → AI Confidence Thresholds:
- Adjust **"Pressing Identification"** slider
- Higher threshold = more certainty required for auto-match
- Lower threshold = more convenience, may need manual verification

---

## What's Next?

With Discogs API configured, you can:
1. 🎵 Identify pressings with verified database accuracy
2. 💰 Get more accurate valuations based on specific variants
3. 🛍️ Find marketplace bargains with precise pressing matches
4. 📦 Build a collection with verified catalog information

Need help? Check the [DISCOGS_TROUBLESHOOTING.md](./DISCOGS_TROUBLESHOOTING.md) guide for detailed error solutions.
