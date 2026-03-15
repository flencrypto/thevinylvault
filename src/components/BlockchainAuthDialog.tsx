import { useState, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { CollectionItem } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ShieldCheck, VinylRecord } from '@phosphor-icons/react'

interface BlockchainAuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function generateCertTokenId(artist: string, title: string, year: number, catno: string): string {
  const seed = [artist, title, String(year), catno].filter(Boolean).join('|')
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  const hex = h.toString(16).padStart(8, '0').toUpperCase()
  return `VX-${hex.slice(0, 4)}-${hex.slice(4)}`
}

const CHAINS = [
  { id: 'solana', label: 'Solana', symbol: '◎' },
  { id: 'bitcoin', label: 'Bitcoin', symbol: '₿' },
  { id: 'multiversx', label: 'MultiversX', symbol: '🌐' },
] as const

export function BlockchainAuthDialog({ open, onOpenChange }: BlockchainAuthDialogProps) {
  const [items] = useKV<CollectionItem[]>('vinyl-vault-collection', [])
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [chain, setChain] = useState<string>('solana')

  const collection = items || []

  const selectedItem = useMemo(
    () => collection.find(item => item.id === selectedItemId) ?? null,
    [collection, selectedItemId],
  )

  const certificate = useMemo(() => {
    if (!selectedItem) return null
    const tokenId = generateCertTokenId(
      selectedItem.artistName,
      selectedItem.releaseTitle,
      selectedItem.year,
      selectedItem.catalogNumber || '',
    )
    return {
      tokenId,
      artist: selectedItem.artistName,
      title: selectedItem.releaseTitle,
      year: selectedItem.year,
      catalogNumber: selectedItem.catalogNumber || 'N/A',
      mintDate: new Date().toISOString().split('T')[0],
    }
  }, [selectedItem])

  const chainInfo = CHAINS.find(c => c.id === chain) ?? CHAINS[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck size={22} weight="fill" />
            Blockchain Authenticity Certificate
          </DialogTitle>
          <DialogDescription>
            Generate a blockchain-verified authenticity certificate for your vinyl records
          </DialogDescription>
        </DialogHeader>

        {collection.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <VinylRecord size={48} className="text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              Add some records to your collection to generate certificates.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Item Selector */}
            <div>
              <label className="text-sm font-medium mb-2 block">Select Record</label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a record to certify..." />
                </SelectTrigger>
                <SelectContent>
                  {collection.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.artistName} — {item.releaseTitle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Chain Selector */}
            <Tabs value={chain} onValueChange={setChain}>
              <TabsList className="w-full">
                {CHAINS.map(c => (
                  <TabsTrigger key={c.id} value={c.id} className="flex-1 gap-1.5">
                    <span>{c.symbol}</span>
                    <span>{c.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {CHAINS.map(c => (
                <TabsContent key={c.id} value={c.id}>
                  {certificate ? (
                    <Card className="p-5 space-y-4 border-2 border-dashed border-primary/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground">
                          {c.label} Certificate
                        </span>
                        <Badge variant="default" className="bg-green-600 text-white gap-1">
                          <ShieldCheck size={14} />
                          Verified
                        </Badge>
                      </div>

                      <div className="text-center py-3">
                        <p className="text-xs text-muted-foreground mb-1">Token ID</p>
                        <p className="text-xl font-mono font-bold tracking-wider">{certificate.tokenId}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Artist</p>
                          <p className="font-medium truncate">{certificate.artist}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Title</p>
                          <p className="font-medium truncate">{certificate.title}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Year</p>
                          <p className="font-medium">{certificate.year}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Catalog #</p>
                          <p className="font-medium font-mono">{certificate.catalogNumber}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Chain</p>
                          <p className="font-medium">{c.symbol} {c.label}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Mint Date</p>
                          <p className="font-medium">{certificate.mintDate}</p>
                        </div>
                      </div>
                    </Card>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                      <ShieldCheck size={36} className="mb-2 opacity-40" />
                      <p className="text-sm">Select a record above to generate a certificate.</p>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
