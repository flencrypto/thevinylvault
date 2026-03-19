import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Database, Check, ArrowRight, Info, Lig
import { Database, Check, ArrowRight, Info, Lightning, TestTube } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'

}
export default function Di
    return (
 

export default function DiscogsSetupGuide({ onGetStarted, isConfigured = false }: DiscogsSetupGuideProps) {
  if (isConfigured) {
    return (
      <Card className="bg-gradient-to-br from-green-500/20 via-green-500/10 to-transparent border-green-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Check className="w-6 h-6 text-green-500" weight="bold" />
            Discogs API Configured
          </CardTitle>
          <CardDescription className="text-slate-300">
              <p className="text-xs text-slate-300">
              </p>
          </div>
            <Button
                const tokenInput = document.getElementById('discogs-user-token')
              }}
              size="sm"
            >
              Test Connection
          </div>
      </Card>
  }
  return (
      <CardHeader>
          <div clas
              <Database classN
            <div>
              <CardDescription className="text-slate-300 mt-1">
              </
          </div>
        </div>
      <CardContent className="space-y-5">
          <h3
            Why Discogs?
          <p className="text-
            With your
        </div>
        <div className
          <ol
     
   

          
                    target="_blank"
                  
                    Discogs Developer Settings
                </p>
            </li>
              <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center j
              </di
                <
            </li>
              <div className="w-6 h-6 bg-accent/20 rounded-full
              </div>
                <p className="te
            </li>
              <d
              </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="bg-slate-800/40 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Info className="w-4 h-4 text-accent" />
            Why Discogs?
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            VinylVault uses the Discogs database (millions of verified vinyl releases) to accurately identify pressings from your photos. 
            With your Personal Access Token configured, pressing identification becomes significantly more accurate with verified catalog data.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white">Quick Setup (60 seconds)</h3>
          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-accent">1</span>
            </li>
              <div className="w-6 h-6 
                <p className="text-sm text-slate-200">
                  Visit{' '}
                  <a
                    href="https://www.discogs.com/settings/developers"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline font-semibold"
                  >
                    Discogs Developer Settings
                  </a>
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-accent">2</span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-200">Scroll to "Personal Access Tokens" section</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-accent">3</span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-200">Click "Generate new token"</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-accent">4</span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-200">Name it "VinylVault" and click Generate</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-accent">5</span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-amber-300 font-semibold">
                  ⚠️ Copy the token immediately (shown only once!)
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-accent">6</span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-200">Paste it in the field below</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-accent">7</span>
              </div>
              <div className="flex-1">










            size="lg"
          >
            <Database className="w-5 h-5" weight="fill" />
            Configure Token
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => window.open('/DISCOGS_API_SETUP.md', '_blank')}
            variant="outline"
            size="lg"
            className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-2"
          >
            <TestTube className="w-4 h-4" />
            Full Guide
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
