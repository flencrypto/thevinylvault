import { useState } from 'react'
import { CollectionItem, MintedNFT, SolanaNetwork } from '@/lib/types'
import { prepareNFTMetadataFromItem, simulateMintNFT, buildMintedNFTRecord } from '@/lib/solana-service'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'
import { Coins, CheckCircle, Warning, Clock, X, CurrencyDollar } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface BatchNFTMintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CollectionItem[]
  onMintComplete: (nfts: MintedNFT[]) => void
}

interface BatchMintResult {
  item: CollectionItem
  nft: MintedNFT | null
  status: 'pending' | 'processing' | 'complete' | 'error'
  error?: string
}

export function BatchNFTMintDialog({ open, onOpenChange, items, onMintComplete }: BatchNFTMintDialogProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<BatchMintResult[]>([])
  const [progress, setProgress] = useState(0)
  const [walletAddress, setWalletAddress] = useState('')
  const [network, setNetwork] = useState<SolanaNetwork>('devnet')
  const [royaltyBasisPoints, setRoyaltyBasisPoints] = useState(1000)

  const handleStartMinting = async () => {
    if (!walletAddress.trim()) {
      toast.error('Please enter a wallet address')
      return
    }

    setIsRunning(true)
    setProgress(0)

    const initialResults: BatchMintResult[] = items.map(item => ({
      item,
      nft: null,
      status: 'pending',
    }))

    setResults(initialResults)

    const completedNFTs: MintedNFT[] = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      setResults(prev => prev.map((r, idx) =>
        idx === i ? { ...r, status: 'processing' } : r
      ))

      try {
        const nftConfig = await prepareNFTMetadataFromItem(item, walletAddress)
        nftConfig.sellerFeeBasisPoints = royaltyBasisPoints

        const mintResult = await simulateMintNFT(nftConfig, walletAddress, network)

        if (!mintResult.success) {
          setResults(prev => prev.map((r, idx) =>
            idx === i ? {
              ...r,
              status: 'error',
              error: mintResult.error || 'Minting failed',
            } : r
          ))
        } else {
          const nftRecord = buildMintedNFTRecord(mintResult, nftConfig, walletAddress, network)
          completedNFTs.push(nftRecord)

          setResults(prev => prev.map((r, idx) =>
            idx === i ? { ...r, nft: nftRecord, status: 'complete' } : r
          ))
        }
      } catch (error) {
        setResults(prev => prev.map((r, idx) =>
          idx === i ? {
            ...r,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          } : r
        ))
      }

      setProgress(((i + 1) / items.length) * 100)

      if (i < items.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    setIsRunning(false)

    if (completedNFTs.length > 0) {
      toast.success(`Minted ${completedNFTs.length} NFTs successfully`)
    }
  }

  const handleSaveAll = () => {
    const completedNFTs = results
      .filter(r => r.status === 'complete' && r.nft)
      .map(r => r.nft!)

    onMintComplete(completedNFTs)
    toast.success(`Added ${completedNFTs.length} NFTs to your collection`)
    onOpenChange(false)

    setTimeout(() => {
      setResults([])
      setProgress(0)
      setWalletAddress('')
    }, 300)
  }

  const completedCount = results.filter(r => r.status === 'complete').length
  const errorCount = results.filter(r => r.status === 'error').length
  const royaltyPercentage = royaltyBasisPoints / 100

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/20 rounded-lg">
                <Coins size={24} className="text-accent" weight="fill" />
              </div>
              <div>
                <DialogTitle className="text-2xl">Bulk NFT Minting</DialogTitle>
                <DialogDescription>
                  Mint {items.length} items as Solana NFTs
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          {results.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
              <div className="p-4 bg-accent/10 rounded-full">
                <Coins size={48} className="text-accent" weight="duotone" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">
                  Ready to mint {items.length} NFTs
                </h3>
                <p className="text-muted-foreground text-sm max-w-md mb-6">
                  Create blockchain certificates for your vinyl collection with on-chain provenance and royalties. 
                  This process may take several minutes.
                </p>

                <div className="max-w-md mx-auto space-y-4 mb-6">
                  <div>
                    <Label htmlFor="wallet" className="text-left block mb-2">
                      Wallet Address *
                    </Label>
                    <Input
                      id="wallet"
                      placeholder="Your Solana wallet address..."
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="network" className="text-left block mb-2">
                        Network
                      </Label>
                      <Select value={network} onValueChange={(v) => setNetwork(v as SolanaNetwork)}>
                        <SelectTrigger id="network">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="devnet">Devnet (Testing)</SelectItem>
                          <SelectItem value="mainnet-beta">Mainnet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-left block mb-2">
                        Royalty: {royaltyPercentage}%
                      </Label>
                      <div className="flex items-center gap-3 pt-2">
                        <Slider
                          value={[royaltyBasisPoints]}
                          onValueChange={([value]) => setRoyaltyBasisPoints(value)}
                          min={0}
                          max={2000}
                          step={50}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleStartMinting}
                  className="gap-2"
                  size="lg"
                  disabled={!walletAddress.trim()}
                >
                  <Coins size={20} weight="fill" />
                  Mint All NFTs
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="gap-2">
                      <CheckCircle size={16} weight="fill" className="text-green-500" />
                      {completedCount} Minted
                    </Badge>
                    {errorCount > 0 && (
                      <Badge variant="outline" className="gap-2">
                        <Warning size={16} weight="fill" className="text-destructive" />
                        {errorCount} Errors
                      </Badge>
                    )}
                    {isRunning && (
                      <Badge variant="outline" className="gap-2">
                        <Clock size={16} weight="fill" className="text-accent" />
                        Minting...
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="gap-2">
                      <CurrencyDollar size={16} weight="fill" />
                      {royaltyPercentage}% Royalty
                    </Badge>
                    <Badge variant="outline">
                      {network === 'devnet' ? 'Devnet' : 'Mainnet'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {completedCount + errorCount} of {items.length} items processed
                    </span>
                    <span className="font-mono">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              </div>

              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-3 pr-4">
                  {results.map((result, idx) => (
                    <div
                      key={result.item.id}
                      className={`p-4 border rounded-lg transition-all ${
                        result.status === 'processing'
                          ? 'border-accent bg-accent/5'
                          : result.status === 'complete'
                          ? 'border-border bg-card'
                          : result.status === 'error'
                          ? 'border-destructive/50 bg-destructive/5'
                          : 'border-border bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-muted-foreground">
                              #{(idx + 1).toString().padStart(3, '0')}
                            </span>
                            {result.status === 'complete' && (
                              <CheckCircle size={16} weight="fill" className="text-green-500 flex-shrink-0" />
                            )}
                            {result.status === 'processing' && (
                              <Clock size={16} weight="fill" className="text-accent animate-pulse flex-shrink-0" />
                            )}
                            {result.status === 'error' && (
                              <X size={16} weight="bold" className="text-destructive flex-shrink-0" />
                            )}
                          </div>
                          <h4 className="font-semibold truncate">
                            {result.item.artistName} - {result.item.releaseTitle}
                          </h4>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span>{result.item.format}</span>
                            <span>•</span>
                            <span>{result.item.year}</span>
                            <span>•</span>
                            <span>
                              {result.item.condition.mediaGrade}/{result.item.condition.sleeveGrade}
                            </span>
                          </div>
                          {result.status === 'error' && result.error && (
                            <p className="text-xs text-destructive mt-2">{result.error}</p>
                          )}
                          {result.nft && (
                            <div className="mt-2 flex items-center gap-2">
                              <Badge variant="outline" className="text-xs font-mono">
                                {result.nft.mintAddress.slice(0, 8)}...{result.nft.mintAddress.slice(-6)}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Solana NFT
                              </Badge>
                            </div>
                          )}
                        </div>

                        {result.nft && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Coins size={32} className="text-accent" weight="fill" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {isRunning ? 'Minting in progress...' : results.length > 0 ? 'Minting complete' : 'Ready to start'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isRunning}
            >
              {results.length > 0 ? 'Close' : 'Cancel'}
            </Button>
            {completedCount > 0 && !isRunning && (
              <Button
                onClick={handleSaveAll}
                className="gap-2"
              >
                <CheckCircle size={18} weight="fill" />
                Save {completedCount} NFTs
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
