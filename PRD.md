# Planning Guide

A professional vinyl record collection management and dealer operating system that combines intelligent cataloging, condition tracking, valuation insights, and marketplace integration into a unified platform for serious collectors and record dealers.

**Experience Qualities**:
1. **Professional** - Enterprise-grade interface that conveys authority and precision, suitable for serious collectors managing valuable inventories worth thousands
2. **Intelligent** - AI-assisted workflows that reduce friction in identification, grading, and pricing without feeling automated or impersonal
3. **Tactical** - Information-dense layouts optimized for power users who need quick access to detailed metadata, market data, and collection insights

**Complexity Level**: Complex Application (advanced functionality, likely with multiple views)
This is a professional tool for managing valuable collections with multiple interconnected features: collection management, condition grading, market intelligence, listing workflows, and AI-assisted cataloging. It requires multiple specialized views and rich data relationships.

## Essential Features

### Collection Dashboard
- **Functionality**: Overview of collection statistics, recent additions, value trends, and quick access to common tasks
- **Purpose**: Provides at-a-glance insight into collection health and facilitates rapid navigation
- **Trigger**: Default view on application load
- **Progression**: Load dashboard → Display collection stats (total items, estimated value, recent additions) → Show valuation trends chart → Present quick action tiles → Enable drill-down navigation
- **Success criteria**: Dashboard loads in <1s, displays accurate collection metrics, charts render correctly, navigation is intuitive

### Item Cataloging & Management
- **Functionality**: Add, edit, and organize vinyl records with rich metadata including pressing details, condition grading, purchase history, and storage location
- **Purpose**: Core collection tracking with professional-grade detail capture
- **Trigger**: User clicks "Add Item" or selects existing item
- **Progression**: Click add/edit → Enter/scan basic info (artist, title, year) → Specify pressing details (country, catalog number, matrix) → Grade condition (media/sleeve) → Set acquisition data (date, price, source) → Assign storage location → Upload images → Save
- **Success criteria**: Form validates all inputs, persists data correctly, supports image uploads, allows quick entry for bulk additions

### Condition Grading System
- **Functionality**: Professional vinyl grading using Goldmine standards (M, NM, EX, VG+, VG, G, F, P) for both media and sleeve with detailed notes
- **Purpose**: Establishes accurate condition assessment for valuation and marketplace listings
- **Trigger**: During item creation/editing or standalone grading workflow
- **Progression**: Select item → Choose grading standard → Grade media condition → Grade sleeve condition → Add grading notes (defects, wear patterns) → Attach condition photos → Save assessment
- **Success criteria**: Grading options clearly explained, notes support rich detail, photos linked to specific grades

### Market Valuation & Intelligence
- **Functionality**: Display estimated market value based on pressing, condition, and comparable sales data with confidence scoring, real-time eBay/Discogs comparable sales lookup, price trend visualization, seller-recommended listing prices, and batch valuation with CSV export for entire collections
- **Purpose**: Helps users understand their collection's worth and make informed buying/selling decisions with defensible, data-driven estimates. Batch valuation enables portfolio analysis and insurance documentation
- **Trigger**: User clicks "Valuation" button on an item card for single-item valuation, or "Batch Valuation" in header for collection-wide analysis
- **Progression**: 
  - **Single Item**: Click valuation → Display loading state → Fetch comparable sales from eBay/Discogs/internal → Analyze pressing rarity and condition adjustment → Calculate estimate range (low/mid/high) → Display detailed valuation with tabbed interface → View estimate with confidence score and drivers → Browse comparable sales with links to original listings → View price trend chart showing historical sales over time → See recommended listing price for sellers → User can override or use suggested price
  - **Batch Valuation**: Click "Batch Valuation" → Review collection count → Click "Start Batch Valuation" → System processes each item sequentially → Real-time progress tracking with status badges → For each item: fetch comps, calculate valuation, display results → View completed valuations with total collection value → Export all valuations to CSV with full metadata (artist, title, format, year, country, catalog number, grades, estimate low/mid/high, confidence, comparable sales count, market trend, recommended price, status)
- **Success criteria**: Single estimates appear within 5s including API calls, show reasonable ranges based on real data, reference actual comps with source links, explain confidence level honestly, display all value drivers with impact percentages, price trend chart renders when sufficient data exists, recommended listing price is competitive but profitable. Batch valuation processes entire collection without errors, displays clear progress, CSV export includes all relevant data fields, total collection value is accurate

### Image Upload & AI Pressing Identification
- **Functionality**: Upload photos of vinyl records (covers, labels, runouts) and use AI vision to automatically identify pressing details including catalog numbers, matrix codes, and pressing variants
- **Purpose**: Dramatically reduces manual data entry and improves accuracy by extracting metadata directly from images
- **Trigger**: User clicks "Identify Pressing" in add item dialog or uploads images during item creation
- **Progression**: Upload images (front/back cover, labels, runout) → Select image types → Add optional hints (artist, title, year) → AI analyzes all images → Extracts text, catalog numbers, matrix codes → Matches against pressing database → Returns ranked candidates with confidence scores → User selects best match → Form auto-fills with pressing details
- **Success criteria**: Analysis completes in <10s for 3-6 images, correctly identifies pressing in 70%+ of cases with clear images, provides helpful confidence scores, gracefully handles unclear images

### AI Condition Grading & Defect Detection
- **Functionality**: Upload photos of vinyl media and sleeve to receive automated condition grading (Goldmine standard) with detailed defect detection including severity classification, location tracking, and professional grading notes
- **Purpose**: Provides objective, consistent condition assessment while teaching users proper grading standards and accelerating the cataloging process
- **Trigger**: User clicks "Grade Condition" button in add item dialog
- **Progression**: Upload condition photos (media, labels, sleeve, spine) → AI analyzes images for defects → Detects scratches, wear, damage on both media and sleeve → Assigns separate Goldmine grades (M/NM/EX/VG+/VG/G/F/P) → Lists all defects with severity (minor/moderate/major) and location → Generates professional grading notes → Displays confidence score → User reviews and applies grades to form
- **Success criteria**: Analysis completes in <8s for multiple images, suggests reasonable grades aligned with Goldmine standards, detects 80%+ of visible defects, categorizes severity accurately, generates marketplace-ready grading notes

### OpenAI Vision-Powered Image Analysis
- **Functionality**: Comprehensive AI-powered image analysis using OpenAI's vision models to automatically classify image types, extract all visible metadata (artist, title, catalog numbers, label names, barcodes, matrix codes, edition clues), detect and categorize condition defects with severity ratings and location tracking, and generate professional seller notes suitable for marketplace listings
- **Purpose**: Dramatically speeds up cataloging by automating the tedious process of manually transcribing information from record images while providing structured, confidence-scored outputs that users can review before applying to their collection
- **Trigger**: User clicks "AI Image Analysis" button in add item dialog after uploading images
- **Progression**: Upload vinyl images (front/back cover, labels, runouts, inserts, spine) → Click "AI Image Analysis" → System processes each image in sequence → For each image: classifies type (cover/label/runout/insert/spine) → Extracts visible text and metadata (artist, title, catalog#, label, barcode, matrix codes, edition markers like MONO/STEREO/PROMO/TEST PRESSING) → Detects condition defects (ringwear, scratches, staining, creasing, spindle wear, scuffs, etc.) with severity levels and specific locations → Generates professional seller notes and condition summaries → Displays comprehensive results with confidence scores for each finding → Highlights low-confidence extractions with uncertainty badges → Shows raw AI output for transparency → User reviews all findings → Applies extracted metadata and condition notes to item form
- **Success criteria**: Analysis completes in <15s for 6 images, correctly extracts metadata with 85%+ accuracy on clear images, identifies defects with 80%+ accuracy, provides honest confidence scores that match actual reliability, clearly flags uncertain extractions, generates marketplace-ready condition descriptions, allows full user review before applying any data, maintains audit trail with raw AI outputs

### Pressing Identification Engine
- **Functionality**: Advanced AI-powered pressing identification system that combines image analysis, OCR runout extraction, manual hints, and **real-time Discogs database API integration** to generate ranked pressing candidates with comprehensive evidence and confidence scoring
- **Purpose**: Eliminates tedious manual research and dramatically improves cataloging accuracy by automatically identifying specific pressings from uploaded images and metadata clues, now enhanced with real Discogs database matching for verified pressing data
- **Trigger**: User clicks "Identify Pressing" button in add item dialog or accesses standalone pressing identification workflow
- **Progression**: Upload images (front/back cover, labels, runouts) → Enter OCR runout values if known → Add optional manual hints (artist, title, catalog number, country, year, format, label) → **Toggle Discogs database search (enabled by default if API token configured)** → Click "Identify Pressing" → **System queries Discogs database API for matching releases if enabled** → AI analyzes all images for text, catalog numbers, matrix codes, label names → Extracts and normalizes identifiers → **Cross-references image data with real Discogs release information** → Scores candidates based on catalog number match, barcode match, matrix similarity, country match, format match, label similarity, year plausibility → Returns ranked top 3 candidates with confidence bands (high/medium/low/ambiguous) → Each candidate displays evidence snippets explaining matches and **indicates if sourced from Discogs database** → User selects best candidate or chooses "none of these" for ambiguous results
- **Success criteria**: Analysis completes in <15s for 3-6 images + Discogs API calls, correctly identifies pressing in 80%+ of cases with clear images and database matches, provides detailed evidence for each candidate, confidence bands accurately reflect match quality, supports ambiguous outcomes without fabricating certainty, gracefully handles incomplete data, manual hints improve results when images are unclear, **Discogs database matches appear with high confidence and include Discogs release IDs**, system falls back to AI-generated suggestions when API not configured or no matches found

### Inventory & Listing Workflow
- **Functionality**: Manage items for sale, create marketplace listings with AI-generated descriptions, track listing status and sales
- **Purpose**: Streamlines seller workflow from inventory flagging to marketplace publishing
- **Trigger**: User marks item "for sale" or creates new listing draft
- **Progression**: Select item for sale → Generate listing draft → Review AI-suggested title/description → Set price (manual or AI-suggested) → Configure shipping → Preview listing → Publish or save draft → Track listing status → Record sale when completed
- **Success criteria**: Draft generation completes in <3s, copy is marketplace-ready, pricing suggestions are reasonable, status tracking is accurate

### Watchlist & Market Monitoring
- **Functionality**: Create targeted watch items for specific artists, releases, or pressings; receive scored bargain alerts when matching listings appear across eBay and Discogs marketplaces
- **Purpose**: Enables proactive acquisition strategy by automating market surveillance for wanted records at target prices
- **Trigger**: User clicks "Add Watch" from watchlist view
- **Progression**: Click add watch → Select watch type (artist/release/pressing/freetext) → Enter search criteria → Set optional target price → Enable/disable notifications → Save watch → Scan market manually or wait for scheduled scans → Review bargain cards with AI-scored opportunities → Visit promising listings
- **Success criteria**: Watches save correctly, market scans return relevant listings, bargain scores align with actual value opportunities, watch management is intuitive

### Cross-Marketplace Bargain Discovery (eBay + Discogs)
- **Functionality**: Real-time integration with eBay Finding API and Discogs Marketplace API to scan thousands of live listings, analyze them with AI for bargain potential, and surface undervalued records with detailed scoring and reasoning
- **Purpose**: Transforms passive collecting into active deal-hunting by identifying misdescribed listings, underpriced records, rare variants, and hidden gems before other buyers
- **Trigger**: User clicks "Scan Market" button in Bargains view
- **Progression**: Configure API credentials (Settings) → Test connections to verify → Add watchlist items with search criteria → Click scan market → System queries eBay Finding API with watchlist terms → System queries Discogs Marketplace API with same terms → Each listing analyzed by GPT-4 for bargain signals → Listings scored 40+ saved as bargain cards → Results displayed sorted by score → User reviews signals, estimated upside, matched releases → Click "View Listing" to visit actual marketplace page
- **Success criteria**: API connections authenticate successfully, scans return 50-500 listings per watchlist item, AI analysis completes in <15s total for 100 listings, bargain scores correlate with actual value opportunities (80%+ accuracy), users can easily distinguish high-quality leads from noise

### Marketplace Configuration & Testing
- **Functionality**: Secure storage and validation of eBay App ID and Discogs authentication credentials with connection testing
- **Purpose**: Enables real marketplace API integration while keeping credentials secure in browser storage
- **Trigger**: User opens marketplace settings from Bargains view
- **Progression**: Click settings icon → Enable eBay and/or Discogs → Enter API credentials (eBay App ID, Discogs personal token OR consumer key/secret) → Click test connection → System validates credentials with test API call → Display success/error message → Save validated configuration → Credentials persist in browser KV store
- **Success criteria**: API key input is password-masked, test connections provide clear success/failure feedback, invalid configurations prevent saves with helpful error messages, credentials persist between sessions

## Edge Case Handling

- **Unidentified Items**: Allow custom title/notes when pressing cannot be matched; flag for later identification
- **Multiple Copies**: Support quantity tracking per item; differentiate by condition/variant when needed
- **Mixed Condition**: Handle records with significantly different media vs sleeve grades; support detailed defect notes
- **Foreign Pressings**: Support international catalog numbers, matrix formats, and multi-currency purchase tracking
- **Incomplete Data**: Allow partial records; highlight missing critical fields; support progressive enhancement
- **Image Upload Failures**: Queue for retry; allow listings without images; show upload status clearly
- **Valuation Uncertainty**: Display confidence warnings; show wide ranges when comps are scarce; allow manual overrides
- **Marketplace Sync Errors**: Log failures with actionable messages; support manual retry; prevent data loss
- **API Rate Limits**: Respect eBay (5000/day) and Discogs (60/min) rate limits; show clear progress during scans; queue requests appropriately
- **Invalid API Credentials**: Prevent scans when credentials missing/invalid; show helpful setup guidance; test connections before heavy use
- **Empty Watchlists**: Provide default search terms when watchlist empty; guide users to add watches for better results
- **Cross-Currency Listings**: Display all prices in original currency; support GBP/USD/EUR uniformly; note currency in all bargain cards
- **Duplicate Listings**: Deduplicate by external listing ID; handle relisted items; track price changes over time
- **Marketplace API Changes**: Gracefully handle API response schema changes; log parsing errors; continue processing valid listings

## Design Direction

The design should evoke the professionalism of Bloomberg Terminal meets the tactile warmth of vinyl culture—information-dense yet approachable, data-driven yet passionate. Users should feel equipped with institutional-grade tools while celebrating their hobby. The interface should balance technical precision with the nostalgic, analog aesthetic of record collecting.

## Color Selection

A sophisticated palette that bridges financial software credibility with music industry edge—deep, saturated tones that feel both authoritative and creative.

- **Primary Color**: Deep indigo `oklch(0.35 0.15 265)` - Communicates depth, authority, and intelligence; reminiscent of late-night listening sessions and premium audio equipment
- **Secondary Colors**: Warm charcoal `oklch(0.25 0.02 270)` for backgrounds and containers; soft slate `oklch(0.65 0.05 250)` for secondary UI elements
- **Accent Color**: Electric amber `oklch(0.70 0.18 60)` - Attention-grabbing highlight for calls-to-action, value indicators, and important notifications; evokes vinyl's golden era and warm analog sound
- **Foreground/Background Pairings**: 
  - Background (Deep Navy #0F1419): Light text `oklch(0.95 0.01 265)` - Ratio 12.8:1 ✓
  - Card (Warm Charcoal #1A1D24): Light text `oklch(0.95 0.01 265)` - Ratio 11.2:1 ✓
  - Primary (Deep Indigo): White text `oklch(0.98 0 0)` - Ratio 7.1:1 ✓
  - Accent (Electric Amber): Dark text `oklch(0.15 0.05 265)` - Ratio 8.9:1 ✓

## Font Selection

Typography should project expertise and precision while remaining highly readable in information-dense layouts—combining the clarity of financial interfaces with editorial sophistication.

- **Primary Font**: Space Grotesk - A geometric sans with technical character and excellent readability at all sizes; perfect for data-heavy interfaces
- **Accent Font**: JetBrains Mono - Monospace font for catalog numbers, matrix codes, prices, and technical identifiers; reinforces precision

- **Typographic Hierarchy**:
  - H1 (Page Title): Space Grotesk Bold / 32px / -0.02em letter spacing / 1.1 line height
  - H2 (Section Heading): Space Grotesk Bold / 24px / -0.01em letter spacing / 1.2 line height
  - H3 (Card/Module Title): Space Grotesk Semibold / 18px / normal spacing / 1.3 line height
  - Body (Primary): Space Grotesk Regular / 15px / normal spacing / 1.6 line height
  - Small (Metadata): Space Grotesk Regular / 13px / normal spacing / 1.5 line height
  - Code (Identifiers): JetBrains Mono Medium / 14px / normal spacing / 1.4 line height
  - Button: Space Grotesk Medium / 14px / 0.01em letter spacing / 1.0 line height

## Animations

Animations should feel purposeful and responsive, reinforcing data relationships and system feedback without creating delay—motion that guides attention and confirms actions rather than decorating.

Key animation moments: (1) Dashboard value counter animates on load to emphasize collection worth; (2) Item cards scale and lift subtly on hover to signal interactivity; (3) Form validation provides instant micro-feedback; (4) Charts and graphs animate smoothly when data updates; (5) Modal dialogs slide up with slight elastic easing for substance; (6) Status indicators pulse gently when pending; (7) Page transitions use quick crossfades to maintain context.

## Component Selection

- **Components**: 
  - Cards for item display and dashboard modules; Dialog for item creation/editing forms; Tabs for organizing item details (metadata/condition/history/media); Table for collection list view with sorting/filtering; Badge for status indicators (owned/for-sale/sold) and condition grades; Button variants for action hierarchy; Select and Input for form fields; Textarea for notes/descriptions; Avatar for user/collection switcher; Progress for valuation confidence; Chart (via recharts) for value trends; ScrollArea for lengthy lists; Separator for visual organization; Tooltip for metadata explanations; Skeleton for loading states
  
- **Customizations**: 
  - Custom "GradeSelector" component with visual grade scale and hover explanations; Custom "ValueDisplay" component with confidence indicator and trend arrow; Custom "ImageGallery" component with lightbox for item photos; Custom "ConditionBadge" combining media/sleeve grades; Custom stat cards with animated counters
  
- **States**: 
  - Buttons: Default has subtle border, hover lifts with shadow, active scales down slightly, disabled shows reduced opacity; Inputs: Default with border, focus shows accent ring and slight scale, error shows destructive color; Cards: Default flat, hover elevates with shadow and scale (1.01), selected shows accent border
  
- **Icon Selection**: 
  - Vinyl (record disc) for collection/items; Plus for add actions; MagnifyingGlass for search; ChartLine for valuation/trends; Tag for pricing; MapPin for storage location; Camera for photos; Warning for condition issues; CheckCircle for verified/complete; Clock for recent activity; CaretDown/Up for sorting; Funnel for filters; DotsThree for menus
  
- **Spacing**: 
  - Container padding: px-6 py-4; Card padding: p-6; Section gaps: gap-8; Grid gaps: gap-4; Button padding: px-4 py-2; Form field spacing: space-y-4; Dashboard modules: gap-6; Inline elements: gap-2
  
- **Mobile**: 
  - Dashboard switches from 3-column grid to single column; Item cards stack vertically; Tables convert to card-based list view; Side panels become full-screen modals; Reduced font sizes (H1: 24px, body: 14px); Touch-friendly button sizing (min 44px height); Collapsible filters; Sticky header with collection switcher; Bottom navigation for primary actions
