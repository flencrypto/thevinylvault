import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Gear } from '@phosphor-icons/react'

interface DiscogsSetupGuideProps {
  isConfigured?: boolean
  onGetStarted: () => void
}

export default function DiscogsSetupGuide({ isConfigured, onGetStarted }: DiscogsSetupGuideProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Connect to Discogs
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Set up your Discogs API token to unlock marketplace features
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ol className="space-y-3 text-sm">
            <li className="flex gap-2">
              <span className="text-xs font-semibold text-accent bg-accent/10 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <div className="flex-1">
                <p className="text-sm text-foreground">Visit Discogs Settings</p>
                <p className="text-sm text-muted-foreground">Go to your Discogs account settings</p>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="text-xs font-semibold text-accent bg-accent/10 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <div className="flex-1">
                <p className="text-sm text-foreground">Generate Token</p>
                <p className="text-sm text-muted-foreground">Generate a new Personal Access Token</p>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="text-xs font-semibold text-accent bg-accent/10 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <div className="flex-1">
                <p className="text-sm text-foreground">Configure</p>
                <p className="text-sm text-muted-foreground">Click "Configure Token" below to enter it</p>
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
                <Gear className="w-4 h-4" />
                Configure Token
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
