import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Wallet,
  Coins,
  Lightning,
  ArrowSquareOut,
  CheckCircle,
  SpinnerGap,
  Globe,
  Warning
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { CollectionItem } from '@/lib/types'
import { multiversxService } from '@/lib/multiversx-service'

type MultiversXNetwork = 'mainnet' | 'devnet' | 'testnet'

interface MultiversXNFT {
  id: string
  itemId: string
  tokenId: string
  artistName: string
  releaseTitle: string
  txHash: string
  network: MultiversXNetwork
  mintedAt: string
}

interface MultiversXWalletState {
  connected: boolean
  address: string
  network: MultiversXNetwork
  provider: 'xportal' | 'defi' | null
}

export default function MultiversXNFTSection() {
  const [collectionItems] = useKV<CollectionItem[]>('vinyl-vault-collection', [])
  const [nfts, setNfts] = useKV<MultiversXNFT[]>('vinyl-vault-multiversx-nfts', [])
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [isMinting, setIsMinting] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [contractAddress, setContractAddress] = useState('')
  const [walletState, setWalletState] = useState<MultiversXWalletState>({
    connected: false,
    address: '',
    network: 'devnet',
    provider: null
  })
  const walletAvailable = multiversxService.isWalletAvailable()

  const safeCollectionItems = collectionItems || []
  const safeNfts = nfts || []
  const selectedItem = safeCollectionItems.find(i => i.id === selectedItemId)

  useEffect(() => {
    let active = true
    const unsubscribe = multiversxService.onAccountChange((account) => {
      if (!active) return
      if (account) {
        setWalletState(prev => ({ ...prev, connected: true, address: account }))
      } else {
        setWalletState(prev => ({ ...prev, connected: false, address: '', provider: null }))
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const handleConnect = async (provider: 'xportal' | 'defi') => {
    setIsConnecting(true)
    try {
      const address = await multiversxService.connectWallet()
      const actualProvider = multiversxService.getProviderType() || provider
      setWalletState({
        connected: true,
        address,
        network: walletState.network,
        provider: actualProvider
      })
      toast.success(`${actualProvider === 'xportal' ? 'xPortal' : 'DeFi Wallet'} connected`)
    } catch (error) {
      toast.error('Failed to connect wallet', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = () => {
    multiversxService.disconnectWallet()
    setWalletState({ connected: false, address: '', network: walletState.network, provider: null })
    toast.info('Wallet disconnected')
  }

  const handleNetworkChange = (network: MultiversXNetwork) => {
    multiversxService.setNetwork(network)
    setWalletState(prev => ({ ...prev, network }))
    toast.info(`Switched to ${network}`)
  }

  const handleContractAddressChange = (address: string) => {
    setContractAddress(address)
    // MultiversX bech32 addresses start with erd1 and are 62 characters long
    if (address.startsWith('erd1') && address.length === 62) {
      multiversxService.setContractAddress(address)
    }
  }

  const handleMint = async () => {
    if (!selectedItem || !walletState.connected) return
    setIsMinting(true)
    try {
      const tokenId = `VINYL-${Date.now().toString(36).toUpperCase()}-01`
      const result = await multiversxService.mintRecordNFT(tokenId, {
        artist: selectedItem.artistName,
        title: selectedItem.releaseTitle,
        year: String(selectedItem.year || ''),
        catno: selectedItem.catalogNumber || '',
        condition: selectedItem.condition.mediaGrade || '',
      })
      const newNFT: MultiversXNFT = {
        id: typeof crypto?.randomUUID === 'function'
          ? crypto.randomUUID()
          : `mvx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        itemId: selectedItem.id,
        tokenId: result.tokenId,
        artistName: selectedItem.artistName,
        releaseTitle: selectedItem.releaseTitle,
        txHash: result.txHash,
        network: walletState.network,
        mintedAt: new Date().toISOString()
      }
      setNfts(current => [...(current || []), newNFT])
      setSelectedItemId('')
      toast.success('NFT minted on MultiversX!', {
        description: `${selectedItem.artistName} - ${selectedItem.releaseTitle}`
      })
    } catch (error) {
      const err = error as Error & { code?: string }
      if (err.code === 'CONTRACT_NOT_CONFIGURED') {
        toast.error('Contract not configured', {
          description: 'Enter a valid MultiversX contract address above before minting.'
        })
      } else {
        toast.error('Minting failed', {
          description: err.message || 'Unknown error'
        })
      }
    } finally {
      setIsMinting(false)
    }
  }

  const getExplorerUrl = (txHash: string, network: MultiversXNetwork) => {
    const base = network === 'mainnet'
      ? 'https://explorer.multiversx.com'
      : `https://${network}-explorer.multiversx.com`
    return `${base}/transactions/${txHash}`
  }

  const networkColor: Record<MultiversXNetwork, string> = {
    mainnet: 'bg-green-500/20 border-green-500/40 text-green-300',
    devnet: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
    testnet: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
  }

  return (
    <div className="space-y-6">
      {/* Wallet Connection Card */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Globe size={20} className="text-blue-400" />
            MultiversX Wallet
          </CardTitle>
          <CardDescription className="text-slate-400">
            Connect your MultiversX wallet to mint ESDT NFTs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Network Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Network:</span>
            <Select value={walletState.network} onValueChange={(v) => handleNetworkChange(v as MultiversXNetwork)}>
              <SelectTrigger className="w-32 h-8 bg-slate-800/50 border-slate-700 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mainnet">Mainnet</SelectItem>
                <SelectItem value="devnet">Devnet</SelectItem>
                <SelectItem value="testnet">Testnet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!walletAvailable && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <Warning size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-yellow-300">
                No MultiversX wallet extension detected. Install the{' '}
                <a href="https://chromewebstore.google.com/detail/multiversx-defi-wallet" target="_blank" rel="noopener noreferrer" className="underline">xPortal / DeFi Wallet</a>{' '}
                extension to connect.
              </p>
            </div>
          )}

          {walletState.connected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle size={18} className="text-green-400" weight="fill" />
                  <span className="text-sm text-slate-300 font-mono">
                    {walletState.address.slice(0, 8)}...{walletState.address.slice(-6)}
                  </span>
                </div>
                <Badge variant="outline" className={`text-xs ${networkColor[walletState.network]}`}>
                  {walletState.network}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Wallet size={14} />
                Connected via {walletState.provider === 'xportal' ? 'xPortal' : 'DeFi Wallet'}
              </div>
              <Button variant="outline" size="sm" onClick={handleDisconnect} className="w-full">
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                onClick={() => handleConnect('xportal')}
                disabled={isConnecting}
                variant="outline"
                className="w-full gap-2 bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 text-blue-300"
              >
                {isConnecting ? <SpinnerGap size={18} className="animate-spin" /> : <Globe size={18} />}
                Connect xPortal
              </Button>
              <Button
                onClick={() => handleConnect('defi')}
                disabled={isConnecting}
                variant="outline"
                className="w-full gap-2 bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300"
              >
                {isConnecting ? <SpinnerGap size={18} className="animate-spin" /> : <Wallet size={18} />}
                Connect DeFi Wallet
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mint NFT Card */}
      {walletState.connected && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Lightning size={20} className="text-blue-400" />
              Mint ESDT NFT
            </CardTitle>
            <CardDescription className="text-slate-400">
              Select a collection item to mint as a MultiversX ESDT NFT
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Contract Address</label>
              <Input
                value={contractAddress}
                onChange={(e) => handleContractAddressChange(e.target.value)}
                placeholder="erd1qqqqqqqqqqqqq..."
                className="bg-slate-800/50 border-slate-700 text-white font-mono text-xs"
              />
            </div>

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
              </div>
            )}

            <Button
              onClick={handleMint}
              disabled={!selectedItem || isMinting}
              className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isMinting ? (
                <>
                  <SpinnerGap size={18} className="animate-spin" />
                  Minting...
                </>
              ) : (
                <>
                  <Coins size={18} />
                  Mint on MultiversX
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* MultiversX NFT Gallery */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Coins size={20} className="text-blue-400" />
            MultiversX NFT Gallery
          </CardTitle>
          <CardDescription className="text-slate-400">
            {safeNfts.length} NFT{safeNfts.length !== 1 ? 's' : ''} minted
          </CardDescription>
        </CardHeader>
        <CardContent>
          {safeNfts.length === 0 ? (
            <div className="py-12 text-center">
              <Globe size={48} className="mx-auto text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No MultiversX NFTs Yet</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Connect your MultiversX wallet and mint your first vinyl record as an ESDT NFT.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {safeNfts.map(nft => (
                <div
                  key={nft.id}
                  className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-blue-500/40 transition-colors space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-mono">{nft.tokenId}</span>
                    <Badge variant="outline" className={`text-xs ${networkColor[nft.network]}`}>
                      {nft.network}
                    </Badge>
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm truncate">
                      {nft.artistName} - {nft.releaseTitle}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{new Date(nft.mintedAt).toLocaleDateString()}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => window.open(getExplorerUrl(nft.txHash, nft.network), '_blank')}
                      title="View on MultiversX Explorer"
                    >
                      <ArrowSquareOut size={14} />
                    </Button>
                  </div>
                  <div className="text-xs text-slate-500 font-mono truncate">
                    tx: {nft.txHash.slice(0, 12)}...{nft.txHash.slice(-8)}
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
