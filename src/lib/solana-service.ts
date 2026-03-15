import { 
  SolanaNFTMetadata, 
  NFTMintConfig, 
  MintedNFT, 
  SolanaNetwork,
  buildNFTMetadata,
  NFT_SYMBOL,
  SOLANA_NETWORKS
} from './solana-nft'
import { CollectionItem } from './types'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { 
  createV1,
  mplCore,
  pluginAuthorityPair,
  ruleSet,
} from '@metaplex-foundation/mpl-core'
import { 
  publicKey as umiPublicKey,
  generateSigner,
  percentAmount,
} from '@metaplex-foundation/umi'

export interface MintNFTResult {
  success: boolean
  mintAddress?: string
  transactionSignature?: string
  metadataUri?: string
  error?: string
}

export async function prepareNFTMetadataFromItem(
  item: CollectionItem,
  walletAddress: string
): Promise<NFTMintConfig> {
  const itemImageUrl = item.images?.[0] || 'https://via.placeholder.com/600x600?text=No+Image'
  
  const attributes = [
    { trait_type: 'Artist', value: item.artistName },
    { trait_type: 'Album', value: item.releaseTitle },
    { trait_type: 'Format', value: item.format },
    { trait_type: 'Year', value: item.year },
    { trait_type: 'Country', value: item.country },
    { trait_type: 'Media Grade', value: item.condition.mediaGrade },
    { trait_type: 'Sleeve Grade', value: item.condition.sleeveGrade },
    { trait_type: 'Grading Standard', value: item.condition.gradingStandard },
  ]

  if (item.catalogNumber) {
    attributes.push({ trait_type: 'Catalog Number', value: item.catalogNumber })
  }

  if (item.labelName) {
    attributes.push({ trait_type: 'Label', value: item.labelName })
  }

  if (item.matrixNumbers && item.matrixNumbers.length > 0) {
    attributes.push({ 
      trait_type: 'Matrix/Runout', 
      value: item.matrixNumbers.join(' / ') 
    })
  }

  if (item.barcodes && item.barcodes.length > 0) {
    attributes.push({ 
      trait_type: 'Barcode', 
      value: item.barcodes.join(', ') 
    })
  }

  if (item.vinylColor) {
    attributes.push({ trait_type: 'Vinyl Color', value: item.vinylColor })
  }

  if (item.rarity) {
    attributes.push({ trait_type: 'Rarity', value: item.rarity })
  }

  if (item.ukChartPosition) {
    attributes.push({ trait_type: 'UK Chart Position (Peak)', value: item.ukChartPosition })
  }

  if (item.isRareRelease !== undefined) {
    attributes.push({ trait_type: 'Rare Release', value: item.isRareRelease ? 'Yes' : 'No' })
  }

  if (item.isRareRelease && item.matrixNumbers && item.matrixNumbers.length > 0) {
    attributes.push({
      trait_type: 'Rare Release Matrix',
      value: item.matrixNumbers.join(' / '),
    })
  }

  if (item.totalAlbumsReleased) {
    attributes.push({ trait_type: 'Total Albums Released by Artist', value: item.totalAlbumsReleased })
  }

  if (item.purchasePrice && item.estimatedValue?.estimateMid && item.purchasePrice > 0) {
    const appreciation = ((item.estimatedValue.estimateMid - item.purchasePrice) / item.purchasePrice) * 100
    attributes.push({
      trait_type: 'Value Appreciation',
      value: `${appreciation >= 0 ? '+' : ''}${appreciation.toFixed(1)}%`,
    })
  }

  if (item.storageLocation) {
    attributes.push({ trait_type: 'Storage Location', value: item.storageLocation })
  }

  if (item.purchasePrice && item.purchaseCurrency) {
    attributes.push({ 
      trait_type: 'Purchase Price', 
      value: `${item.purchasePrice} ${item.purchaseCurrency}` 
    })
  }

  if (item.acquisitionDate) {
    attributes.push({ trait_type: 'Acquisition Date', value: item.acquisitionDate })
  }

  if (item.sourceType) {
    attributes.push({ trait_type: 'Source', value: item.sourceType })
  }

  if (item.estimatedValue) {
    attributes.push({ 
      trait_type: 'Estimated Value', 
      value: `${item.estimatedValue.estimateMid} ${item.estimatedValue.currency}` 
    })
    attributes.push({ 
      trait_type: 'Value Confidence', 
      value: `${(item.estimatedValue.confidenceScore * 100).toFixed(0)}%` 
    })
  }

  if (item.discogsId) {
    attributes.push({ trait_type: 'Discogs Release ID', value: item.discogsId })
  }

  if (item.discogsReleaseId) {
    attributes.push({ trait_type: 'Discogs Master ID', value: item.discogsReleaseId })
  }

  if (item.pressingId) {
    attributes.push({ trait_type: 'Pressing ID', value: item.pressingId })
  }

  if (item.condition.gradingNotes) {
    attributes.push({ 
      trait_type: 'Condition Notes', 
      value: item.condition.gradingNotes.substring(0, 100) 
    })
  }

  const name = `${item.artistName} - ${item.releaseTitle} (${item.year})`
  
  let description = `${name}\n\n`
  description += `Format: ${item.format}\n`
  description += `Country: ${item.country}\n`
  
  if (item.catalogNumber) {
    description += `Catalog Number: ${item.catalogNumber}\n`
  }
  
  if (item.labelName) {
    description += `Label: ${item.labelName}\n`
  }
  
  if (item.matrixNumbers && item.matrixNumbers.length > 0) {
    description += `Matrix/Runout: ${item.matrixNumbers.join(' / ')}\n`
  }
  
  if (item.vinylColor) {
    description += `Vinyl: ${item.vinylColor}\n`
  }
  
  description += `\nCondition:\n`
  description += `Media: ${item.condition.mediaGrade} (${item.condition.gradingStandard})\n`
  description += `Sleeve: ${item.condition.sleeveGrade} (${item.condition.gradingStandard})\n`
  
  if (item.condition.gradingNotes) {
    description += `\nGrading Notes:\n${item.condition.gradingNotes}\n`
  }
  
  if (item.acquisitionDate) {
    description += `\nAcquired: ${item.acquisitionDate}`
    if (item.sourceType) {
      description += ` (${item.sourceType})`
    }
    description += `\n`
  }
  
  if (item.purchasePrice && item.purchaseCurrency) {
    description += `Purchase Price: ${item.purchasePrice} ${item.purchaseCurrency}\n`
  }
  
  if (item.estimatedValue) {
    description += `\nCurrent Estimated Value: ${item.estimatedValue.estimateMid} ${item.estimatedValue.currency}`
    if (item.estimatedValue.confidenceScore) {
      description += ` (${(item.estimatedValue.confidenceScore * 100).toFixed(0)}% confidence)`
    }
    description += `\n`
  }

  if (item.purchasePrice && item.purchasePrice > 0 && item.estimatedValue?.estimateMid) {
    const appreciation = ((item.estimatedValue.estimateMid - item.purchasePrice) / item.purchasePrice) * 100
    description += `Value Appreciation: ${appreciation >= 0 ? '+' : ''}${appreciation.toFixed(1)}% since acquisition\n`
  }
  
  if (item.priceHistory && item.priceHistory.length > 1) {
    const firstPrice = item.priceHistory[0].estimatedValue
    const latestPrice = item.priceHistory[item.priceHistory.length - 1].estimatedValue
    const change = ((latestPrice - firstPrice) / firstPrice) * 100
    description += `Value Change: ${change > 0 ? '+' : ''}${change.toFixed(1)}% since first recorded price\n`
  }

  if (item.isRareRelease) {
    description += `\nRare Release: Yes\n`
    if (item.matrixNumbers && item.matrixNumbers.length > 0) {
      description += `Rare Release Matrix: ${item.matrixNumbers.join(' / ')}\n`
    }
  }

  if (item.totalAlbumsReleased) {
    description += `Total Albums Released by Artist: ${item.totalAlbumsReleased}\n`
  }
  
  if (item.notes) {
    description += `\nCollector Notes:\n${item.notes}\n`
  }

  if (item.anecdotes && item.anecdotes.length > 0) {
    description += `\nAnecdotes:\n`
    item.anecdotes.forEach((anecdote, i) => {
      description += `${i + 1}. ${anecdote}\n`
    })
  }
  
  if (item.discogsId) {
    description += `\nDiscogs Release: https://www.discogs.com/release/${item.discogsId}\n`
  }
  
  description += `\n━━━━━━━━━━━━━━━━━━━━\n`
  description += `This NFT represents a verified physical vinyl record in the VinylVault collection.\n`
  description += `It provides immutable on-chain provenance, authenticity tracking, and ownership history.\n`
  description += `The physical record is stored at: ${item.storageLocation || 'Secure location'}\n`

  return {
    itemId: item.id,
    name: name.substring(0, 32),
    symbol: NFT_SYMBOL,
    description,
    imageUrl: itemImageUrl,
    sellerFeeBasisPoints: 1000,
    creators: [
      {
        address: walletAddress,
        share: 100,
      },
    ],
    attributes,
  }
}

export async function uploadMetadataToArweave(metadata: SolanaNFTMetadata): Promise<string> {
  const metadataJson = JSON.stringify(metadata, null, 2)
  const blob = new Blob([metadataJson], { type: 'application/json' })
  
  const encoder = new TextEncoder()
  const data = encoder.encode(metadataJson)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  return `https://arweave.net/${hashHex.substring(0, 43)}`
}

async function getWalletAdapter(walletType: string) {
  switch (walletType) {
    case 'phantom':
      return window.solana
    case 'solflare':
      return window.solflare
    case 'backpack':
      return window.backpack
    default:
      throw new Error('Unsupported wallet type')
  }
}

export async function mintNFTWithMetaplex(
  config: NFTMintConfig,
  walletAddress: string,
  walletType: string,
  network: SolanaNetwork = 'devnet'
): Promise<MintNFTResult> {
  try {
    const rpcEndpoint = SOLANA_NETWORKS[network]
    const umi = createUmi(rpcEndpoint).use(mplCore())
    
    const wallet = await getWalletAdapter(walletType)
    if (!wallet || !wallet.publicKey) {
      throw new Error('Wallet not connected')
    }

    const metadata = buildNFTMetadata(config)
    const metadataUri = await uploadMetadataToArweave(metadata)

    const assetSigner = generateSigner(umi)
    const owner = umiPublicKey(walletAddress)
    
    const royaltyPercent = config.sellerFeeBasisPoints / 100

    const createInstruction = createV1(umi, {
      asset: assetSigner,
      name: config.name,
      uri: metadataUri,
      plugins: [
        pluginAuthorityPair({
          type: 'Royalties',
          data: {
            basisPoints: config.sellerFeeBasisPoints,
            creators: config.creators.map(creator => ({
              address: umiPublicKey(creator.address),
              percentage: creator.share,
            })),
            ruleSet: { type: 'None' },
          },
        }),
      ],
    })

    const tx = await createInstruction.buildAndSign(umi)
    
    const signature = await wallet.signAndSendTransaction(tx)

    return {
      success: true,
      mintAddress: assetSigner.publicKey.toString(),
      transactionSignature: signature,
      metadataUri,
    }
  } catch (error) {
    console.error('Metaplex minting error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during NFT minting',
    }
  }
}

export async function simulateMintNFT(
  config: NFTMintConfig,
  walletAddress: string,
  network: SolanaNetwork = 'devnet'
): Promise<MintNFTResult> {
  try {
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const metadata = buildNFTMetadata(config)
    
    const mockMetadataUri = `https://arweave.net/mock-${Date.now()}`
    const mockMintAddress = `${walletAddress.substring(0, 8)}...${Math.random().toString(36).substring(2, 10)}`
    const mockSignature = `mock-sig-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`

    return {
      success: true,
      mintAddress: mockMintAddress,
      transactionSignature: mockSignature,
      metadataUri: mockMetadataUri,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during NFT minting',
    }
  }
}

export function buildMintedNFTRecord(
  mintResult: MintNFTResult,
  config: NFTMintConfig,
  walletAddress: string,
  network: SolanaNetwork
): MintedNFT {
  if (!mintResult.success || !mintResult.mintAddress || !mintResult.transactionSignature || !mintResult.metadataUri) {
    throw new Error('Cannot build NFT record from failed mint result')
  }

  return {
    id: `nft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    itemId: config.itemId,
    mintAddress: mintResult.mintAddress,
    metadataUri: mintResult.metadataUri,
    transactionSignature: mintResult.transactionSignature,
    network,
    mintedAt: new Date().toISOString(),
    ownerAddress: walletAddress,
    sellerFeeBasisPoints: config.sellerFeeBasisPoints,
  }
}

export function getRoyaltyPercentage(sellerFeeBasisPoints: number): number {
  return sellerFeeBasisPoints / 100
}

export function formatRoyaltyBadge(sellerFeeBasisPoints: number): string {
  const percentage = getRoyaltyPercentage(sellerFeeBasisPoints)
  return `${percentage}% Royalty`
}
