import { useState } from 'react'
import { WatchlistItem, WatchlistType } from '@/lib/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

export interface AddWatchlistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (item: WatchlistItem) => void
}

export function AddWatchlistDialog({ open, onOpenChange, onAdd }: AddWatchlistDialogProps) {
  const [type, setType] = useState<WatchlistType>('artist')
  const [artistName, setArtistName] = useState('')
  const [releaseTitle, setReleaseTitle] = useState('')
  const [pressingDetails, setPressingDetails] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [targetCurrency, setTargetCurrency] = useState('GBP')
  const [notifyOnMatch, setNotifyOnMatch] = useState(true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const newItem: WatchlistItem = {
      // eslint-disable-next-line react-hooks/purity
      id: `watchlist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      collectionId: 'default',
      type,
      artistName: artistName || undefined,
      releaseTitle: releaseTitle || undefined,
      pressingDetails: pressingDetails || undefined,
      searchQuery: searchQuery || undefined,
      targetPrice: targetPrice ? parseFloat(targetPrice) : undefined,
      targetCurrency,
      notifyOnMatch,
      createdAt: new Date().toISOString(),
    }

    onAdd(newItem)
    handleReset()
  }

  const handleReset = () => {
    setType('artist')
    setArtistName('')
    setReleaseTitle('')
    setPressingDetails('')
    setSearchQuery('')
    setTargetPrice('')
    setTargetCurrency('GBP')
    setNotifyOnMatch(true)
  }

  const isValid = () => {
    switch (type) {
      case 'artist':
        return artistName.trim().length > 0
      case 'release':
        return releaseTitle.trim().length > 0
      case 'pressing':
        return artistName.trim().length > 0 && releaseTitle.trim().length > 0
      case 'freetext':
        return searchQuery.trim().length > 0
      default:
        return false
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Watchlist Item</DialogTitle>
          <DialogDescription>
            Track artists, releases, or search terms to find marketplace opportunities
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Watch Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as WatchlistType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="artist">Artist</SelectItem>
                <SelectItem value="release">Release</SelectItem>
                <SelectItem value="pressing">Specific Pressing</SelectItem>
                <SelectItem value="freetext">Free Text Search</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(type === 'artist' || type === 'release' || type === 'pressing') && (
            <div className="space-y-2">
              <Label>Artist Name</Label>
              <Input
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="e.g., The Beatles"
                required={type === 'artist' || type === 'pressing'}
              />
            </div>
          )}

          {(type === 'release' || type === 'pressing') && (
            <div className="space-y-2">
              <Label>Release Title</Label>
              <Input
                value={releaseTitle}
                onChange={(e) => setReleaseTitle(e.target.value)}
                placeholder="e.g., Abbey Road"
                required
              />
            </div>
          )}

          {type === 'pressing' && (
            <div className="space-y-2">
              <Label>Pressing Details (Optional)</Label>
              <Input
                value={pressingDetails}
                onChange={(e) => setPressingDetails(e.target.value)}
                placeholder="e.g., UK 1st Press, Parlophone"
              />
            </div>
          )}

          {type === 'freetext' && (
            <div className="space-y-2">
              <Label>Search Query</Label>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g., vinyl LP jazz rare"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Target Price (Optional)</Label>
              <Input
                type="number"
                step="0.01"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={targetCurrency} onValueChange={setTargetCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <Label htmlFor="notify-switch" className="text-sm font-medium">
                Alert on Match
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Notify when bargains are found
              </p>
            </div>
            <Switch
              id="notify-switch"
              checked={notifyOnMatch}
              onCheckedChange={setNotifyOnMatch}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid()} className="flex-1">
              Add to Watchlist
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
