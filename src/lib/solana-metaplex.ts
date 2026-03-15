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
} from '@metaplex-foundation/umi'

export interface MetaplexMintResult {
  success: boolean
  mintAddress?: string
  transactionSignature?: string
  metadataUri?: string
  error?: string
}

/**
 * Upload NFT metadata JSON to IPFS via the Pinata API and return a public
 * IPFS gateway URL.  Requires a Pinata JWT stored in Spark KV under the key
 * `vinyl-vault-api-keys` → `pinataJwt`.
 *
 * @throws if no Pinata JWT is configured or the upload fails
 */
export async function uploadMetadataToArweave(metadata: SolanaNFTMetadata): Promise<string> {
  // Read Pinata JWT from Spark KV (camelCase schema used by SettingsView)
  let pinataJwt = ''
  try {
    const sparkKv = (globalThis as any)?.spark?.kv
    if (sparkKv && typeof sparkKv.get === 'function') {
      const raw = await sparkKv.get('vinyl-vault-api-keys')
      const keys = raw as Record<string, string> | null
      if (keys && typeof keys === 'object') {
        pinataJwt = keys.pinataJwt || ''
      }
    }
  } catch { /* ignore KV errors */ }

  if (!pinataJwt) {
    throw new Error(
      'Pinata JWT not configured. Please add your Pinata JWT token in Settings → Pinata JWT (NFT Metadata).'
    )
  }

  const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pinataJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: { name: `${metadata.name}-metadata.json` },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Pinata upload failed (${response.status}): ${errText}`)
  }

  const result = await response.json()
  const cid: string = result.IpfsHash
  if (!cid) {
    throw new Error('Pinata returned no IPFS hash')
  }

  return `https://gateway.pinata.cloud/ipfs/${cid}`
}

/** Return the browser wallet adapter for the given wallet type. */
async function getWalletAdapter(walletType: string) {
  switch (walletType.toLowerCase()) {
    case 'phantom':
      return (window as any).solana
    case 'solflare':
      return (window as any).solflare
    case 'backpack':
      return (window as any).backpack
    default:
      throw new Error(`Unsupported wallet type: ${walletType}`)
  }
}

export async function mintNFTWithMetaplex(
  config: NFTMintConfig,
  walletAddress: string,
  walletType: string,
  network: SolanaNetwork = 'devnet'
): Promise<MetaplexMintResult> {
  try {
    // Resolve the connected browser wallet so the transaction can be signed
    const wallet = await getWalletAdapter(walletType)
    if (!wallet || !wallet.publicKey) {
      throw new Error('Wallet not connected. Please connect your wallet and try again.')
    }

    const rpcEndpoint = SOLANA_NETWORKS[network]
    const umi = createUmi(rpcEndpoint).use(mplCore())

    // Build and upload metadata to IPFS (Pinata) — returns a real, accessible URL
    const metadata = buildNFTMetadata(config)
    const metadataUri = await uploadMetadataToArweave(metadata)

    const assetSigner = generateSigner(umi)
    const ownerPublicKey = umiPublicKey(walletAddress)

    const createInstruction = createV1(umi, {
      asset: assetSigner,
      owner: ownerPublicKey,
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
    })

    // Build the transaction and pre-sign it with the asset keypair (required for
    // MPL Core createV1), then have the connected wallet add its signature as
    // fee payer/owner and broadcast.
    const tx = await createInstruction.buildAndSign(umi)
    const signature = await wallet.signAndSendTransaction(tx)

    return {
      success: true,
      mintAddress: assetSigner.publicKey.toString(),
      transactionSignature: typeof signature === 'string' ? signature : Buffer.from(signature).toString('base64'),
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
