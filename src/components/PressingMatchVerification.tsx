import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  CheckCircle, 
  Warning, 
  Images, 
  Barcode, 
  Database,
  LinkSimple,
  Eye,
  Sparkle 
} from '@phosphor-icons/react'
import { ScoredPressingCandidate } from '@/lib/pressing-identification-ai'
import { ItemImage } from '@/lib/types'
import { verifyPressingMatch } from '@/lib/pressing-verification-service'

interface PressingMatchVerificationProps {
  candidate: ScoredPressingCandidate
  userImages: ItemImage[]
  discogsApiToken?: string
}

interface VerificationResult {
  overallMatch: number
  imageMatch: number
  matrixMatch: number
  labelMatch: number
  details: string[]
  warnings: string[]
  discogsImages?: string[]
}

export function PressingMatchVerification({
  candidate,
  userImages,
  discogsApiToken,
}: PressingMatchVerificationProps) {
  const [verifying, setVerifying] = useState(false)
  const [verification, setVerification] = useState<VerificationResult | null>(null)

  const performVerification = useCallback(async () => {
    setVerifying(true)
    try {
      const result = await verifyPressingMatch(candidate, userImages, discogsApiToken)
      setVerification(result)
    } catch (error) {
      console.error('Verification failed:', error)
    } finally {
      setVerifying(false)
    }
  }, [candidate, userImages, discogsApiToken])

  useEffect(() => {
    if (candidate.discogsId && discogsApiToken) {
      performVerification()
    }
  }, [candidate.discogsId, discogsApiToken, performVerification])

  const getMatchColor = (percentage: number) => {
    if (percentage >= 85) return 'text-green-400'
    if (percentage >= 70) return 'text-yellow-400'
    if (percentage >= 50) return 'text-orange-400'
    return 'text-red-400'
  }

  const getMatchLabel = (percentage: number) => {
    if (percentage >= 85) return 'Excellent Match'
    if (percentage >= 70) return 'Good Match'
    if (percentage >= 50) return 'Possible Match'
    return 'Uncertain Match'
  }

  const discogsUrl = candidate.discogsId 
    ? `https://www.discogs.com/release/${candidate.discogsId}`
    : candidate.discogsUrl

  return (
    <Card className="p-6 bg-slate-900/50 border-slate-700">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Database size={20} className="text-accent" />
              Discogs Database Match
            </h3>
            <p className="text-sm text-muted-foreground">
              {candidate.artistName} - {candidate.releaseTitle}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${getMatchColor(candidate.confidence * 100)}`}>
              {Math.round(candidate.confidence * 100)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {getMatchLabel(candidate.confidence * 100)}
            </p>
          </div>
        </div>

        <Progress value={candidate.confidence * 100} className="h-2" />

        <div className="grid grid-cols-2 gap-3">
          <Badge variant="outline" className="justify-center py-2">
            {candidate.country} • {candidate.year}
          </Badge>
          <Badge variant="outline" className="justify-center py-2">
            {candidate.format}
          </Badge>
          {candidate.catalogNumber && (
            <Badge variant="outline" className="justify-center py-2 font-mono">
              <Barcode size={14} className="mr-1" />
              {candidate.catalogNumber}
            </Badge>
          )}
          {candidate.matrixNumbers && candidate.matrixNumbers.length > 0 && (
            <Badge variant="outline" className="justify-center py-2 font-mono text-xs">
              {candidate.matrixNumbers.join(', ')}
            </Badge>
          )}
        </div>

        {discogsUrl && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open(discogsUrl, '_blank')}
          >
            <LinkSimple size={16} className="mr-2" />
            View on Discogs
          </Button>
        )}

        {candidate.discogsVariant && (
          <Alert className="bg-accent/10 border-accent">
            <Database size={16} className="text-accent" />
            <AlertDescription>
              <span className="font-semibold">Variant:</span> {candidate.discogsVariant}
            </AlertDescription>
          </Alert>
        )}

        {verifying && (
          <div className="space-y-2 py-4">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Sparkle size={16} className="animate-pulse" />
              Verifying match with AI image analysis...
            </div>
            <Progress value={66} className="h-1" />
          </div>
        )}

        {verification && (
          <Tabs defaultValue="overview" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="images">
                <Images size={14} className="mr-1" />
                Images
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-3 mt-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                  <div className={`text-2xl font-bold ${getMatchColor(verification.imageMatch)}`}>
                    {Math.round(verification.imageMatch)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Image Match</p>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                  <div className={`text-2xl font-bold ${getMatchColor(verification.matrixMatch)}`}>
                    {Math.round(verification.matrixMatch)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Matrix Match</p>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                  <div className={`text-2xl font-bold ${getMatchColor(verification.labelMatch)}`}>
                    {Math.round(verification.labelMatch)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Label Match</p>
                </div>
              </div>

              {verification.details.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-400" />
                    Match Details
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {verification.details.map((detail, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">•</span>
                        <span className="text-muted-foreground">{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {verification.warnings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Warning size={16} className="text-yellow-400" />
                    Verification Warnings
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {verification.warnings.map((warning, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-yellow-400 mt-0.5">•</span>
                        <span className="text-muted-foreground">{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </TabsContent>

            <TabsContent value="images" className="space-y-3 mt-4">
              {verification.discogsImages && verification.discogsImages.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Compare your photos with Discogs database images:
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {verification.discogsImages.slice(0, 4).map((imageUrl, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-slate-800">
                        <img
                          src={imageUrl}
                          alt={`Discogs image ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-xs text-white">Discogs Image {idx + 1}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(discogsUrl, '_blank')}
                  >
                    <Eye size={14} className="mr-1" />
                    View All Images on Discogs
                  </Button>
                </>
              ) : (
                <Alert>
                  <Images size={16} />
                  <AlertDescription>
                    No Discogs images available for comparison. Manual verification recommended.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        )}

        {!verifying && !verification && discogsApiToken && candidate.discogsId && (
          <Button
            variant="outline"
            className="w-full"
            onClick={performVerification}
          >
            <Sparkle size={16} className="mr-2" />
            Verify Match with AI
          </Button>
        )}
      </div>
    </Card>
  )
}
