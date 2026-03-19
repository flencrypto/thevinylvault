import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Database, ArrowRight } from '@phosphor-icons/react'

interface DiscogsSetupGuideProps {
  isConfigured?: boolean
  onGetStarted: () => void
}

export default function DiscogsSetupGuide({ isConfigured, onGetStarted }: DiscogsSetupGuideProps) {
  return (
    <Card className="bg-gradient-to-br from-accent/10 via-transparent to-transparent border-accent/20">
      <CardHeader>
        <div className="flex items-start gap-3">
          <Database className="w-6 h-6 text-accent mt-1" weight="duotone" />
          <div>
            <CardTitle className="text-xl text-slate-100">Discogs Integration</CardTitle>
            <CardDescription className="text-slate-300">
              Connect to Discogs for enhanced record data and market insights
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ol className="space-y-3 text-sm">
            <li className="flex gap-2">
              <span className="text-xs font-semibold text-accent bg-accent/10 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <div className="flex-1">
                <p className="text-sm text-slate-200">Visit Discogs Developer Settings</p>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="text-xs font-semibold text-accent bg-accent/10 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <div className="flex-1">
                <p className="text-sm text-slate-200">Generate a new Personal Access Token</p>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="text-xs font-semibold text-accent bg-accent/10 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <div className="flex-1">
                <p className="text-sm text-slate-200">Click "Configure Token" below to enter it</p>
              </div>
            </li>
          </ol>
        </div>
        <div className="flex gap-2 flex-wrap mt-4">
          <Button
            onClick={onGetStarted}
            className="bg-accent hover:bg-accent/90 text-accent-foreground flex-1 gap-2"
            size="sm"
          >
            {isConfigured ? (
              <>
                <Check className="w-4 h-4" />
                Reconfigure Token
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                Configure Token
              </>
            )}
          </Button>
          <Button
            onClick={() => window.open('https://www.discogs.com/settings/developers', '_blank')}
            variant="outline"
            className="flex-1 gap-2"
            size="sm"
          >
            Open Discogs Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
