import { useState, useEffect, useCallback } from 'react'

export interface WalletConnection {
  publicKey: string
  walletType: 'phantom' | 'solflare' | 'backpack' | 'unknown'
  connected: boolean
}

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean
      connect: () => Promise<{ publicKey: { toString: () => string } }>
      disconnect: () => Promise<void>
      on: (event: string, callback: () => void) => void
      off: (event: string, callback: () => void) => void
      publicKey?: { toString: () => string } | null
      isConnected?: boolean
    }
    solflare?: {
      isSolflare?: boolean
      connect: () => Promise<{ publicKey: { toString: () => string } }>
      disconnect: () => Promise<void>
      on: (event: string, callback: () => void) => void
      off: (event: string, callback: () => void) => void
      publicKey?: { toString: () => string } | null
      isConnected?: boolean
    }
    backpack?: {
      isBackpack?: boolean
      connect: () => Promise<{ publicKey: { toString: () => string } }>
      disconnect: () => Promise<void>
      on: (event: string, callback: () => void) => void
      off: (event: string, callback: () => void) => void
      publicKey?: { toString: () => string } | null
      isConnected?: boolean
    }
  }
}

let globalWallet: WalletConnection | null = null

export function useWallet() {
  const [wallet, setWallet] = useState<WalletConnection | null>(globalWallet)

  const connect = useCallback((connection: WalletConnection) => {
    globalWallet = connection
    setWallet(connection)
    localStorage.setItem('vinylvault_wallet', JSON.stringify(connection))
  }, [])

  const disconnect = useCallback(() => {
    globalWallet = null
    setWallet(null)
    localStorage.removeItem('vinylvault_wallet')
  }, [])

  useEffect(() => {
    if (globalWallet) {
      setWallet(globalWallet)
      return
    }

    const savedConnection = localStorage.getItem('vinylvault_wallet')
    if (savedConnection) {
      try {
        const parsed = JSON.parse(savedConnection) as WalletConnection
        
        let walletProvider: any
        switch (parsed.walletType) {
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

        if (walletProvider?.publicKey && walletProvider?.isConnected) {
          const reconnected = {
            ...parsed,
            publicKey: walletProvider.publicKey.toString(),
            connected: true,
          }
          globalWallet = reconnected
          setWallet(reconnected)
        } else {
          localStorage.removeItem('vinylvault_wallet')
        }
      } catch (error) {
        console.error('Failed to restore wallet:', error)
        localStorage.removeItem('vinylvault_wallet')
      }
    }
  }, [])

  return {
    wallet,
    isConnected: !!wallet?.connected,
    connect,
    disconnect,
  }
}
