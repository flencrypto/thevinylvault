/**
 * VinylVault Bitcoin Ordinals Service
 *
 * Handles Unisat / Xverse wallet connection and Bitcoin Ordinals inscriptions
 * for vinyl record authenticity certificates.
 *
 * Bitcoin does not have a traditional smart-contract runtime.  Authenticity
 * certificates are instead stored as JSON Ordinals inscriptions permanently
 * embedded in the Bitcoin blockchain.
 *
 * Dependencies: Unisat (window.unisat) or Xverse (window.XverseProviders)
 *               browser extension.
 *
 * Usage:
 *   const info = await bitcoinOrdinalsService.connectWallet();
 *   const result = await bitcoinOrdinalsService.mintRecordNFT(tokenId, metadata);
 *
 * ⚠️  Ordinals inscriptions are permanent and require on-chain BTC fees.
 *     Production deployments should verify fee-rate via mempool.space API.
 */

/* ------------------------------------------------------------------ */
/*  Window type declarations                                            */
/* ------------------------------------------------------------------ */

interface UnisatWallet {
  requestAccounts(): Promise<string[]>
  inscribeContent?(params: {
    content: string
    contentType: string
    feeRate: number
  }): Promise<string>
  signMessage(message: string): Promise<string>
  on(event: string, handler: (...args: unknown[]) => void): void
}

interface XverseConnectResponse {
  addresses?: Array<{ address: string }>
}

interface XverseBitcoinProvider {
  connect(params: { purposes: string[] }): Promise<XverseConnectResponse>
  signMessage(params: {
    address: string
    message: string
  }): Promise<{ signature?: string } | string>
}

declare global {
  interface Window {
    unisat?: UnisatWallet
    XverseProviders?: {
      BitcoinProvider?: XverseBitcoinProvider
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface BitcoinNFTMetadata {
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
  onChain?: boolean
  note?: string
}

type WalletType = 'unisat' | 'xverse' | null
type AccountChangeCallback = (account: string | null) => void

/* ------------------------------------------------------------------ */
/*  Internal state                                                      */
/* ------------------------------------------------------------------ */

let _account: string | null = null
let _walletType: WalletType = null

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

function _isBitcoinWalletAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    (Boolean(window.unisat) || Boolean(window.XverseProviders?.BitcoinProvider))
  )
}

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

export const bitcoinOrdinalsService = {
  isConnected(): boolean {
    return Boolean(_account)
  },

  getAccount(): string | null {
    return _account
  },

  getNetworkName(): string {
    return 'Bitcoin (Ordinals)'
  },

  getShortAddress(): string {
    return _account ? _account.slice(0, 6) + '…' + _account.slice(-4) : ''
  },

  isWalletAvailable: _isBitcoinWalletAvailable,

  /**
   * Connect the user's Bitcoin wallet (Unisat or Xverse).
   */
  async connectWallet(): Promise<string> {
    if (!_isBitcoinWalletAvailable()) {
      throw new Error(
        'No Bitcoin wallet detected. ' +
        'Please install Unisat (unisat.io) or Xverse (xverse.app).',
      )
    }

    let accounts: string[] | undefined

    if (window.unisat) {
      accounts = await window.unisat.requestAccounts()
      _walletType = 'unisat'

      window.unisat.on('accountsChanged', (accs: unknown) => {
        const list = accs as string[]
        _account = list.length > 0 ? list[0] : null
        _notifyAccountChange(_account)
      })
    } else {
      const provider = window.XverseProviders!.BitcoinProvider!
      const response = await provider.connect({
        purposes: ['ordinals', 'payment'],
      })
      accounts = (response.addresses || []).map((a) => a.address)
      _walletType = 'xverse'
    }

    if (!accounts || accounts.length === 0) {
      throw new Error(
        'No Bitcoin accounts returned. Did you reject the wallet connection?',
      )
    }

    _account = accounts[0]
    _notifyAccountChange(_account)
    return _account
  },

  /** Clear local state. */
  disconnectWallet(): void {
    _account = null
    _walletType = null
    _notifyAccountChange(null)
  },

  /**
   * Inscribe a vinyl-record certificate as a Bitcoin Ordinal.
   *
   * Creates a JSON inscription containing the record metadata and requests
   * the user's wallet to sign and broadcast the inscription transaction.
   *
   * Unisat wallets support `window.unisat.inscribeContent()` for a
   * streamlined flow.  Xverse and other wallets fall back to a signed
   * message proof-of-intent (note: not a full on-chain inscription).
   */
  async mintRecordNFT(tokenId: string, metadata: BitcoinNFTMetadata): Promise<MintResult> {
    if (!this.isConnected()) {
      await this.connectWallet()
    }

    const inscriptionPayload = {
      p: 'vinylvault-cert',
      op: 'mint',
      token_id: tokenId,
      artist: metadata.artist || '',
      title: metadata.title || '',
      year: metadata.year || '',
      catno: metadata.catno || '',
      condition: metadata.condition || '',
      ts: new Date().toISOString(),
    }
    const contentJson = JSON.stringify(inscriptionPayload)

    if (_walletType === 'unisat' && window.unisat?.inscribeContent) {
      const txid = await window.unisat.inscribeContent({
        content: contentJson,
        contentType: 'application/json',
        feeRate: 10,
      })
      const explorerUrl = `https://ordinals.com/inscription/${txid}i0`
      return { txHash: txid, tokenId, explorerUrl }
    }

    // Fallback: sign the JSON payload as a message (proof of intent).
    const message = `VinylVault Certificate\n${contentJson}`
    let signature: string

    if (_walletType === 'unisat') {
      signature = await window.unisat!.signMessage(message)
    } else if (window.XverseProviders?.BitcoinProvider) {
      const resp = await window.XverseProviders.BitcoinProvider.signMessage({
        address: _account!,
        message,
      })
      signature = typeof resp === 'string' ? resp : (resp.signature || String(resp))
    } else {
      throw new Error('Unable to sign message: unsupported wallet type.')
    }

    return {
      txHash: signature,
      tokenId,
      explorerUrl: '',
      onChain: false,
      note: 'Signed locally — use a Unisat wallet with inscription support for full on-chain recording.',
    }
  },

  onAccountChange(callback: AccountChangeCallback): void {
    if (typeof callback === 'function') {
      _listeners.accountChange.push(callback)
    }
  },

  shortAddress: (a: string | null): string =>
    a ? a.slice(0, 6) + '…' + a.slice(-4) : '',
}
