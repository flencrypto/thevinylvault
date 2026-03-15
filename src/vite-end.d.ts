/// <reference types="vite/client" />
declare const GITHUB_RUNTIME_PERMANENT_NAME: string
declare const BASE_KV_SERVICE_URL: string

interface SolanaWallet {
  isPhantom?: boolean
  isSolflare?: boolean
  isBackpack?: boolean
  connect: () => Promise<{ publicKey: { toString: () => string } }>
  disconnect: () => Promise<void>
  on: (event: string, callback: () => void) => void
  off: (event: string, callback: () => void) => void
  publicKey?: { toString: () => string } | null
  isConnected?: boolean
  signAndSendTransaction: (transaction: unknown) => Promise<string>
}

interface Window {
  spark: {
    llmPrompt: (strings: TemplateStringsArray, ...values: unknown[]) => string
    llm: (prompt: string, modelName?: string, jsonMode?: boolean) => Promise<string>
    user: () => Promise<{
      avatarUrl: string
      email: string
      id: string
      isOwner: boolean
      login: string
    }>
    kv: {
      keys: () => Promise<string[]>
      get: <T>(key: string) => Promise<T | undefined>
      set: <T>(key: string, value: T) => Promise<void>
      delete: (key: string) => Promise<void>
    }
  }
  solana?: SolanaWallet
  solflare?: SolanaWallet
  backpack?: SolanaWallet
}

declare const spark: Window['spark']