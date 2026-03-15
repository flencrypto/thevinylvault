import { useEffect, useCallback, useSyncExternalStore } from 'react'

export interface WalletConnection {
  publicKey: string
  walletType: 'phantom' | 'solflare' | 'backpack' | 'unknown'
  connected: boolean
}

let globalWallet: WalletConnection | null = null
const listeners = new Set<() => void>()

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function getSnapshot(): WalletConnection | null {
  return globalWallet
}

export function useWallet() {
  const wallet = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const connect = useCallback((connection: WalletConnection) => {
    globalWallet = connection
    localStorage.setItem('vinylvault_wallet', JSON.stringify(connection))
    emitChange()
  }, [])

  const disconnect = useCallback(() => {
    globalWallet = null
    localStorage.removeItem('vinylvault_wallet')
    emitChange()
  }, [])

  useEffect(() => {
    if (globalWallet) return

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
          globalWallet = {
            ...parsed,
            publicKey: walletProvider.publicKey.toString(),
            connected: true,
          }
          emitChange()
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
