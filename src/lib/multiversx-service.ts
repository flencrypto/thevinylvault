/**
 * VinylVault MultiversX Service
 *
 * Handles xPortal Web / DeFi wallet connection and ESDT NFT minting via the
 * VinylVault certificate smart contract on the MultiversX blockchain.
 *
 * Dependencies: MultiversX xPortal Web browser extension.
 *
 * Usage:
 *   const info = await multiversxService.connectWallet();
 *   const result = await multiversxService.mintRecordNFT(tokenId, metadata);
 *
 * Contract:
 *   Call `setContractAddress()` with the bech32 address printed by
 *   `mxpy contract deploy`.  Leaving it null yields a CONTRACT_NOT_CONFIGURED
 *   error that the UI handles gracefully.
 *
 * ⚠️  This script handles only CLIENT-SIDE wallet interaction.  It never
 *     stores private keys.  All signing happens inside the user's xPortal
 *     or DeFi wallet extension.
 */

/* ------------------------------------------------------------------ */
/*  Window type declarations                                            */
/* ------------------------------------------------------------------ */

interface MultiversXProvider {
  init(): Promise<void>
  login(): Promise<void>
  logout(): Promise<void>
  getAddress(): Promise<string>
  signTransaction(tx: MultiversXTransaction): Promise<MultiversXTransaction>
}

interface MultiversXTransaction {
  nonce: number
  value: string
  receiver: string
  sender: string
  gasPrice: number
  gasLimit: number
  data: string
  chainID: string
  version: number
}

declare global {
  interface Window {
    multiversx?: MultiversXProvider
    elrondWallet?: MultiversXProvider
  }
}

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface MultiversXNFTMetadata {
  artist: string
  title: string
  year: string
  catno: string
  condition: string
}

export interface MintResult {
  txHash: string
  tokenId: string
  explorerUrl: string
}

export type MultiversXNetwork = 'mainnet' | 'devnet' | 'testnet'
type AccountChangeCallback = (account: string | null) => void

/* ------------------------------------------------------------------ */
/*  Configuration                                                       */
/* ------------------------------------------------------------------ */

const API_URLS: Record<MultiversXNetwork, string> = {
  mainnet: 'https://api.multiversx.com',
  devnet: 'https://devnet-api.multiversx.com',
  testnet: 'https://testnet-api.multiversx.com',
}

const EXPLORER_URLS: Record<MultiversXNetwork, string> = {
  mainnet: 'https://explorer.multiversx.com',
  devnet: 'https://devnet-explorer.multiversx.com',
  testnet: 'https://testnet-explorer.multiversx.com',
}

const CHAIN_IDS: Record<MultiversXNetwork, string> = {
  mainnet: '1',
  devnet: 'D',
  testnet: 'T',
}

/* ------------------------------------------------------------------ */
/*  Internal state                                                      */
/* ------------------------------------------------------------------ */

let _account: string | null = null
let _wallet: MultiversXProvider | null = null
let _network: MultiversXNetwork = 'devnet'
let _contractAddress: string | null = null

const _listeners: { accountChange: AccountChangeCallback[] } = {
  accountChange: [],
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function _notifyAccountChange(account: string | null): void {
  _listeners.accountChange.forEach((cb) => {
    try { cb(account) } catch (_e) { /* ignore */ }
  })
}

function _isMvrxWalletAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    (Boolean(window.multiversx) || Boolean(window.elrondWallet))
  )
}

function _getProvider(): MultiversXProvider | null {
  if (typeof window === 'undefined') return null
  return window.multiversx || window.elrondWallet || null
}

/** Encode a UTF-8 string as lowercase hex. */
function _toHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

export const multiversxService = {
  isConnected(): boolean {
    return Boolean(_account)
  },

  getAccount(): string | null {
    return _account
  },

  getNetworkName(): string {
    return _network === 'mainnet' ? 'MultiversX' : `MultiversX ${_network}`
  },

  getShortAddress(): string {
    return _account ? _account.slice(0, 8) + '…' + _account.slice(-4) : ''
  },

  isWalletAvailable: _isMvrxWalletAvailable,

  /**
   * Connect the user's MultiversX wallet (xPortal Web / DeFi extension).
   */
  async connectWallet(): Promise<string> {
    const provider = _getProvider()
    if (!provider) {
      throw new Error(
        'No MultiversX wallet detected. ' +
        'Please install the xPortal Web extension ' +
        '(chromewebstore.google.com/detail/multiversx-defi-wallet).',
      )
    }

    await provider.init()
    await provider.login()

    const address = await provider.getAddress()
    if (!address) {
      throw new Error('MultiversX login failed or was rejected.')
    }

    _account = address
    _wallet = provider
    _notifyAccountChange(_account)
    return _account
  },

  /** Clear local state and log out from the wallet. */
  disconnectWallet(): void {
    if (_wallet) {
      _wallet.logout().catch(() => {})
    }
    _account = null
    _wallet = null
    _notifyAccountChange(null)
  },

  /**
   * Mint a vinyl-record certificate NFT on MultiversX via the deployed
   * VinylVault smart contract.
   *
   * Calls the `mintCertificate` endpoint with hex-encoded record attributes.
   */
  async mintRecordNFT(tokenId: string, metadata: MultiversXNFTMetadata): Promise<MintResult> {
    if (!_contractAddress) {
      const err = new Error(
        'MultiversX contract is not configured. ' +
        'Call setContractAddress() after deploying with `mxpy contract deploy`.',
      ) as Error & { code?: string }
      err.code = 'CONTRACT_NOT_CONFIGURED'
      throw err
    }

    if (!this.isConnected()) {
      await this.connectWallet()
    }

    const apiUrl = API_URLS[_network] || API_URLS.devnet
    const explorerBase = EXPLORER_URLS[_network] || EXPLORER_URLS.devnet
    const chainID = CHAIN_IDS[_network] || 'D'

    // Fetch current account nonce (prevents replay).
    const acctResp = await fetch(`${apiUrl}/accounts/${_account}`)
    if (!acctResp.ok) {
      throw new Error(`Failed to fetch account info: ${acctResp.statusText}`)
    }
    const acctData = await acctResp.json()
    const nonce: number = acctData.nonce ?? 0

    // Build smart-contract call data:
    //   mintCertificate@<tokenId_hex>@<artist_hex>@<title_hex>@<year_hex>@<catno_hex>@<condition_hex>
    const hexArgs = [
      tokenId,
      metadata.artist || '',
      metadata.title || '',
      metadata.year || '',
      metadata.catno || '',
      metadata.condition || '',
    ].map(_toHex)
    const scData = 'mintCertificate@' + hexArgs.join('@')

    const tx: MultiversXTransaction = {
      nonce,
      value: '0',
      receiver: _contractAddress,
      sender: _account!,
      gasPrice: 1000000000,
      gasLimit: 5000000,
      data: btoa(scData),
      chainID,
      version: 1,
    }

    const signedTx = await _wallet!.signTransaction(tx)

    const sendResp = await fetch(`${apiUrl}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedTx),
    })
    if (!sendResp.ok) {
      const errData = await sendResp.json().catch(() => ({}))
      throw new Error(
        `Transaction broadcast failed: ${errData.error || sendResp.statusText}`,
      )
    }

    const { txHash } = await sendResp.json()
    const explorerUrl = `${explorerBase}/transactions/${txHash}`

    return { txHash, tokenId, explorerUrl }
  },

  onAccountChange(callback: AccountChangeCallback): void {
    if (typeof callback === 'function') {
      _listeners.accountChange.push(callback)
    }
  },

  setNetwork(network: MultiversXNetwork): void {
    _network = network
  },

  setContractAddress(address: string): void {
    _contractAddress = address
  },

  shortAddress: (a: string | null): string =>
    a ? a.slice(0, 8) + '…' + a.slice(-4) : '',
}
