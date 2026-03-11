import { MintedNFT } from '@/lib/types'
import { getExplorerUrl, getAddressExplorerUrl } from '@/lib/solana-nft'
import { formatRoyaltyBadge } from '@/lib/solana-service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Coins, ArrowSquareOut, Trash, CurrencyDollar, CheckCircle, ArrowsLeftRight } from '@phosphor-icons/react'

interface NFTCardProps {
  nft: MintedNFT
  itemTitle?: string
  itemImage?: string
  onDelete?: (nftId: string) => void
  onViewHistory?: (nft: MintedNFT) => void
}

export function NFTCard({ nft, itemTitle, itemImage, onDelete, onViewHistory }: NFTCardProps) {
  const mintedDate = new Date(nft.mintedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="bg-gradient-to-br from-primary/10 to-accent/10 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {itemImage && (
              <img 
                src={itemImage} 
                alt={itemTitle || 'NFT'} 
                className="w-12 h-12 rounded object-cover border-2 border-border"
              />
            )}
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Coins size={18} className="text-accent" weight="fill" />
                {itemTitle || 'Vinyl NFT'}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <CheckCircle size={14} weight="fill" className="text-accent" />
                Minted {mintedDate}
              </CardDescription>
            </div>
          </div>
          {onDelete && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(nft.id)}
            >
              <Trash size={16} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Network</span>
          <Badge variant="outline">{nft.network}</Badge>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Royalty</span>
          <Badge variant="secondary" className="gap-1">
            <CurrencyDollar size={12} weight="bold" />
            {formatRoyaltyBadge(nft.sellerFeeBasisPoints)}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Mint Address</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 font-mono text-xs"
              onClick={() => window.open(getAddressExplorerUrl(nft.mintAddress, nft.network), '_blank')}
            >
              {nft.mintAddress.substring(0, 8)}...
              <ArrowSquareOut size={12} />
            </Button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Transaction</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 font-mono text-xs"
              onClick={() => window.open(getExplorerUrl(nft.transactionSignature, nft.network), '_blank')}
            >
              {nft.transactionSignature.substring(0, 8)}...
              <ArrowSquareOut size={12} />
            </Button>
          </div>
        </div>

        <div className="pt-2 flex gap-2">
          {onViewHistory && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => onViewHistory(nft)}
            >
              <ArrowsLeftRight size={14} />
              View History
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => window.open(`https://magiceden.io/item-details/${nft.mintAddress}`, '_blank')}
          >
            Magic Eden
            <ArrowSquareOut size={14} />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
