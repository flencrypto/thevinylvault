import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Wallet,
  Coins,
  Lightning,
  ArrowSquareOut,
  CurrencyBtc,
  CheckCircle,
  SpinnerGap,
  Info
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { CollectionItem } from '@/lib/types'

interface BitcoinOrdinal {
  id: string
  itemId: string
  tokenId: string
  artistName: string
  releaseTitle: string
  inscriptionType: string
  txHash: string
  network: 'mainnet' | 'testnet'
  mintedAt: string
}

interface BitcoinWalletState {
  connected: boolean
  address: string
  network: 'mainnet' | 'testnet'
  provider: 'unisat' | 'xverse' | null
}

export default function BitcoinNFTSection() {
  const [collectionItems] = useKV<CollectionItem[]>('vinyl-vault-collection', [])
  const [ordinals, setOrdinals] = useKV<BitcoinOrdinal[]>('vinyl-vault-bitcoin-ordinals', [])
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [isMinting, setIsMinting] = useState(false)
  const [walletState, setWalletState] = useState<BitcoinWalletState>({
    connected: false,
    address: '',
    network: 'testnet',
    provider: null
  })
  const [feeRate] = useState(12)

  const safeCollectionItems = collectionItems || []
  const safeOrdinals = ordinals || []
  const selectedItem = safeCollectionItems.find(i => i.id === selectedItemId)

  const handleConnect = async (provider: 'unisat' | 'xverse') => {
    try {
      const mockAddress = 'bc1q' + Array.from({ length: 38 }, () =>
        'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
      ).join('')

      setWalletState({
        connected: true,
        address: mockAddress,
        network: 'testnet',
        provider
      })
      toast.success(`${provider === 'unisat' ? 'Unisat' : 'Xverse'} wallet connected`)
    } catch (error) {
      toast.error('Failed to connect wallet', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  const handleDisconnect = () => {
    setWalletState({ connected: false, address: '', network: 'testnet', provider: null })
    toast.info('Wallet disconnected')
  }

  const handleInscribe = async () => {
    if (!selectedItem || !walletState.connected) return
    setIsMinting(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      const newOrdinal: BitcoinOrdinal = {
        id: crypto.randomUUID(),
        itemId: selectedItem.id,
        tokenId: `ord-${Date.now().toString(36)}`,
        artistName: selectedItem.artistName,
        releaseTitle: selectedItem.releaseTitle,
        inscriptionType: 'vinyl-certificate',
        txHash: Array.from({ length: 64 }, () =>
          '0123456789abcdef'[Math.floor(Math.random() * 16)]
        ).join(''),
        network: walletState.network,
        mintedAt: new Date().toISOString()
      }
      setOrdinals(current => [...(current || []), newOrdinal])
      setSelectedItemId('')
      toast.success('Ordinal inscribed!', {
        description: `${selectedItem.artistName} - ${selectedItem.releaseTitle} inscribed on Bitcoin`
      })
    } catch (error) {
      toast.error('Inscription failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsMinting(false)
    }
  }

  const getExplorerUrl = (txHash: string, network: string) =>
    network === 'mainnet'
      ? `https://mempool.space/tx/${txHash}`
      : `https://mempool.space/testnet/tx/${txHash}`

  return (
    <div className="space-y-6">
      {/* Wallet Connection Card */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <CurrencyBtc size={20} className="text-orange-400" />
            Bitcoin Wallet
          </CardTitle>
          <CardDescription className="text-slate-400">
            Connect your Bitcoin wallet to inscribe Ordinals
          </CardDescription>
        </CardHeader>
        <CardContent>
          {walletState.connected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle size={18} className="text-green-400" weight="fill" />
                  <span className="text-sm text-slate-300 font-mono">
                    {walletState.address.slice(0, 8)}...{walletState.address.slice(-6)}
                  </span>
                </div>
                <Badge variant="outline" className={`text-xs ${
                  walletState.network === 'mainnet'
                    ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                    : 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                }`}>
                  {walletState.network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Wallet size={14} />
                Connected via {walletState.provider === 'unisat' ? 'Unisat' : 'Xverse'}
              </div>
              <Button variant="outline" size="sm" onClick={handleDisconnect} className="w-full">
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                onClick={() => handleConnect('unisat')}
                variant="outline"
                className="w-full gap-2 bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20 text-orange-300"
              >
                <CurrencyBtc size={18} />
                Connect Unisat
              </Button>
              <Button
                onClick={() => handleConnect('xverse')}
                variant="outline"
                className="w-full gap-2 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 text-amber-300"
              >
                <Wallet size={18} />
                Connect Xverse
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mint Ordinal Card */}
      {walletState.connected && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Lightning size={20} className="text-orange-400" />
              Inscribe Ordinal
            </CardTitle>
            <CardDescription className="text-slate-400">
              Select a collection item to inscribe as a Bitcoin Ordinal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                <SelectValue placeholder="Select a collection item" />
              </SelectTrigger>
              <SelectContent>
                {safeCollectionItems.map(item => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.artistName} - {item.releaseTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedItem && (
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2">
                <div className="text-sm font-semibold text-white">
                  {selectedItem.artistName} - {selectedItem.releaseTitle}
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-slate-400">
                  <span>Year: {selectedItem.year}</span>
                  <span>Format: {selectedItem.format}</span>
                  {selectedItem.catalogNumber && (
                    <span>Catalog: {selectedItem.catalogNumber}</span>
                  )}
                  <span>Media: {selectedItem.condition.mediaGrade}</span>
                </div>
                <div className="flex items-center gap-2 pt-2 text-xs text-slate-500">
                  <Info size={14} />
                  <span>Est. fee: ~{feeRate} sats/vByte</span>
                </div>
              </div>
            )}

            <Button
              onClick={handleInscribe}
              disabled={!selectedItem || isMinting}
              className="w-full gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isMinting ? (
                <>
                  <SpinnerGap size={18} className="animate-spin" />
                  Inscribing...
                </>
              ) : (
                <>
                  <CurrencyBtc size={18} />
                  Inscribe on Bitcoin
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Ordinals Gallery */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Coins size={20} className="text-orange-400" />
            Ordinals Gallery
          </CardTitle>
          <CardDescription className="text-slate-400">
            {safeOrdinals.length} ordinal{safeOrdinals.length !== 1 ? 's' : ''} inscribed
          </CardDescription>
        </CardHeader>
        <CardContent>
          {safeOrdinals.length === 0 ? (
            <div className="py-12 text-center">
              <CurrencyBtc size={48} className="mx-auto text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Ordinals Yet</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Connect your Bitcoin wallet and inscribe your first vinyl record as a Bitcoin Ordinal.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {safeOrdinals.map(ordinal => (
                <div
                  key={ordinal.id}
                  className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-orange-500/40 transition-colors space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs bg-orange-500/20 border-orange-500/40 text-orange-300">
                      {ordinal.inscriptionType}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${
                      ordinal.network === 'mainnet'
                        ? 'bg-orange-500/10 border-orange-500/30 text-orange-300'
                        : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
                    }`}>
                      {ordinal.network}
                    </Badge>
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm truncate">
                      {ordinal.artistName} - {ordinal.releaseTitle}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-1">
                      {ordinal.tokenId}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{new Date(ordinal.mintedAt).toLocaleDateString()}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => window.open(getExplorerUrl(ordinal.txHash, ordinal.network), '_blank')}
                      title="View on Mempool Explorer"
                    >
                      <ArrowSquareOut size={14} />
                    </Button>
                  </div>
                  <div className="text-xs text-slate-500 font-mono truncate">
                    tx: {ordinal.txHash.slice(0, 12)}...{ordinal.txHash.slice(-8)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
