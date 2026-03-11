import { NFTTransaction, NFTTransactionType, MintedNFT } from './types'

export async function fetchNFTTransactions(
  nft: MintedNFT
): Promise<NFTTransaction[]> {
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const transactions: NFTTransaction[] = []
  
  const mintTransaction: NFTTransaction = {
    id: `tx-${Date.now()}-1`,
    nftId: nft.id,
    type: 'mint',
    toAddress: nft.ownerAddress,
    transactionSignature: nft.transactionSignature,
    blockTime: nft.mintedAt,
    status: 'confirmed',
    feePayer: nft.ownerAddress,
    fee: 0.005,
    metadata: {
      royaltyBps: nft.sellerFeeBasisPoints,
    },
  }
  transactions.push(mintTransaction)
  
  const mintDate = new Date(nft.mintedAt)
  const daysSinceMint = Math.floor((Date.now() - mintDate.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysSinceMint > 7 && Math.random() > 0.5) {
    const listDate = new Date(mintDate.getTime() + (7 * 24 * 60 * 60 * 1000))
    transactions.push({
      id: `tx-${Date.now()}-2`,
      nftId: nft.id,
      type: 'list',
      fromAddress: nft.ownerAddress,
      transactionSignature: `list-${nft.transactionSignature.substring(0, 20)}-${Math.random().toString(36).substring(2, 10)}`,
      blockTime: listDate.toISOString(),
      salePrice: generateListingPrice(),
      saleCurrency: 'SOL',
      marketplace: selectRandomMarketplace(),
      status: 'confirmed',
      feePayer: nft.ownerAddress,
      fee: 0.001,
    })
  }
  
  if (daysSinceMint > 30 && Math.random() > 0.6) {
    const saleDate = new Date(mintDate.getTime() + (30 * 24 * 60 * 60 * 1000))
    const salePrice = generateSalePrice()
    const marketplace = selectRandomMarketplace()
    const buyer = generateRandomAddress()
    
    transactions.push({
      id: `tx-${Date.now()}-3`,
      nftId: nft.id,
      type: 'sale',
      fromAddress: nft.ownerAddress,
      toAddress: buyer,
      transactionSignature: `sale-${nft.transactionSignature.substring(0, 20)}-${Math.random().toString(36).substring(2, 10)}`,
      blockTime: saleDate.toISOString(),
      salePrice,
      saleCurrency: 'SOL',
      marketplace,
      status: 'confirmed',
      feePayer: buyer,
      fee: 0.003,
      metadata: {
        royaltyPaid: (salePrice * nft.sellerFeeBasisPoints) / 10000,
        marketplaceFee: salePrice * 0.025,
      },
    })
    
    if (Math.random() > 0.7) {
      const transferDate = new Date(saleDate.getTime() + (15 * 24 * 60 * 60 * 1000))
      const newOwner = generateRandomAddress()
      
      transactions.push({
        id: `tx-${Date.now()}-4`,
        nftId: nft.id,
        type: 'transfer',
        fromAddress: buyer,
        toAddress: newOwner,
        transactionSignature: `transfer-${nft.transactionSignature.substring(0, 20)}-${Math.random().toString(36).substring(2, 10)}`,
        blockTime: transferDate.toISOString(),
        status: 'confirmed',
        feePayer: buyer,
        fee: 0.0005,
      })
    }
  }
  
  return transactions.sort((a, b) => 
    new Date(b.blockTime).getTime() - new Date(a.blockTime).getTime()
  )
}

function generateListingPrice(): number {
  return Number((0.05 + Math.random() * 0.95).toFixed(4))
}

function generateSalePrice(): number {
  return Number((0.08 + Math.random() * 1.2).toFixed(4))
}

function selectRandomMarketplace(): string {
  const marketplaces = ['Magic Eden', 'Tensor', 'OpenSea', 'Solanart', 'Hyperspace']
  return marketplaces[Math.floor(Math.random() * marketplaces.length)]
}

function generateRandomAddress(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789'
  let address = ''
  for (let i = 0; i < 44; i++) {
    address += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return address
}

export function getTransactionTypeLabel(type: NFTTransactionType): string {
  const labels: Record<NFTTransactionType, string> = {
    mint: 'Minted',
    transfer: 'Transferred',
    sale: 'Sold',
    list: 'Listed',
    delist: 'Delisted',
    burn: 'Burned',
    update_metadata: 'Updated',
  }
  return labels[type]
}

export function getTransactionTypeColor(type: NFTTransactionType): string {
  const colors: Record<NFTTransactionType, string> = {
    mint: 'text-accent',
    transfer: 'text-blue-400',
    sale: 'text-green-400',
    list: 'text-yellow-400',
    delist: 'text-orange-400',
    burn: 'text-red-400',
    update_metadata: 'text-purple-400',
  }
  return colors[type]
}

export function formatSOL(amount: number): string {
  return `${amount.toFixed(4)} SOL`
}

export function calculateTotalVolume(transactions: NFTTransaction[]): number {
  return transactions
    .filter(tx => tx.type === 'sale' && tx.salePrice)
    .reduce((sum, tx) => sum + (tx.salePrice || 0), 0)
}

export function calculateRoyaltiesEarned(
  transactions: NFTTransaction[],
  sellerFeeBasisPoints: number
): number {
  return transactions
    .filter(tx => tx.type === 'sale' && tx.salePrice)
    .reduce((sum, tx) => {
      const royalty = ((tx.salePrice || 0) * sellerFeeBasisPoints) / 10000
      return sum + royalty
    }, 0)
}
