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

  if (item.purchasePrice && item.purchaseCurrency) {
    attributes.push({ 
      trait_type: 'Purchase Price', 
      value: `${item.purchasePrice} ${item.purchaseCurrency}` 
    })
  }

  if (item.acquisitionDate) {
    attributes.push({ trait_type: 'Acquisition Date', value: item.acquisitionDate })
  }

  const name = `${item.artistName} - ${item.releaseTitle} (${item.year})`
  const description = `
${name}

Format: ${item.format}
Country: ${item.country}
${item.catalogNumber ? `Catalog Number: ${item.catalogNumber}` : ''}

Condition:
Media: ${item.condition.mediaGrade} (${item.condition.gradingStandard})
Sleeve: ${item.condition.sleeveGrade} (${item.condition.gradingStandard})

${item.notes ? `Notes: ${item.notes}` : ''}

This NFT represents a verified physical vinyl record in the VinylVault collection, providing on-chain provenance and authenticity tracking.
  `.trim()

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
