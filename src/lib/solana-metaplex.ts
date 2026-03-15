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
  signerIdentity,
  Signer as UmiSigner,
  base58,
} from '@metaplex-foundation/umi'
import { VersionedTransaction, VersionedMessage } from '@solana/web3.js'

export interface MetaplexMintResult {
  success: boolean
  mintAddress?: string
  transactionSignature?: string
  metadataUri?: string
  error?: string
}

interface BrowserWalletProvider {
  publicKey: { toString: () => string } | null | undefined
  signTransaction?: (tx: VersionedTransaction) => Promise<VersionedTransaction>
  signMessage?: (message: Uint8Array, encoding?: string) => Promise<Uint8Array | { signature: Uint8Array }>
}

function getWalletProvider(walletType: string): BrowserWalletProvider | null {
  switch (walletType) {
    case 'phantom': return (window.solana as BrowserWalletProvider) ?? null
    case 'solflare': return (window.solflare as BrowserWalletProvider) ?? null
    case 'backpack': return (window.backpack as BrowserWalletProvider) ?? null
    default: return null
  }
}

function createBrowserWalletSigner(walletAddress: string, walletType: string): UmiSigner {
  const provider = getWalletProvider(walletType)
  if (!provider || !provider.publicKey) {
    throw new Error(`Wallet not connected for type: ${walletType}`)
  }

  const signTx = async (transaction: any): Promise<any> => {
    if (typeof provider.signTransaction !== 'function') {
      throw new Error('Wallet does not support signTransaction')
    }
    const message = VersionedMessage.deserialize(transaction.serializedMessage)
    const vtx = new VersionedTransaction(message)
    if (Array.isArray(transaction.signatures) && transaction.signatures.length > 0) {
      vtx.signatures = transaction.signatures.map(
        (sig: Uint8Array | null) => sig ?? new Uint8Array(64).fill(0)
      )
    }
    const signed = await provider.signTransaction(vtx)
    return { ...transaction, signatures: signed.signatures }
  }

  return {
    publicKey: umiPublicKey(walletAddress),
    async signMessage(message: Uint8Array): Promise<Uint8Array> {
      if (typeof provider.signMessage !== 'function') {
        throw new Error('Wallet does not support signMessage')
      }
      const result = await provider.signMessage(message, 'utf8')
      return result instanceof Uint8Array ? result : (result.signature as Uint8Array)
    },
    signTransaction: signTx,
    signAllTransactions: (transactions: any[]) => Promise.all(transactions.map(signTx)),
  }
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
    // Resolve the connected browser wallet so the transaction can be signed
    const wallet = await getWalletAdapter(walletType)
    if (!wallet || !wallet.publicKey) {
      throw new Error('Wallet not connected. Please connect your wallet and try again.')
    }

    const rpcEndpoint = SOLANA_NETWORKS[network]
    const umi = createUmi(rpcEndpoint).use(mplCore())

    // Attach the connected browser wallet as Umi's identity signer so that
    // it pays transaction fees and acts as the NFT authority.
    const walletSigner = createBrowserWalletSigner(walletAddress, walletType)
    umi.use(signerIdentity(walletSigner))
    
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
      transactionSignature: base58.deserialize(tx.signature)[0],
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
