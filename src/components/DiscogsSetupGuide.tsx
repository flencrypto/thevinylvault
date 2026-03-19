import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Database, Check, ArrowRight, Info, Lightning, TestTube } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface DiscogsSetupGuideProps {
  onGetStarted: () => void
  isConfigured?: boolean
}

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
            Your Discogs Personal Access Token is configured and ready to use.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              onClick={onGetStarted}
              className="bg-green-500 hover:bg-green-600 text-white"
              size="sm"
            >
              <Check className="w-4 h-4" />
              Ready to Use
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-br from-accent/10 via-transparent to-transparent border-accent/30">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-accent/20 rounded-lg">
            <Database className="w-6 h-6 text-accent" weight="fill" />
          </div>
          <div>
            <CardTitle className="text-white">Setup Discogs API</CardTitle>
            <CardDescription className="text-slate-300 mt-1">
              Connect to Discogs for accurate pressing identification
            </CardDescription>
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
              </div>
              <div className="flex-1">
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
                <p className="text-sm text-slate-200">Click "Configure Token" below to enter it</p>
              </div>
            </li>
          </ol>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={onGetStarted}
            className="bg-accent hover:bg-accent/90 text-accent-foreground flex-1 gap-2"
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
