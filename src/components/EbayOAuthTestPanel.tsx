import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Warning, TestTube } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { ebayBrowseService } from '@/lib/ebay-browse-service'

interface EbayOAuthTestPanelProps {
  hasCredentials: boolean
}

interface TestResult {
  ok: boolean
  message: string
  expiresAt?: number
  scopes?: string[]
}

/**
 * Settings panel sub-component that surfaces the eBay OAuth scope catalogue
 * and a "Test connection" button.
 */
export default function EbayOAuthTestPanel({ hasCredentials }: EbayOAuthTestPanelProps) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)

  const grantedScopes = ebayBrowseService.getGrantedScopes()

  const handleTest = async () => {
    if (!hasCredentials) {
      toast.error('Enter eBay Client ID and Client Secret first')
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const res = await ebayBrowseService.testConnection()
      if (res.ok) {
        setResult({
          ok: true,
          message: 'OAuth token minted successfully',
          expiresAt: res.expiresAt,
          scopes: res.scopes,
        })
        toast.success('eBay OAuth connection verified')
      } else {
        setResult({ ok: false, message: res.error })
        toast.error(`eBay OAuth failed: ${res.error}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setResult({ ok: false, message })
      toast.error(`eBay OAuth failed: ${message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">OAuth Connection</p>
          <p className="text-xs text-slate-500">
            Mints an application token via the Client Credentials grant using the default Browse API scope.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleTest}
          disabled={busy || !hasCredentials}
          className="shrink-0"
        >
          <TestTube className="w-4 h-4 mr-1.5" />
          {busy ? 'Testing…' : 'Test eBay OAuth'}
        </Button>
      </div>

      {result && (
        <div
          className={`flex items-start gap-2 rounded border p-2 text-xs ${
            result.ok
              ? 'border-emerald-700/50 bg-emerald-950/30 text-emerald-200'
              : 'border-rose-700/50 bg-rose-950/30 text-rose-200'
          }`}
        >
          {result.ok ? (
            <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
          ) : (
            <Warning className="w-4 h-4 mt-0.5 flex-shrink-0" />
          )}
          <div className="space-y-1">
            <p className="font-medium">{result.message}</p>
            {result.ok && result.expiresAt && (
              <p className="text-[11px] opacity-80">
                Token valid until {new Date(result.expiresAt).toLocaleString()}
              </p>
            )}
            {result.ok && result.scopes && result.scopes.length > 0 && (
              <p className="text-[11px] opacity-80 break-all">
                Scopes: {result.scopes.join(' ')}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-slate-300">Granted scopes</p>
        <div className="flex flex-wrap gap-1.5">
          {grantedScopes.map((scope) => {
            const short = scope.replace('https://api.ebay.com/oauth/', '')
            return (
              <Badge
                key={scope}
                variant="secondary"
                className="bg-slate-800/80 text-[10px] font-mono text-slate-200"
                title={scope}
              >
                {short}
              </Badge>
            )
          })}
        </div>
        <p className="text-[11px] text-slate-500">
          Application-level scopes available via the Client Credentials grant. See <code className="text-amber-300">EBAY_OAUTH_SCOPES.md</code>.
        </p>
      </div>
    </div>
  )
}
