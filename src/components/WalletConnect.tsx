import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Wallet, CheckCircle, Warning, Copy, ArrowSquareOut, SignOut } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useWallet } from '@/hooks/use-wallet'
import type { WalletConnection } from '@/hooks/use-wallet'

interface WalletConnectProps {
  className?: string
}

export function WalletConnect({ className }: WalletConnectProps) {
  const { wallet, isConnected, connect, disconnect } = useWallet()
  const [showWalletDialog, setShowWalletDialog] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  const detectWallets = useCallback(() => {
    const wallets: Array<{ type: WalletConnection['walletType']; name: string; available: boolean }> = []

    if (window.solana?.isPhantom) {
      wallets.push({ type: 'phantom', name: 'Phantom', available: true })
    }
    if (window.solflare?.isSolflare) {
      wallets.push({ type: 'solflare', name: 'Solflare', available: true })
    }
    if (window.backpack?.isBackpack) {
      wallets.push({ type: 'backpack', name: 'Backpack', available: true })
    }

    return wallets
  }, [])

  const connectWallet = useCallback(async (walletType: WalletConnection['walletType']) => {
    setIsConnecting(true)
    
    try {
      let walletProvider: any
      let walletName = 'Wallet'

      switch (walletType) {
        case 'phantom':
          if (!window.solana) {
            toast.error('Phantom wallet not detected', {
              description: 'Please install Phantom from phantom.app',
            })
            setIsConnecting(false)
            return
          }
          walletProvider = window.solana
          walletName = 'Phantom'
          break

        case 'solflare':
          if (!window.solflare) {
            toast.error('Solflare wallet not detected', {
              description: 'Please install Solflare from solflare.com',
            })
            setIsConnecting(false)
            return
          }
          walletProvider = window.solflare
          walletName = 'Solflare'
          break

        case 'backpack':
          if (!window.backpack) {
            toast.error('Backpack wallet not detected', {
              description: 'Please install Backpack from backpack.app',
            })
            setIsConnecting(false)
            return
          }
          walletProvider = window.backpack
          walletName = 'Backpack'
          break

        default:
          toast.error('Unsupported wallet type')
          setIsConnecting(false)
          return
      }

      const response = await walletProvider.connect()
      const publicKey = response.publicKey.toString()

      const newConnection: WalletConnection = {
        publicKey,
        walletType,
        connected: true,
      }

      connect(newConnection)
      setShowWalletDialog(false)
      
      toast.success(`${walletName} connected`, {
        description: `Address: ${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`,
      })
    } catch (error) {
      console.error('Wallet connection error:', error)
      toast.error('Failed to connect wallet', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsConnecting(false)
    }
  }, [connect])

  const disconnectWallet = useCallback(async () => {
    if (!wallet) return

    try {
      let walletProvider: any

      switch (wallet.walletType) {
        case 'phantom':
          walletProvider = window.solana
          break
        case 'solflare':
          walletProvider = window.solflare
          break
        case 'backpack':
          walletProvider = window.backpack
          break
      }

      if (walletProvider?.disconnect) {
        await walletProvider.disconnect()
      }

      disconnect()
      toast.success('Wallet disconnected')
    } catch (error) {
      console.error('Disconnect error:', error)
      toast.error('Failed to disconnect wallet')
    }
  }, [wallet, disconnect])

  const copyAddress = useCallback(() => {
    if (wallet?.publicKey) {
      navigator.clipboard.writeText(wallet.publicKey)
      toast.success('Address copied to clipboard')
    }
  }, [wallet])

  const viewOnExplorer = useCallback(() => {
    if (wallet?.publicKey) {
      window.open(`https://explorer.solana.com/address/${wallet.publicKey}?cluster=devnet`, '_blank')
    }
  }, [wallet])

  const shortenAddress = useCallback((address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }, [])

  useEffect(() => {
    if (!wallet) return

    let walletProvider: any
    switch (wallet.walletType) {
      case 'phantom':
        walletProvider = window.solana
        break
      case 'solflare':
        walletProvider = window.solflare
        break
      case 'backpack':
        walletProvider = window.backpack
        break
    }

    if (!walletProvider) return

    const handleDisconnect = () => {
      disconnect()
      toast.info('Wallet disconnected')
    }

    const handleAccountChanged = () => {
      if (walletProvider.publicKey) {
        const updatedConnection: WalletConnection = {
          ...wallet,
          publicKey: walletProvider.publicKey.toString(),
        }
        connect(updatedConnection)
      } else {
        disconnect()
      }
    }

    walletProvider.on('disconnect', handleDisconnect)
    walletProvider.on('accountChanged', handleAccountChanged)

    return () => {
      walletProvider.off('disconnect', handleDisconnect)
      walletProvider.off('accountChanged', handleAccountChanged)
    }
  }, [wallet, connect, disconnect])

  if (isConnected && wallet) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-2 px-3 py-1.5 bg-accent/10 border-accent/30">
            <CheckCircle size={16} weight="fill" className="text-accent" />
            <span className="font-mono text-sm">{shortenAddress(wallet.publicKey)}</span>
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={copyAddress}
            title="Copy address"
            className="h-8 w-8"
          >
            <Copy size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={viewOnExplorer}
            title="View on explorer"
            className="h-8 w-8"
          >
            <ArrowSquareOut size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={disconnectWallet}
            title="Disconnect wallet"
            className="h-8 w-8 text-destructive hover:text-destructive"
          >
            <SignOut size={16} />
          </Button>
        </div>
      </div>
    )
  }

  const availableWallets = detectWallets()

  return (
    <>
      <Button onClick={() => setShowWalletDialog(true)} className={`gap-2 ${className}`}>
        <Wallet size={20} />
        Connect Wallet
      </Button>

      <Dialog open={showWalletDialog} onOpenChange={setShowWalletDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet size={24} />
              Connect Solana Wallet
            </DialogTitle>
            <DialogDescription>
              Choose a wallet to connect to VinylVault for NFT minting
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {availableWallets.length > 0 ? (
              <div className="space-y-2">
                {availableWallets.map((wallet) => (
                  <Button
                    key={wallet.type}
                    onClick={() => connectWallet(wallet.type)}
                    disabled={isConnecting}
                    className="w-full justify-start gap-3 h-auto py-4"
                    variant="outline"
                  >
                    <Wallet size={24} weight="fill" />
                    <div className="text-left">
                      <div className="font-semibold">{wallet.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {isConnecting ? 'Connecting...' : 'Click to connect'}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            ) : (
              <Alert>
                <Warning size={20} />
                <AlertDescription className="ml-2">
                  No Solana wallet detected. Please install one of the following:
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>
                      <a
                        href="https://phantom.app/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Phantom Wallet
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://solflare.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Solflare Wallet
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://backpack.app/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Backpack Wallet
                      </a>
                    </li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
