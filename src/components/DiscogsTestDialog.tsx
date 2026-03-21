import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Database, Lightning, CheckCircle, Warning, MagnifyingGlass, Disc, MapPin, Calendar, Barcode } from '@phosphor-icons/react'
import { searchDiscogsDatabase, DiscogsRelease } from '@/lib/pressing-identification-ai'
import { testDiscogsConnection } from '@/lib/marketplace-discogs'
import { toast } from 'sonner'

interface DiscogsTestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userToken: string
}

export function DiscogsTestDialog({ open, onOpenChange, userToken }: DiscogsTestDialogProps) {
  const [testType, setTestType] = useState<'connection' | 'search'>('connection')
  const [testing, setTesting] = useState(false)
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null)
  
  const [searchQuery, setSearchQuery] = useState({
    artist: 'Pink Floyd',
    title: 'The Dark Side of the Moon',
    catalogNumber: '',
    country: '',
    year: '',
  })
  
  const [searchResults, setSearchResults] = useState<DiscogsRelease[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)

  const handleTestConnection = async () => {
    setTesting(true)
    setConnectionResult(null)
    
    try {
      const result = await testDiscogsConnection({
        userToken,
      })
      
      setConnectionResult(result)
      
      if (result.success) {
        toast.success('Discogs API connected!', {
          description: result.message,
        })
      } else {
        toast.error('Connection failed', {
          description: result.message,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setConnectionResult({
        success: false,
        message,
      })
      toast.error('Connection test failed', {
        description: message,
      })
    } finally {
      setTesting(false)
    }
  }

  const handleTestSearch = async () => {
    if (!searchQuery.artist && !searchQuery.title && !searchQuery.catalogNumber) {
      toast.error('Please enter at least an artist, title, or catalog number')
      return
    }

    setTesting(true)
    setSearchResults([])
    setSearchError(null)
    
    try {
      const results = await searchDiscogsDatabase(
        {
          artist: searchQuery.artist || undefined,
          title: searchQuery.title || undefined,
          catalogNumber: searchQuery.catalogNumber || undefined,
          country: searchQuery.country || undefined,
          year: searchQuery.year ? parseInt(searchQuery.year) : undefined,
        },
        userToken
      )
      
      setSearchResults(results)
      
      if (results.length > 0) {
        toast.success(`Found ${results.length} pressing${results.length !== 1 ? 's' : ''} in Discogs database`)
      } else {
        toast.info('No results found', {
          description: 'Try adjusting your search criteria',
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setSearchError(message)
      toast.error('Search failed', {
        description: message,
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-accent" weight="bold" />
            Test Discogs Connection
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Verify your Discogs API integration and test real database pressing identification
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="flex gap-2">
            <Button
              onClick={() => setTestType('connection')}
              variant={testType === 'connection' ? 'default' : 'outline'}
              className="flex-1"
            >
              <Lightning className="w-4 h-4 mr-2" />
              Connection Test
            </Button>
            <Button
              onClick={() => setTestType('search')}
              variant={testType === 'search' ? 'default' : 'outline'}
              className="flex-1"
            >
              <MagnifyingGlass className="w-4 h-4 mr-2" />
              Database Search Test
            </Button>
          </div>

          {testType === 'connection' && (
            <div className="space-y-4">
              <Alert className="bg-slate-800/50 border-slate-700">
                <Info className="w-4 h-4 text-accent" />
                <AlertDescription className="text-slate-300">
                  This will test your Discogs API connection by performing a simple marketplace query. A successful result confirms your token is valid and the API is accessible.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleTestConnection}
                disabled={testing || !userToken}
                className="w-full"
                size="lg"
              >
                {testing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-accent-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <Lightning className="w-5 h-5 mr-2" />
                    Test Discogs API Connection
                  </>
                )}
              </Button>

              {connectionResult && (
                <Card className={`${connectionResult.success ? 'bg-green-950/20 border-green-800' : 'bg-red-950/20 border-red-800'}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      {connectionResult.success ? (
                        <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" weight="fill" />
                      ) : (
                        <Warning className="w-6 h-6 text-red-500 flex-shrink-0" weight="fill" />
                      )}
                      <div>
                        <h4 className={`font-semibold mb-1 ${connectionResult.success ? 'text-green-400' : 'text-red-400'}`}>
                          {connectionResult.success ? 'Connection Successful' : 'Connection Failed'}
                        </h4>
                        <p className="text-sm text-slate-300">{connectionResult.message}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {testType === 'search' && (
            <div className="space-y-4">
              <Alert className="bg-slate-800/50 border-slate-700">
                <Database className="w-4 h-4 text-accent" />
                <AlertDescription className="text-slate-300">
                  Search the real Discogs database for vinyl pressings. This is the same API call used during pressing identification.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="search-artist" className="text-slate-200">Artist</Label>
                  <Input
                    id="search-artist"
                    value={searchQuery.artist}
                    onChange={(e) => setSearchQuery(prev => ({ ...prev, artist: e.target.value }))}
                    placeholder="e.g., Pink Floyd"
                    className="bg-slate-950/50 border-slate-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="search-title" className="text-slate-200">Title</Label>
                  <Input
                    id="search-title"
                    value={searchQuery.title}
                    onChange={(e) => setSearchQuery(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., The Dark Side of the Moon"
                    className="bg-slate-950/50 border-slate-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="search-catalog" className="text-slate-200">Catalog Number</Label>
                  <Input
                    id="search-catalog"
                    value={searchQuery.catalogNumber}
                    onChange={(e) => setSearchQuery(prev => ({ ...prev, catalogNumber: e.target.value }))}
                    placeholder="e.g., SHVL 804"
                    className="bg-slate-950/50 border-slate-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="search-country" className="text-slate-200">Country</Label>
                  <Input
                    id="search-country"
                    value={searchQuery.country}
                    onChange={(e) => setSearchQuery(prev => ({ ...prev, country: e.target.value }))}
                    placeholder="e.g., UK"
                    className="bg-slate-950/50 border-slate-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="search-year" className="text-slate-200">Year</Label>
                  <Input
                    id="search-year"
                    type="number"
                    value={searchQuery.year}
                    onChange={(e) => setSearchQuery(prev => ({ ...prev, year: e.target.value }))}
                    placeholder="e.g., 1973"
                    className="bg-slate-950/50 border-slate-700 text-white"
                  />
                </div>
              </div>

              <Button
                onClick={handleTestSearch}
                disabled={testing || !userToken}
                className="w-full"
                size="lg"
              >
                {testing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-accent-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Searching Discogs Database...
                  </>
                ) : (
                  <>
                    <MagnifyingGlass className="w-5 h-5 mr-2" />
                    Search Discogs Database
                  </>
                )}
              </Button>

              {searchError && (
                <Card className="bg-red-950/20 border-red-800">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Warning className="w-6 h-6 text-red-500 flex-shrink-0" weight="fill" />
                      <div>
                        <h4 className="font-semibold mb-1 text-red-400">Search Failed</h4>
                        <p className="text-sm text-slate-300">{searchError}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-semibold">Database Results ({searchResults.length})</h4>
                    <Badge variant="outline" className="border-accent text-accent">
                      Real Discogs Data
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {searchResults.map((release, idx) => {
                      const artist = release.artists?.[0]?.name || 'Unknown Artist'
                      const label = release.labels?.[0]
                      const format = release.formats?.[0]
                      const matrixIds = release.identifiers?.filter(id => 
                        id.type.includes('Matrix') || id.type.includes('Runout')
                      )

                      return (
                        <Card key={release.id} className="bg-slate-800/50 border-slate-700">
                          <CardContent className="pt-6">
                            <div className="flex gap-4">
                              {release.images?.[0] && (
                                <img
                                  src={release.images[0].uri}
                                  alt={release.title}
                                  className="w-24 h-24 object-cover rounded-lg border border-slate-600"
                                />
                              )}
                              
                              <div className="flex-1 space-y-2">
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <h5 className="font-semibold text-white">
                                      {artist} - {release.title}
                                    </h5>
                                    <Badge variant="secondary" className="text-xs">
                                      #{idx + 1}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-accent font-mono">
                                    Discogs ID: {release.id}
                                  </p>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  {release.year && (
                                    <div className="flex items-center gap-2 text-slate-300">
                                      <Calendar className="w-4 h-4 text-slate-400" />
                                      {release.year}
                                    </div>
                                  )}
                                  
                                  {release.country && (
                                    <div className="flex items-center gap-2 text-slate-300">
                                      <MapPin className="w-4 h-4 text-slate-400" />
                                      {release.country}
                                    </div>
                                  )}

                                  {format && (
                                    <div className="flex items-center gap-2 text-slate-300">
                                      <Disc className="w-4 h-4 text-slate-400" />
                                      {format.name} {format.descriptions?.join(', ')}
                                    </div>
                                  )}

                                  {label?.catno && (
                                    <div className="flex items-center gap-2 text-slate-300">
                                      <Barcode className="w-4 h-4 text-slate-400" />
                                      {label.catno}
                                    </div>
                                  )}
                                </div>

                                {label && (
                                  <div className="text-sm">
                                    <span className="text-slate-400">Label: </span>
                                    <span className="text-slate-200">{label.name}</span>
                                  </div>
                                )}

                                {matrixIds && matrixIds.length > 0 && (
                                  <div className="text-sm">
                                    <span className="text-slate-400">Matrix/Runout: </span>
                                    <span className="text-slate-200 font-mono text-xs">
                                      {matrixIds.map(m => m.value).join(' / ')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Info({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor">
      <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z"/>
    </svg>
  )
}
