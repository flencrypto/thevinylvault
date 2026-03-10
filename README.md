# 🎵 VinylVault - Professional Vinyl Collection Management

VinylVault is a production-ready vinyl record collection and dealer operating system that combines intelligent cataloging, AI-powered identification, condition tracking, valuation insights, and **real-time marketplace bargain discovery** across eBay and Discogs.

## ✨ Key Features

### 📚 Collection Management
- Professional-grade cataloging with pressing details, matrix numbers, and catalog tracking
- Goldmine-standard condition grading (media + sleeve)
- Purchase history and storage location tracking
- Multi-format support (LP, 7", 12", EP, Box Sets)
- Image uploads for covers, labels, and runouts

### 🤖 AI-Powered Intelligence
- **Pressing Identification**: Upload photos of vinyl and automatically identify pressing variants from cover art, label scans, and runout codes
- **Condition Grading**: AI analysis of visual defects with severity classification and professional grading notes
- **Listing Generation**: SEO-optimized marketplace descriptions created from item metadata
- **Valuation Estimates**: Market value predictions based on comparable sales and rarity signals

### 🔍 Cross-Marketplace Bargain Discovery (NEW!)
**Real eBay + Discogs API Integration**

VinylVault connects directly to live marketplace APIs to scan thousands of real listings and surface undervalued records:

- **eBay Finding API**: Searches active and recently sold eBay listings
- **Discogs Marketplace API**: Queries global Discogs seller inventory
- **AI Bargain Analysis**: GPT-4 scores each listing for deal potential (0-100)
- **Smart Detection**: Identifies misdescribed lots, job lots, promo pressings, poor metadata, and pricing anomalies
- **Watchlist Automation**: Set up artist/release watches with target prices and get alerted to opportunities

#### Bargain Signals
The AI looks for:
- 🏷️ **Title Mismatch**: Vague or incorrect titles hiding valuable records
- 💰 **Low Price**: Listings significantly below estimated market value
- 📁 **Wrong Category**: Rare items miscategorized with fewer competing buyers
- 📦 **Job Lots**: Multi-record bundles with visible high-value items
- ⭐ **Promo Keywords**: Test pressings, white labels, radio station copies
- 📝 **Poor Metadata**: Missing catalog numbers or incomplete descriptions

### 🛒 Seller Workflow
- Mark items for sale and generate marketplace-ready listings
- AI-suggested pricing based on condition and market comps
- Draft management and listing templates
- Sales tracking and profit calculation

## 🚀 Getting Started

### Prerequisites
To use the marketplace bargain discovery features, you'll need:

1. **eBay Developer App ID** (free)
   - Sign up at [developer.ebay.com](https://developer.ebay.com/)
   - Create an application to get your App ID
   - See [MARKETPLACE_GUIDE.md](MARKETPLACE_GUIDE.md) for detailed setup

2. **Discogs API Credentials** (free)
   - Get a Personal Access Token at [discogs.com/settings/developers](https://www.discogs.com/settings/developers)
   - OR create an OAuth app for Consumer Key/Secret
   - See [MARKETPLACE_GUIDE.md](MARKETPLACE_GUIDE.md) for detailed setup

### Quick Start
1. Open VinylVault
2. Navigate to the **Bargains** tab
3. Click the ⚙️ **Settings** icon
4. Enable eBay and/or Discogs
5. Enter your API credentials
6. Click **Test Connection** to verify
7. Save your settings
8. Add watchlist items for artists/releases you're hunting
9. Click **Scan Market** to discover bargains!

## 📖 Documentation

- **[MARKETPLACE_GUIDE.md](MARKETPLACE_GUIDE.md)**: Complete setup guide for eBay and Discogs APIs
- **[PRD.md](PRD.md)**: Full product requirements and feature specifications
- **[SECURITY.md](SECURITY.md)**: Security and privacy information

## 🔐 Privacy & Security

- All API credentials are stored **locally in your browser** using encrypted KV storage
- No backend server - all API calls are made **directly from your browser** to eBay/Discogs
- Your data never leaves your device
- API keys are password-masked in the UI
- Rate limits are automatically respected (eBay: 5000/day, Discogs: 60/min)

## 🎯 How It Works

1. **Configure APIs**: Add your eBay App ID and Discogs token
2. **Build Watchlist**: Add specific artists, releases, or search terms you're hunting
3. **Scan Marketplaces**: Click "Scan Market" to query both APIs in real-time
4. **AI Analysis**: Each listing is analyzed by GPT-4 for bargain potential
5. **Review Bargains**: Get scored results (40-100) with reasoning and estimated upside
6. **Act Fast**: Click through to buy promising listings before other collectors!

## 🛠 Technical Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **UI Components**: Shadcn v4 with custom vinyl-themed design
- **Icons**: Phosphor Icons
- **AI**: OpenAI GPT-4 for identification, grading, and bargain analysis
- **Storage**: Spark KV (browser-based encrypted persistence)
- **APIs**: eBay Finding API v1, Discogs Marketplace API
- **Animations**: Framer Motion

## 🎨 Design Philosophy

VinylVault bridges the professionalism of Bloomberg Terminal with the warmth of vinyl culture—information-dense yet approachable, data-driven yet passionate. The dark indigo and electric amber color scheme evokes late-night listening sessions while maintaining institutional-grade credibility for serious collectors managing valuable inventories.

## 🧹 Just Exploring?

No problem! If you're just checking things out:
- Simply delete your Spark when done
- Everything will be cleaned up — no traces left behind

---

📄 **License**: The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.
