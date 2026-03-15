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
  let pinataJwt: string | undefined
  try {
    const sparkKv = (globalThis as any)?.spark?.kv
    if (sparkKv && typeof sparkKv.get === 'function') {
      const apiKeys = await sparkKv.get('vinyl-vault-api-keys')
      if (apiKeys && typeof apiKeys === 'object') {
        pinataJwt = typeof apiKeys.pinataJwt === 'string' ? apiKeys.pinataJwt : undefined
      }
    }
  } catch {
    // KV not available in this context
  }

  if (!pinataJwt) {
    throw new Error(
      'NFT metadata upload requires a Pinata JWT. Please configure your Pinata API key in Settings to enable on-chain minting.'
    )
  }

  const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${pinataJwt}`,
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: {
        name: `${metadata.name || 'nft'}-metadata.json`,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Metadata upload to IPFS failed: ${response.status} ${errorText}`)
  }

  const result = await response.json()

  if (!result.IpfsHash) {
    throw new Error('IPFS upload succeeded but no content hash returned')
  }

  return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`
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
      transactionSignature: tx.signature,
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
