import { useState, useEffect } from 'react'
import { MintedNFT, NFTTransaction } from '@/lib/types'
import { fetchNFTTransactions, getTransactionTypeLabel, getTransactionTypeColor, formatSOL, calculateTotalVolume, calculateRoyaltiesEarned } from '@/lib/nft-transaction-service'
import { getExplorerUrl, getAddressExplorerUrl } from '@/lib/solana-nft'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  ArrowSquareOut, 
  ArrowsLeftRight, 
  Coins, 
  CurrencyDollar,
  Storefront,
  CheckCircle,
  Clock,
  XCircle
} from '@phosphor-icons/react'

interface NFTTransactionHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nft: MintedNFT | null
  itemTitle?: string
}

export function NFTTransactionHistoryDialog({ 
  open, 
  onOpenChange, 
  nft,
  itemTitle 
}: NFTTransactionHistoryDialogProps) {
  const [transactions, setTransactions] = useState<NFTTransaction[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && nft) {
      
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true)
      fetchNFTTransactions(nft)
        .then(setTransactions)
        .finally(() => setLoading(false))
    }
  }, [open, nft])

  if (!nft) return null

  const totalVolume = calculateTotalVolume(transactions)
  const royaltiesEarned = calculateRoyaltiesEarned(transactions, nft.sellerFeeBasisPoints)
  const salesCount = transactions.filter(tx => tx.type === 'sale').length

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle size={16} weight="fill" className="text-green-400" />
      case 'pending':
        return <Clock size={16} className="text-yellow-400" />
      case 'failed':
        return <XCircle size={16} weight="fill" className="text-red-400" />
      default:
        return null
    }
  }

  const formatAddress = (address: string) => {
    if (address.length < 12) return address
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowsLeftRight size={24} className="text-accent" weight="bold" />
            Transaction History
          </DialogTitle>
          <DialogDescription>
            {itemTitle || 'NFT'} on-chain activity and trading history
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading transaction history...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 pb-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <ArrowsLeftRight size={16} />
                  Total Transactions
                </div>
                <div className="text-2xl font-bold">{transactions.length}</div>
              </div>
              
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <CurrencyDollar size={16} weight="bold" />
                  Total Volume
                </div>
                <div className="text-2xl font-bold">
                  {totalVolume > 0 ? formatSOL(totalVolume) : '—'}
                </div>
                {salesCount > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {salesCount} sale{salesCount !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Coins size={16} weight="fill" />
                  Royalties Earned
                </div>
                <div className="text-2xl font-bold text-accent">
                  {royaltiesEarned > 0 ? formatSOL(royaltiesEarned) : '—'}
                </div>
                {royaltiesEarned > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {nft.sellerFeeBasisPoints / 100}% on sales
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div 
                    key={tx.id} 
                    className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`font-semibold ${getTransactionTypeColor(tx.type)}`}>
                          {getTransactionTypeLabel(tx.type)}
                        </div>
                        {getStatusIcon(tx.status)}
                        {tx.marketplace && (
                          <Badge variant="outline" className="gap-1">
                            <Storefront size={12} />
                            {tx.marketplace}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(tx.blockTime)}
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      {tx.fromAddress && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">From</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 font-mono text-xs"
                            onClick={() => window.open(getAddressExplorerUrl(tx.fromAddress!, nft.network), '_blank')}
                          >
                            {formatAddress(tx.fromAddress)}
                            <ArrowSquareOut size={12} />
                          </Button>
                        </div>
                      )}
                      
                      {tx.toAddress && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">To</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 font-mono text-xs"
                            onClick={() => window.open(getAddressExplorerUrl(tx.toAddress!, nft.network), '_blank')}
                          >
                            {formatAddress(tx.toAddress)}
                            <ArrowSquareOut size={12} />
                          </Button>
                        </div>
                      )}

                      {tx.salePrice && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Price</span>
                          <span className="font-semibold text-green-400">
                            {formatSOL(tx.salePrice)}
                          </span>
                        </div>
                      )}

                      {tx.fee && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Transaction Fee</span>
                          <span className="text-xs font-mono">
                            {formatSOL(tx.fee)}
                          </span>
                        </div>
                      )}

                      {tx.metadata?.royaltyPaid && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Royalty Paid</span>
                          <span className="text-xs font-mono text-accent">
                            {formatSOL(tx.metadata.royaltyPaid)}
                          </span>
                        </div>
                      )}

                      {tx.metadata?.marketplaceFee && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Marketplace Fee</span>
                          <span className="text-xs font-mono">
                            {formatSOL(tx.metadata.marketplaceFee)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <span className="text-muted-foreground">Signature</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 font-mono text-xs"
                          onClick={() => window.open(getExplorerUrl(tx.transactionSignature, nft.network), '_blank')}
                        >
                          {formatAddress(tx.transactionSignature)}
                          <ArrowSquareOut size={12} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {transactions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <ArrowsLeftRight size={48} className="mx-auto mb-3 opacity-50" weight="thin" />
                    <p>No transaction history available</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
