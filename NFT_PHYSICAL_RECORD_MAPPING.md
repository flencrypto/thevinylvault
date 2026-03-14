# NFT Minting from Physical Records - Implementation Summary

## Overview
VinylVault NFTs are minted directly from physically owned vinyl record data stored in the collection. Each NFT represents a verified physical record with comprehensive provenance and authenticity tracking.

## Physical Record Data → NFT Metadata Mapping

### Core Identifiers
- **Artist Name** → NFT attribute "Artist"
- **Album Title** → NFT attribute "Album"
- **Release Year** → NFT attribute "Year"
- **Country** → NFT attribute "Country"
- **Format** (LP, 7in, 12in, EP, Boxset) → NFT attribute "Format"

### Pressing Identification
- **Catalog Number** → NFT attribute "Catalog Number"
- **Label Name** → NFT attribute "Label"
- **Matrix/Runout Numbers** → NFT attribute "Matrix/Runout" (joined with " / ")
- **Barcodes** → NFT attribute "Barcode"
- **Vinyl Color** → NFT attribute "Vinyl Color"
- **Pressing ID** → NFT attribute "Pressing ID"

### Condition & Grading
- **Media Grade** (M, NM, EX, VG+, VG, G, F, P) → NFT attribute "Media Grade"
- **Sleeve Grade** (M, NM, EX, VG+, VG, G, F, P) → NFT attribute "Sleeve Grade"
- **Grading Standard** (Goldmine, RecordCollector) → NFT attribute "Grading Standard"
- **Grading Notes** → NFT attribute "Condition Notes" (first 100 chars)

### Provenance & Acquisition
- **Acquisition Date** → NFT attribute "Acquisition Date"
- **Purchase Price** → NFT attribute "Purchase Price"
- **Source Type** (shop, ebay, discogs, fair, gift, unknown) → NFT attribute "Source"
- **Storage Location** → NFT attribute "Storage Location" + description footer

### Valuation & Market Data
- **Estimated Value** → NFT attribute "Estimated Value"
- **Value Confidence Score** → NFT attribute "Value Confidence"
- **Price History** → Calculated value change % in description

### Database References
- **Discogs Release ID** → NFT attribute "Discogs Release ID" + link in description
- **Discogs Master ID** → NFT attribute "Discogs Master ID"

### Media & Notes
- **Record Images** → NFT image (first image used as primary)
- **Collector Notes** → Included in NFT description

## NFT Metadata Structure

### Name Format
```
{Artist Name} - {Album Title} ({Year})
```
Example: `Pink Floyd - The Wall (1979)`

### Description Format
The NFT description includes a comprehensive text representation:

```
{Artist} - {Album} ({Year})

Format: {Format}
Country: {Country}
Catalog Number: {Catalog Number}
Label: {Label Name}
Matrix/Runout: {Matrix Numbers}
Vinyl: {Vinyl Color}

Condition:
Media: {Media Grade} ({Grading Standard})
Sleeve: {Sleeve Grade} ({Grading Standard})

Grading Notes:
{Grading Notes}

Acquired: {Acquisition Date} ({Source Type})
Purchase Price: {Purchase Price} {Currency}

Current Estimated Value: {Estimated Mid Value} {Currency} ({Confidence}% confidence)
Value Change: +{Percentage}% since acquisition

Collector Notes:
{Notes}

Discogs Release: https://www.discogs.com/release/{Discogs ID}

━━━━━━━━━━━━━━━━━━━━
This NFT represents a verified physical vinyl record in the VinylVault collection.
It provides immutable on-chain provenance, authenticity tracking, and ownership history.
The physical record is stored at: {Storage Location}
```

### Attributes Array
All physical record data is mapped to structured attributes for filtering and discovery:

```typescript
[
  { trait_type: 'Artist', value: 'Pink Floyd' },
  { trait_type: 'Album', value: 'The Wall' },
  { trait_type: 'Format', value: 'LP' },
  { trait_type: 'Year', value: 1979 },
  { trait_type: 'Country', value: 'UK' },
  { trait_type: 'Catalog Number', value: 'SHDW 411' },
  { trait_type: 'Label', value: 'Harvest' },
  { trait_type: 'Matrix/Runout', value: 'A-1U / B-1U / C-1U / D-1U' },
  { trait_type: 'Barcode', value: '5099902893815' },
  { trait_type: 'Vinyl Color', value: 'Black' },
  { trait_type: 'Media Grade', value: 'NM' },
  { trait_type: 'Sleeve Grade', value: 'EX' },
  { trait_type: 'Grading Standard', value: 'Goldmine' },
  { trait_type: 'Storage Location', value: 'Shelf A, Row 3' },
  { trait_type: 'Acquisition Date', value: '2024-01-15' },
  { trait_type: 'Purchase Price', value: '45.00 GBP' },
  { trait_type: 'Source', value: 'shop' },
  { trait_type: 'Estimated Value', value: '85.00 GBP' },
  { trait_type: 'Value Confidence', value: '81%' },
  { trait_type: 'Discogs Release ID', value: 249504 },
  { trait_type: 'Pressing ID', value: 'press-abc123' }
]
```

## Implementation Details

### Function: `prepareNFTMetadataFromItem()`
**Location:** `/src/lib/solana-service.ts`

This function transforms a `CollectionItem` (physical record) into an `NFTMintConfig`:

1. Extracts all available physical record attributes
2. Builds structured attribute array for blockchain metadata
3. Constructs human-readable description with all details
4. Uses first uploaded image as NFT cover art
5. Calculates value appreciation if price history exists
6. Includes Discogs links for external verification

### Minting Options
- **Simulation Mode** (default): Creates mock NFT for testing
- **Real Minting Mode**: Uses Metaplex Core to mint actual on-chain NFTs
  - Supports Phantom, Solflare, and Backpack wallets
  - Works on Devnet, Testnet, and Mainnet-Beta
  - Includes configurable royalty settings (0-10%)

### NFT Features
- **Provenance Tracking**: On-chain record of ownership history
- **Authenticity Verification**: Immutable metadata proves physical record details
- **Secondary Market Royalties**: Creator receives percentage of resales
- **Value Tracking**: Historical value changes preserved in metadata
- **Storage Location**: Physical location linked to digital certificate
- **Marketplace Integration**: NFT-verified eBay listings with blockchain badge

## Enhanced Marketplace Listings

When creating marketplace listings from minted NFTs, VinylVault adds:

```html
<div style="...blockchain verification badge...">
  <h3>🎵 Blockchain-Verified Authenticity</h3>
  <p>This vinyl record has been minted as an NFT on the Solana blockchain...</p>
  <div>
    <p><strong>NFT Mint Address:</strong> {mintAddress}</p>
    <p><strong>Network:</strong> Solana {network}</p>
    <p><strong>Royalty:</strong> {percentage}% on secondary sales</p>
  </div>
  <p>✓ Verifiable on Solana Explorer</p>
  <p>✓ Transferable NFT ownership certificate included</p>
  <p>✓ Web3 collector status</p>
</div>
```

## Benefits of Physical→NFT Mapping

1. **Complete Provenance**: Every detail about the physical record is preserved on-chain
2. **Authenticity Proof**: Matrix numbers, catalog numbers, and condition grades verify genuine pressing
3. **Value Appreciation**: Historical price data shows investment performance
4. **Storage Verification**: Link between physical location and digital certificate
5. **Marketplace Trust**: Buyers see verified, immutable record details
6. **Collector Prestige**: Web3 certification adds premium value
7. **Secondary Royalties**: Original owner benefits from future resales

## Data Flow

```
Physical Record Collection
  ↓
CollectionItem (TypeScript interface)
  ↓
prepareNFTMetadataFromItem()
  ↓
NFTMintConfig (structured metadata)
  ↓
Metaplex Core / Simulation
  ↓
MintedNFT (on-chain or simulated)
  ↓
Marketplace Listing (enhanced with NFT badge)
```

## Future Enhancements
- Track physical record transfers along with NFT transfers
- Add QR codes linking physical records to NFT certificates
- Implement batch metadata updates for condition changes
- Create NFT collections for complete artist discographies
- Enable NFT-based lending/borrowing of physical records
