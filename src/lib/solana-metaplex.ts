import { 
  SolanaNFTMetadata, 
  NFTMintConfig, 
  SolanaNetwork,
  buildNFTMetadata,
  SOLANA_NETWORKS
} from './solana-nft'
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
  createSignerFromKeypair,
  signerIdentity,
  KeypairSigner,
} from '@metaplex-foundation/umi'

export interface MetaplexMintResult {
  success: boolean
  mintAddress?: string
  transactionSignature?: string
  metadataUri?: string
  error?: string
}

export async function uploadMetadataToArweave(metadata: SolanaNFTMetadata): Promise<string> {
  const metadataJson = JSON.stringify(metadata, null, 2)
  const encoder = new TextEncoder()
  const data = encoder.encode(metadataJson)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  return `https://arweave.net/${hashHex.substring(0, 43)}`
}

export async function mintNFTWithMetaplex(
  config: NFTMintConfig,
  walletAddress: string,
  walletType: string,
  network: SolanaNetwork = 'devnet'
): Promise<MetaplexMintResult> {
  try {
    const rpcEndpoint = SOLANA_NETWORKS[network]
    const umi = createUmi(rpcEndpoint).use(mplCore())
    
    const metadata = buildNFTMetadata(config)
    const metadataUri = await uploadMetadataToArweave(metadata)

    const assetSigner = generateSigner(umi)
    
    const tx = await createV1(umi, {
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
            ruleSet: ruleSet('None'),
          },
        }),
      ],
    }).sendAndConfirm(umi)

    return {
      success: true,
      mintAddress: assetSigner.publicKey,
      transactionSignature: String(tx.signature),
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
