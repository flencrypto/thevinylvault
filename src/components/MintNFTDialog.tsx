import { useState } from 'react'
import { CollectionItem, MintedNFT, SolanaNetwork } from '@/lib/types'
import { prepareNFTMetadataFromItem, simulateMintNFT, buildMintedNFTRecord, formatRoyaltyBadge } from '@/lib/solana-service'
import { mintNFTWithMetaplex } from '@/lib/solana-metaplex'
import { getExplorerUrl, getAddressExplorerUrl } from '@/lib/solana-nft'
import { useWallet } from '@/hooks/use-wallet'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Coins, Sparkle, CheckCircle, Warning, CurrencyDollar, ArrowSquareOut, Wallet } from '@phosphor-icons/react'

interface MintNFTDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: CollectionItem | null
  onMintComplete: (nft: MintedNFT) => void
}

export function MintNFTDialog({ open, onOpenChange, item, onMintComplete }: MintNFTDialogProps) {
  const { wallet, isConnected } = useWallet()
  const [network, setNetwork] = useState<SolanaNetwork>('devnet')
  const [royaltyBasisPoints, setRoyaltyBasisPoints] = useState(1000)
  const [useRealMinting, setUseRealMinting] = useState(false)
  const [isMinting, setIsMinting] = useState(false)
  const [mintSuccess, setMintSuccess] = useState(false)
  const [mintError, setMintError] = useState<string | null>(null)
  const [mintedNFT, setMintedNFT] = useState<MintedNFT | null>(null)

  const walletAddress = wallet?.publicKey || ''

  const handleMint = async () => {
    if (!item || !walletAddress) return

    setIsMinting(true)
    setMintError(null)
    setMintSuccess(false)

    try {
      const nftConfig = await prepareNFTMetadataFromItem(item, walletAddress)
      nftConfig.sellerFeeBasisPoints = royaltyBasisPoints

      let mintResult

      if (useRealMinting && wallet?.walletType) {
        const metaplexResult = await mintNFTWithMetaplex(
          nftConfig,
          walletAddress,
          wallet.walletType,
          network
        )
        
        if (!metaplexResult.success) {
          setMintError(metaplexResult.error || 'Minting failed')
          setIsMinting(false)
          return
        }

        mintResult = {
          success: true,
          mintAddress: metaplexResult.mintAddress,
          transactionSignature: metaplexResult.transactionSignature,
          metadataUri: metaplexResult.metadataUri,
        }
      } else {
        mintResult = await simulateMintNFT(nftConfig, walletAddress, network)

        if (!mintResult.success) {
          setMintError(mintResult.error || 'Minting failed')
          setIsMinting(false)
          return
        }
      }

      const nftRecord = buildMintedNFTRecord(mintResult, nftConfig, walletAddress, network)
      setMintedNFT(nftRecord)
      setMintSuccess(true)
      
      onMintComplete(nftRecord)
    } catch (error) {
      setMintError(error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      setIsMinting(false)
    }
  }

  const handleClose = () => {
    if (!isMinting) {
      onOpenChange(false)
      setTimeout(() => {
        setMintSuccess(false)
        setMintError(null)
        setMintedNFT(null)
      }, 300)
    }
  }

  const royaltyPercentage = royaltyBasisPoints / 100

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins size={24} className="text-accent" weight="fill" />
            Mint as Solana NFT
          </DialogTitle>
          <DialogDescription>
            Create a verifiable, tradable NFT representing this physical vinyl record on the Solana blockchain
          </DialogDescription>
        </DialogHeader>

        {!mintSuccess ? (
          <div className="space-y-6 py-4">
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Sparkle size={18} className="text-accent" />
                NFT Preview
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-mono">{item.artistName} - {item.releaseTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Format:</span>
                  <span>{item.format}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Condition:</span>
                  <span>{item.condition.mediaGrade} / {item.condition.sleeveGrade}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Year:</span>
                  <span>{item.year}</span>
                </div>
                {item.catalogNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Catalog #:</span>
                    <span className="font-mono">{item.catalogNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rare Release:</span>
                  <Badge variant={item.isRareRelease ? 'default' : 'outline'} className="text-xs">
                    {item.isRareRelease ? 'Yes' : 'No'}
                  </Badge>
                </div>
                {item.isRareRelease && item.matrixNumbers && item.matrixNumbers.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rare Matrix:</span>
                    <span className="font-mono text-xs">{item.matrixNumbers.join(' / ')}</span>
                  </div>
                )}
                {item.rarity && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rarity:</span>
                    <Badge variant="secondary">{item.rarity}</Badge>
                  </div>
                )}
                {item.ukChartPosition && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">UK Chart Peak:</span>
                    <span>#{item.ukChartPosition}</span>
                  </div>
                )}
                {item.totalAlbumsReleased && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Albums by Artist:</span>
                    <span>{item.totalAlbumsReleased}</span>
                  </div>
                )}
                {item.purchasePrice && item.purchasePrice > 0 && item.estimatedValue?.estimateMid && (() => {
                  const appreciationPct = ((item.estimatedValue!.estimateMid - item.purchasePrice!) / item.purchasePrice!) * 100
                  return (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Value Appreciation:</span>
                      <span className={`font-semibold ${appreciationPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {appreciationPct >= 0 ? '+' : ''}{appreciationPct.toFixed(1)}%
                      </span>
                    </div>
                  )
                })()}
                {item.anecdotes && item.anecdotes.filter(a => a.trim()).length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Anecdotes:</span>
                    <span>{item.anecdotes.filter(a => a.trim()).length} recorded</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {!isConnected ? (
                <Alert>
                  <Wallet size={20} />
                  <AlertDescription className="ml-2">
                    Please connect your Solana wallet from the header to mint NFTs. The NFT will be minted directly to your connected wallet.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  <Label>Connected Wallet</Label>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-border">
                    <Wallet size={18} className="text-accent" />
                    <span className="font-mono text-sm flex-1">{walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}</span>
                    <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
                      {wallet?.walletType || 'Connected'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The NFT will be minted to this address on the selected network.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="network">Network</Label>
                <Select value={network} onValueChange={(value) => setNetwork(value as SolanaNetwork)}>
                  <SelectTrigger id="network">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="devnet">Devnet (Testing)</SelectItem>
                    <SelectItem value="testnet">Testnet</SelectItem>
                    <SelectItem value="mainnet-beta">Mainnet Beta (Production)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {network === 'mainnet-beta' 
                    ? '⚠️ Production network - requires real SOL for fees' 
                    : 'Free test network - perfect for testing'}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="real-mint">Real On-Chain Minting (Metaplex Core)</Label>
                    <p className="text-xs text-muted-foreground">
                      {useRealMinting 
                        ? 'NFT will be minted on Solana blockchain using Metaplex' 
                        : 'Simulation mode for testing (no blockchain transaction)'}
                    </p>
                  </div>
                  <Switch
                    id="real-mint"
                    checked={useRealMinting}
                    onCheckedChange={setUseRealMinting}
                  />
                </div>
                {useRealMinting && (
                  <Alert>
                    <Sparkle size={18} className="text-accent" />
                    <AlertDescription>
                      <strong>Blockchain Minting Enabled:</strong> This will create a real NFT on-chain with Metaplex Core. Transaction fees apply (~0.001-0.01 SOL).
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Secondary Sale Royalty</Label>
                  <Badge variant="secondary" className="gap-1">
                    <CurrencyDollar size={14} weight="bold" />
                    {formatRoyaltyBadge(royaltyBasisPoints)}
                  </Badge>
                </div>
                <Slider
                  value={[royaltyBasisPoints]}
                  onValueChange={(value) => setRoyaltyBasisPoints(value[0])}
                  min={0}
                  max={1000}
                  step={50}
                  className="py-4"
                />
                <p className="text-xs text-muted-foreground">
                  You'll receive {royaltyPercentage}% of the sale price every time this NFT is resold on secondary marketplaces
                </p>
              </div>
            </div>

            {mintError && (
              <Alert variant="destructive">
                <Warning size={18} />
                <AlertDescription>{mintError}</AlertDescription>
              </Alert>
            )}

            {network === 'mainnet-beta' && (
              <Alert>
                <Warning size={18} className="text-accent" />
                <AlertDescription>
                  <span className="font-semibold">Production Minting:</span> This will create a real NFT on Solana mainnet and require SOL for transaction fees (~0.01 SOL).
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="bg-accent/10 border border-accent rounded-lg p-6 text-center">
              <CheckCircle size={48} weight="fill" className="text-accent mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">NFT Minted Successfully!</h3>
              <p className="text-muted-foreground mb-4">
                Your vinyl record is now a verifiable Solana NFT
              </p>
              {mintedNFT && (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between bg-background rounded p-3">
                    <span className="text-muted-foreground">Mint Address:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{mintedNFT.mintAddress}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => window.open(getAddressExplorerUrl(mintedNFT.mintAddress, network), '_blank')}
                      >
                        <ArrowSquareOut size={14} />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-background rounded p-3">
                    <span className="text-muted-foreground">Transaction:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{mintedNFT.transactionSignature.substring(0, 16)}...</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => window.open(getExplorerUrl(mintedNFT.transactionSignature, network), '_blank')}
                      >
                        <ArrowSquareOut size={14} />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-background rounded p-3">
                    <span className="text-muted-foreground">Network:</span>
                    <Badge>{network}</Badge>
                  </div>
                  <div className="flex items-center justify-between bg-background rounded p-3">
                    <span className="text-muted-foreground">Royalty:</span>
                    <Badge variant="secondary">{formatRoyaltyBadge(mintedNFT.sellerFeeBasisPoints)}</Badge>
                  </div>
                </div>
              )}
            </div>

            <Alert>
              <Sparkle size={18} className="text-accent" />
              <AlertDescription>
                <strong>What's Next?</strong> Your NFT is now tradable on Solana marketplaces like Magic Eden, Tensor, and OpenSea. You'll earn royalties on all secondary sales.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {!mintSuccess ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isMinting}>
                Cancel
              </Button>
              <Button onClick={handleMint} disabled={!isConnected || !walletAddress || isMinting} className="gap-2">
                {isMinting ? (
                  <>
                    <Sparkle size={18} className="animate-spin" />
                    Minting NFT...
                  </>
                ) : (
                  <>
                    <Coins size={18} weight="fill" />
                    {isConnected ? 'Mint NFT' : 'Connect Wallet First'}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose} className="gap-2">
              <CheckCircle size={18} weight="fill" />
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
