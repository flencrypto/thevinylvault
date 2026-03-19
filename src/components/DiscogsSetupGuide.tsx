import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
interface DiscogsSetupGuideProps {

interface DiscogsSetupGuideProps {
  isConfigured?: boolean
  onGetStarted: () => void
}

        </CardDescription>
      <Car
          <ol className="space-y-3 text-sm">
              <spa
                <p className="text-sm text-foreground">Visit Discogs 
              </div>
            <li clas
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Generate 
            </li>
              <span
                <p 
              </div>
          </ol>
        <div className="flex gap-2 flex
            onClick={onGetStarted}
            size="sm"
            {isConfigured ? (
                <Check className="w-4 h-4" />
              </>
              <>
                Configure Token
            )}
        </div>
    </Card>
}


































