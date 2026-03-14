import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WalletConnect } from '@/components/WalletConnect'
import { NFTCard } from '@/components/NFTCard'
import { NFTTransactionHistoryDialog } from '@/components/NFTTransactionHistoryDialog'
import { BatchNFTMintDialog } from '@/components/BatchNFTMintDialog'
import EbayListingDialog from '@/components/EbayListingDialog'
import { useWallet } from '@/hooks/use-wallet'
import { MintedNFT, CollectionItem, ItemImage } from '@/lib/types'
import { 
  Wallet, 
  Coins, 
  Clock, 
  CheckCircle, 
  Lightning, 
  ArrowSquareOut,
  Stack,
  Info
} from '@phosphor-icons/react'
import { getExplorerUrl } from '@/lib/solana-nft'
import { generateEbayListingPackage } from '@/lib/listing-ai'
import { toast } from 'sonner'

export default function NFTView() {
  const { wallet, isConnected } = useWallet()
  const [mintedNFTs, setMintedNFTs] = useKV<MintedNFT[]>('vinyl-vault-minted-nfts', [])
  const [collectionItems] = useKV<CollectionItem[]>('vinyl-vault-collection', [])
  const [itemImages] = useKV<ItemImage[]>('vinyl-vault-images', [])
  const [showTransactionHistory, setShowTransactionHistory] = useState(false)
  const [showBatchMint, setShowBatchMint] = useState(false)
  const [showListingDialog, setShowListingDialog] = useState(false)
  const [selectedNFT, setSelectedNFT] = useState<MintedNFT | null>(null)
  const [currentListingPackage, setCurrentListingPackage] = useState<any>(null)
  const [isGeneratingListing, setIsGeneratingListing] = useState(false)

  const safeCollectionItems = collectionItems || []
  const safeMintedNFTs = mintedNFTs || []
  const safeItemImages = itemImages || []

  const unmintedItems = safeCollectionItems.filter(
    item => !safeMintedNFTs.some(nft => nft.itemId === item.id)
  )

  const handleViewTransaction = (nft: MintedNFT) => {
    setSelectedNFT(nft)
    setShowTransactionHistory(true)
  }

  const handleBatchMintComplete = (newNFTs: MintedNFT[]) => {
    setMintedNFTs(current => [...(current || []), ...newNFTs])
    setShowBatchMint(false)
  }

  const handleCreateListing = async (item: CollectionItem, nft: MintedNFT) => {
    setIsGeneratingListing(true)
    try {
      const itemImagesForItem = safeItemImages.filter(img => img.itemId === item.id)
      
      const listingPackage = await generateEbayListingPackage(item, itemImagesForItem, 'ebay')
      
      const enhancedDescription = `
        <div style="margin-bottom: 20px; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px;">
          <h3 style="margin: 0 0 10px 0; font-size: 18px; font-weight: bold;">🎵 Blockchain-Verified Authenticity</h3>
          <p style="margin: 0 0 8px 0; font-size: 14px;">This vinyl record has been minted as an NFT on the Solana blockchain, providing immutable proof of authenticity and ownership history.</p>
          <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 4px; margin-top: 10px;">
            <p style="margin: 0; font-size: 12px; font-family: monospace;"><strong>NFT Mint Address:</strong> ${nft.mintAddress}</p>
            <p style="margin: 5px 0 0 0; font-size: 12px;"><strong>Network:</strong> Solana ${nft.network}</p>
            <p style="margin: 5px 0 0 0; font-size: 12px;"><strong>Royalty:</strong> ${(nft.sellerFeeBasisPoints / 100).toFixed(1)}% on secondary sales</p>
          </div>
          <p style="margin: 10px 0 0 0; font-size: 11px;">✓ Verifiable on Solana Explorer<br/>✓ Transferable NFT ownership certificate included<br/>✓ Web3 collector status</p>
        </div>
      ` + listingPackage.htmlDescription
      
      setCurrentListingPackage({
        ...listingPackage,
        htmlDescription: enhancedDescription,
        title: `${listingPackage.title} [NFT-Verified]`,
      })
      setShowListingDialog(true)
      
      toast.success('Listing generated!', {
        description: 'Your NFT-verified marketplace listing is ready with blockchain certification'
      })
    } catch (error) {
      toast.error('Failed to generate listing', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    } finally {
      setIsGeneratingListing(false)
    }
  }

  const totalValue = safeMintedNFTs.reduce((sum, nft) => {
    const item = safeCollectionItems.find(i => i.id === nft.itemId)
    return sum + (item?.estimatedValue?.estimateMid || 0)
  }, 0)

  if (!isConnected) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">NFT Minting</h2>
            <p className="text-sm text-slate-400 mt-1">Mint your vinyl collection as Solana NFTs</p>
          </div>
        </div>

        <Alert className="bg-accent/10 border-accent/30">
          <Wallet size={20} className="text-accent" />
          <AlertDescription className="ml-2">
            <div className="font-semibold text-accent-foreground mb-2">Connect Your Solana Wallet</div>
            <p className="text-sm text-slate-300 mb-4">
              To mint NFTs representing your vinyl records, you'll need to connect a Solana wallet. 
              We support Phantom, Solflare, and Backpack wallets on Solana devnet.
            </p>
            <WalletConnect className="w-full sm:w-auto" />
          </AlertDescription>
        </Alert>

        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins size={20} className="text-accent" />
              Why Mint NFTs?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div className="flex items-start gap-3">
              <CheckCircle size={20} className="text-accent flex-shrink-0 mt-0.5" weight="fill" />
              <div>
                <div className="font-semibold text-white">Digital Provenance</div>
                <div>Create an immutable blockchain record of your vinyl ownership</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle size={20} className="text-accent flex-shrink-0 mt-0.5" weight="fill" />
              <div>
                <div className="font-semibold text-white">Secondary Royalties</div>
                <div>Earn up to 10% royalties on future resales of your NFTs</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle size={20} className="text-accent flex-shrink-0 mt-0.5" weight="fill" />
              <div>
                <div className="font-semibold text-white">Rarity & Authenticity</div>
                <div>Prove authenticity and rarity with blockchain-verified metadata</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle size={20} className="text-accent flex-shrink-0 mt-0.5" weight="fill" />
              <div>
                <div className="font-semibold text-white">Web3 Collector Status</div>
                <div>Join the next generation of vinyl collectors with verifiable digital assets</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">NFT Collection</h2>
            <p className="text-sm text-slate-400 mt-1">
              {safeMintedNFTs.length} NFT{safeMintedNFTs.length !== 1 ? 's' : ''} minted • {unmintedItems.length} unminted item{unmintedItems.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {unmintedItems.length > 0 && (
              <Button
                onClick={() => setShowBatchMint(true)}
                variant="outline"
                className="gap-2 flex-1 sm:flex-initial"
              >
                <Stack size={18} />
                Batch Mint ({unmintedItems.length})
              </Button>
            )}
            <WalletConnect className="flex-1 sm:flex-initial" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-accent/20 to-accent/5 border-accent/30">
            <CardHeader className="pb-3">
              <CardDescription className="text-slate-400">Total Minted</CardDescription>
              <CardTitle className="text-3xl text-white">{safeMintedNFTs.length}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-blue-500/30">
            <CardHeader className="pb-3">
              <CardDescription className="text-slate-400">Collection Value</CardDescription>
              <CardTitle className="text-3xl text-white">
                ${totalValue.toFixed(0)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 border-purple-500/30">
            <CardHeader className="pb-3">
              <CardDescription className="text-slate-400">Network</CardDescription>
              <CardTitle className="text-2xl text-white flex items-center gap-2">
                Solana
                <Badge variant="outline" className="text-xs bg-purple-500/20 border-purple-500/40">
                  Devnet
                </Badge>
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/20 to-green-500/5 border-green-500/30">
            <CardHeader className="pb-3">
              <CardDescription className="text-slate-400">Wallet</CardDescription>
              <CardTitle className="text-lg text-white font-mono truncate">
                {wallet?.publicKey.slice(0, 4)}...{wallet?.publicKey.slice(-4)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="gallery" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
          <TabsTrigger value="gallery" className="gap-2">
            <Coins size={18} />
            Gallery
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock size={18} />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gallery" className="space-y-4 mt-6">
          {(mintedNFTs || []).length === 0 ? (
            <Card className="bg-card/50 border-border">
              <CardContent className="py-12 text-center">
                <Coins size={48} className="mx-auto text-slate-600 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No NFTs Minted Yet</h3>
                <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
                  Start minting NFTs from your collection to create blockchain-verified digital certificates of your vinyl records.
                </p>
                {unmintedItems.length > 0 && (
                  <Button onClick={() => setShowBatchMint(true)} className="gap-2">
                    <Lightning size={18} />
                    Mint Your First NFT
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {safeMintedNFTs.map((nft) => {
                const item = safeCollectionItems.find(i => i.id === nft.itemId)
                return (
                  <NFTCard
                    key={nft.id}
                    nft={nft}
                    item={item}
                    onViewHistory={() => handleViewTransaction(nft)}
                    onCreateListing={item ? handleCreateListing : undefined}
                  />
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-6">
          {(mintedNFTs || []).length === 0 ? (
            <Card className="bg-card/50 border-border">
              <CardContent className="py-12 text-center">
                <Clock size={48} className="mx-auto text-slate-600 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No Transaction History</h3>
                <p className="text-sm text-slate-400">
                  Your minting transactions will appear here once you start minting NFTs.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock size={20} />
                  Recent Transactions
                </CardTitle>
                <CardDescription>
                  All NFT minting activity on Solana devnet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {safeMintedNFTs
                    .sort((a, b) => new Date(b.mintedAt).getTime() - new Date(a.mintedAt).getTime())
                    .map((nft) => {
                      const item = safeCollectionItems.find(i => i.id === nft.itemId)
                      return (
                        <div
                          key={nft.id}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                              <Coins size={24} className="text-accent" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-white truncate">
                                {item?.artistName} - {item?.releaseTitle}
                              </div>
                              <div className="text-xs text-slate-400 font-mono">
                                {new Date(nft.mintedAt).toLocaleDateString()} • {nft.mintAddress.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(getExplorerUrl(nft.mintAddress, nft.network), '_blank')}
                            title="View on Solana Explorer"
                            className="flex-shrink-0"
                          >
                            <ArrowSquareOut size={18} />
                          </Button>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Alert className="bg-blue-500/10 border-blue-500/30">
        <Info size={20} className="text-blue-400" />
        <AlertDescription className="ml-2 text-sm text-slate-300">
          <span className="font-semibold text-blue-400">Devnet Notice:</span> All NFTs are minted on Solana devnet for testing. 
          These are not real assets but simulate the full minting experience. Production deployment would use mainnet.
        </AlertDescription>
      </Alert>

      {selectedNFT && (
        <NFTTransactionHistoryDialog
          open={showTransactionHistory}
          onOpenChange={setShowTransactionHistory}
          nft={selectedNFT}
        />
      )}

      <BatchNFTMintDialog
        open={showBatchMint}
        onOpenChange={setShowBatchMint}
        items={unmintedItems}
        onMintComplete={handleBatchMintComplete}
      />

      {currentListingPackage && (
        <EbayListingDialog
          open={showListingDialog}
          onOpenChange={setShowListingDialog}
          listingPackage={currentListingPackage}
          images={safeItemImages.filter(img => img.itemId === currentListingPackage.itemId)}
        />
      )}
    </div>
  )
}
