import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, XCircle, Warning, Play, Spinner } from '@phosphor-icons/react'

import { toast } from 'sonner'
import { analyzeVinylImage, identifyPressing } from '@/lib/image-analysis-ai'
import { identifyPressing as advancedIdentifyPressing } from '@/lib/pressing-identification-ai'
import { analyzeConditionFromImages } from '@/lib/condition-grading-ai'
import { generateSEOKeywords, generateListingCopy } from '@/lib/listing-ai'
import { analyzeBargainPotential } from '@/lib/bargain-detection-ai'
import type { CollectionItem, ItemImage, MarketListing, ImageAnalysisResult } from '@/lib/types'

interface TestResult {
  testName: string
  passed: boolean
  message: string
  details?: unknown
  duration: number
}

interface TestCategory {
  name: string
  tests: TestResult[]
  running: boolean
}

export default function AIEdgeCaseTester() {
  const [categories, setCategories] = useState<Record<string, TestCategory>>({
    imageAnalysis: { name: 'Image Analysis', tests: [], running: false },
    pressingIdentification: { name: 'Pressing Identification', tests: [], running: false },
    conditionGrading: { name: 'Condition Grading', tests: [], running: false },
    listingGeneration: { name: 'Listing Generation', tests: [], running: false },
    bargainDetection: { name: 'Bargain Detection', tests: [], running: false },
  })

  const updateCategory = (categoryKey: string, updates: Partial<TestCategory>) => {
    setCategories(prev => ({
      ...prev,
      [categoryKey]: { ...prev[categoryKey], ...updates }
    }))
  }

  const addTestResult = (categoryKey: string, result: TestResult) => {
    setCategories(prev => ({
      ...prev,
      [categoryKey]: {
        ...prev[categoryKey],
        tests: [...prev[categoryKey].tests, result]
      }
    }))
  }

  const runTest = async (
    categoryKey: string,
    testName: string,
    testFn: () => Promise<{ passed: boolean; message: string; details?: unknown }>
  ) => {
    const startTime = performance.now()
    try {
      const result = await testFn()
      const duration = performance.now() - startTime
      addTestResult(categoryKey, {
        testName,
        passed: result.passed,
        message: result.message,
        details: result.details,
        duration
      })
      return result.passed
    } catch (error: unknown) {
      const duration = performance.now() - startTime
      addTestResult(categoryKey, {
        testName,
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`,
        details: error,
        duration
      })
      return false
    }
  }

  const createTestItem = (overrides: Partial<CollectionItem> = {}): CollectionItem => ({
    id: 'test-item-' + Date.now(),
    collectionId: 'test-collection',
    artistName: 'Test Artist',
    releaseTitle: 'Test Album',
    format: 'LP',
    year: 1975,
    country: 'UK',
    catalogNumber: 'TEST123',
    purchaseCurrency: 'GBP',
    sourceType: 'unknown',
    quantity: 1,
    status: 'owned',
    condition: {
      mediaGrade: 'VG+',
      sleeveGrade: 'VG',
      gradingStandard: 'Goldmine',
      gradingNotes: 'Test notes',
      gradedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  })

  const runImageAnalysisTests = async () => {
    updateCategory('imageAnalysis', { running: true, tests: [] })

    await runTest('imageAnalysis', 'Empty image data URL', async () => {
      const result = await analyzeVinylImage('', 'front_cover')
      return {
        passed: result.confidence === 0 && result.extractedText.length === 0,
        message: result.confidence === 0 ? 'Correctly returned empty result' : 'Failed to handle empty input',
        details: result
      }
    })

    await runTest('imageAnalysis', 'Invalid image type', async () => {
      const result = await analyzeVinylImage('data:image/png;base64,invalid', 'unknown_type')
      return {
        passed: result.confidence >= 0 && Array.isArray(result.extractedText),
        message: 'Handled invalid image gracefully',
        details: result
      }
    })

    await runTest('imageAnalysis', 'Null/undefined handling', async () => {
      try {
        const result = await analyzeVinylImage(null as unknown as string, undefined as unknown as string)
        return {
          passed: result.confidence === 0,
          message: 'Handled null/undefined inputs',
          details: result
        }
      } catch (error: unknown) {
        return {
          passed: false,
          message: `Should not throw: ${error instanceof Error ? error.message : String(error)}`,
          details: error
        }
      }
    })

    await runTest('imageAnalysis', 'Multiple empty results aggregation', async () => {
      const results: ImageAnalysisResult[] = [
        { extractedText: [], identifiedLabels: [], matrixNumbers: [], catalogNumbers: [], barcodes: [], confidence: 0 },
        { extractedText: [], identifiedLabels: [], matrixNumbers: [], catalogNumbers: [], barcodes: [], confidence: 0 },
        { extractedText: [], identifiedLabels: [], matrixNumbers: [], catalogNumbers: [], barcodes: [], confidence: 0 },
      ]
      const pressing = await identifyPressing(results, {})
      return {
        passed: Array.isArray(pressing) && pressing.length >= 0,
        message: `Returned ${pressing.length} candidates from empty data`,
        details: pressing
      }
    })

    updateCategory('imageAnalysis', { running: false })
    toast.success('Image Analysis tests completed')
  }

  const runPressingIdentificationTests = async () => {
    updateCategory('pressingIdentification', { running: true, tests: [] })

    await runTest('pressingIdentification', 'No image analysis data', async () => {
      const result = await advancedIdentifyPressing({
        imageAnalysis: [],
        discogsSearchEnabled: false
      })
      return {
        passed: Array.isArray(result) && result.length >= 0,
        message: `Handled no data gracefully, returned ${result.length} candidates`,
        details: result
      }
    })

    await runTest('pressingIdentification', 'Empty manual hints', async () => {
      const result = await advancedIdentifyPressing({
        manualHints: {
          artist: '',
          title: '',
          catalogNumber: '',
          country: '',
          year: undefined,
        },
        discogsSearchEnabled: false
      })
      return {
        passed: Array.isArray(result),
        message: 'Handled empty hints without crashing',
        details: result
      }
    })

    await runTest('pressingIdentification', 'Undefined manualHints fields', async () => {
      const result = await advancedIdentifyPressing({
        manualHints: {
          artist: undefined,
          title: undefined,
        },
        discogsSearchEnabled: false
      })
      return {
        passed: Array.isArray(result),
        message: 'Handled undefined hint fields',
        details: result
      }
    })

    await runTest('pressingIdentification', 'Whitespace-only strings', async () => {
      const result = await advancedIdentifyPressing({
        manualHints: {
          artist: '   ',
          title: '\t\n',
          catalogNumber: '  \t  ',
        },
        ocrRunoutValues: ['', '  ', '\n'],
        discogsSearchEnabled: false
      })
      return {
        passed: Array.isArray(result),
        message: 'Handled whitespace-only strings',
        details: result
      }
    })

    await runTest('pressingIdentification', 'Very long strings (stress test)', async () => {
      const longString = 'A'.repeat(10000)
      const result = await advancedIdentifyPressing({
        manualHints: {
          artist: longString,
          title: longString,
        },
        discogsSearchEnabled: false
      })
      return {
        passed: Array.isArray(result),
        message: 'Handled extremely long input strings',
        details: { candidateCount: result.length }
      }
    })

    await runTest('pressingIdentification', 'Missing Discogs token when enabled', async () => {
      const result = await advancedIdentifyPressing({
        manualHints: { artist: 'Beatles' },
        discogsSearchEnabled: true,
        discogsApiToken: undefined
      })
      return {
        passed: Array.isArray(result),
        message: 'Gracefully fell back when Discogs enabled but token missing',
        details: result
      }
    })

    updateCategory('pressingIdentification', { running: false })
    toast.success('Pressing Identification tests completed')
  }

  const runConditionGradingTests = async () => {
    updateCategory('conditionGrading', { running: true, tests: [] })

    await runTest('conditionGrading', 'Empty image array', async () => {
      const result = await analyzeConditionFromImages([])
      return {
        passed: result.confidence === 0 && result.defects.length === 0,
        message: result.confidence === 0 ? 'Correctly handled no images' : 'Failed on empty array',
        details: result
      }
    })

    await runTest('conditionGrading', 'Images with missing dataUrl', async () => {
      const images: ItemImage[] = [
        {
          id: 'test1',
          itemId: 'test',
          type: 'front_cover',
          dataUrl: '',
          mimeType: 'image/jpeg',
          uploadedAt: new Date().toISOString()
        }
      ]
      const result = await analyzeConditionFromImages(images)
      return {
        passed: result.confidence >= 0 && Array.isArray(result.defects),
        message: 'Handled missing dataUrl',
        details: result
      }
    })

    await runTest('conditionGrading', 'Images with invalid types', async () => {
      const images: ItemImage[] = [
        {
          id: 'test1',
          itemId: 'test',
          type: 'invalid_type' as unknown as ItemImage['type'],
          dataUrl: 'data:image/png;base64,test',
          mimeType: 'image/jpeg',
          uploadedAt: new Date().toISOString()
        }
      ]
      const result = await analyzeConditionFromImages(images)
      return {
        passed: result.confidence >= 0,
        message: 'Handled invalid image type',
        details: result
      }
    })

    await runTest('conditionGrading', 'Null/undefined image properties', async () => {
      const images: ItemImage[] = [
        {
          id: 'test1',
          itemId: 'test',
          type: 'front_cover',
          dataUrl: undefined as unknown as string,
          mimeType: undefined as unknown as string,
          uploadedAt: new Date().toISOString()
        }
      ]
      try {
        const result = await analyzeConditionFromImages(images)
        return {
          passed: true,
          message: 'Handled undefined properties without crashing',
          details: result
        }
      } catch (error: unknown) {
        return {
          passed: false,
          message: `Should not crash: ${error instanceof Error ? error.message : String(error)}`,
          details: error
        }
      }
    })

    updateCategory('conditionGrading', { running: false })
    toast.success('Condition Grading tests completed')
  }

  const runListingGenerationTests = async () => {
    updateCategory('listingGeneration', { running: true, tests: [] })

    await runTest('listingGeneration', 'Item with all empty strings', async () => {
      const item = createTestItem({
        artistName: '',
        releaseTitle: '',
        catalogNumber: '',
        country: '',
      })
      const keywords = await generateSEOKeywords(item, 'ebay')
      return {
        passed: Array.isArray(keywords),
        message: `Generated ${keywords.length} keywords from empty data`,
        details: keywords
      }
    })

    await runTest('listingGeneration', 'Item with undefined fields', async () => {
      const item = createTestItem({
        catalogNumber: undefined,
        condition: {
          ...createTestItem().condition,
          gradingNotes: undefined,
        }
      })
      const copy = await generateListingCopy(item, 'ebay', [])
      return {
        passed: typeof copy.title === 'string' && typeof copy.description === 'string',
        message: 'Generated listing copy with undefined fields',
        details: { titleLength: copy.title.length, descLength: copy.description.length }
      }
    })

    await runTest('listingGeneration', 'Item with null values', async () => {
      const item = createTestItem({
        catalogNumber: null as unknown as string,
        notes: null as unknown as string,
      })
      try {
        const copy = await generateListingCopy(item, 'ebay', [])
        return {
          passed: Boolean(copy.title && copy.description),
          message: 'Handled null values in item',
          details: copy
        }
      } catch (error: unknown) {
        return {
          passed: false,
          message: `Should handle nulls: ${error instanceof Error ? error.message : String(error)}`,
          details: error
        }
      }
    })

    await runTest('listingGeneration', 'Empty keywords array', async () => {
      const item = createTestItem()
      const copy = await generateListingCopy(item, 'ebay', [])
      return {
        passed: copy.title.length > 0 && copy.description.length > 0,
        message: 'Generated copy with empty keywords',
        details: { title: copy.title.substring(0, 50) + '...' }
      }
    })

    await runTest('listingGeneration', 'Year as 0 or negative', async () => {
      const item = createTestItem({ year: 0 })
      const keywords = await generateSEOKeywords(item, 'ebay')
      return {
        passed: Array.isArray(keywords),
        message: 'Handled year=0 without error',
        details: keywords.slice(0, 5)
      }
    })

    await runTest('listingGeneration', 'Very long artist/title names', async () => {
      const item = createTestItem({
        artistName: 'A'.repeat(500),
        releaseTitle: 'B'.repeat(500)
      })
      const copy = await generateListingCopy(item, 'ebay', [])
      return {
        passed: copy.title.length <= 80,
        message: `Title length: ${copy.title.length} (max 80)`,
        details: { title: copy.title }
      }
    })

    await runTest('listingGeneration', 'Special characters in fields', async () => {
      const item = createTestItem({
        artistName: 'Artist™®©',
        releaseTitle: 'Title & Symbols: @#$%',
        catalogNumber: 'CAT/123\\456'
      })
      const copy = await generateListingCopy(item, 'ebay', [])
      return {
        passed: copy.title.length > 0 && copy.description.length > 0,
        message: 'Handled special characters',
        details: { title: copy.title }
      }
    })

    await runTest('listingGeneration', 'Unicode/emoji in fields', async () => {
      const item = createTestItem({
        artistName: 'Björk 🎵',
        releaseTitle: 'Über Album 日本'
      })
      const copy = await generateListingCopy(item, 'ebay', [])
      return {
        passed: copy.title.length > 0,
        message: 'Handled Unicode/emoji',
        details: { title: copy.title }
      }
    })

    updateCategory('listingGeneration', { running: false })
    toast.success('Listing Generation tests completed')
  }

  const runBargainDetectionTests = async () => {
    updateCategory('bargainDetection', { running: true, tests: [] })

    await runTest('bargainDetection', 'Empty listing data', async () => {
      const listing: MarketListing = {
        id: 'test-1',
        source: 'ebay',
        externalId: 'ext-1',
        title: '',
        price: 0,
        currency: 'GBP',
        url: '',
        seller: 'test-seller',
        listedAt: new Date().toISOString()
      }
      const result = await analyzeBargainPotential({ listing })
      return {
        passed: result.bargainScore >= 0 && Array.isArray(result.signals),
        message: `Score: ${result.bargainScore}, Signals: ${result.signals.length}`,
        details: result
      }
    })

    await runTest('bargainDetection', 'Negative price', async () => {
      const listing: MarketListing = {
        id: 'test-2',
        source: 'ebay',
        externalId: 'ext-2',
        title: 'Beatles - Abbey Road',
        price: -10,
        currency: 'GBP',
        url: 'https://example.com',
        seller: 'test-seller',
        listedAt: new Date().toISOString()
      }
      const result = await analyzeBargainPotential({ listing })
      return {
        passed: result.bargainScore >= 0,
        message: 'Handled negative price',
        details: result
      }
    })

    await runTest('bargainDetection', 'Zero price', async () => {
      const listing: MarketListing = {
        id: 'test-3',
        source: 'ebay',
        externalId: 'ext-3',
        title: 'Pink Floyd - Dark Side',
        price: 0,
        currency: 'GBP',
        url: 'https://example.com',
        seller: 'test-seller',
        listedAt: new Date().toISOString()
      }
      const result = await analyzeBargainPotential({ listing })
      return {
        passed: typeof result.bargainScore === 'number',
        message: 'Handled zero price',
        details: result
      }
    })

    await runTest('bargainDetection', 'Missing currency', async () => {
      const listing: MarketListing = {
        id: 'test-4',
        source: 'ebay',
        externalId: 'ext-4',
        title: 'Led Zeppelin IV',
        price: 25,
        currency: '',
        url: 'https://example.com',
        seller: 'test-seller',
        listedAt: new Date().toISOString()
      }
      try {
        const result = await analyzeBargainPotential({ listing })
        return {
          passed: true,
          message: 'Handled missing currency',
          details: result
        }
      } catch (error: unknown) {
        return {
          passed: false,
          message: `Should not crash: ${error instanceof Error ? error.message : String(error)}`,
          details: error
        }
      }
    })

    await runTest('bargainDetection', 'Disabled agent config', async () => {
      const listing: MarketListing = {
        id: 'test-5',
        source: 'ebay',
        externalId: 'ext-5',
        title: 'David Bowie - Low',
        price: 30,
        currency: 'GBP',
        url: 'https://example.com',
        seller: 'test-seller',
        listedAt: new Date().toISOString()
      }
      const result = await analyzeBargainPotential({
        listing,
        agentConfig: {
          enabled: false,
          name: 'Test Agent',
          aiPlatform: 'spark',
          bargainDetection: {
            enabled: false,
            minScore: 0,
            signals: {
              titleMismatch: false,
              lowPrice: false,
              wrongCategory: false,
              jobLot: false,
              promoKeywords: false,
              poorMetadata: false,
            }
          },
          priceAnalysis: { enabled: false, useDiscogsData: false, useEbayData: false, priceVarianceThreshold: 0 },
          releaseMatching: { enabled: false, minConfidence: 0, autoAcceptHighConfidence: false, highConfidenceThreshold: 0.85 },
          advancedSettings: { temperature: 0.7, maxTokens: 1500, retryAttempts: 2, timeoutSeconds: 30 }
        }
      })
      return {
        passed: result.bargainScore === 0 && result.signals.length === 0,
        message: 'Respected disabled agent config',
        details: result
      }
    })

    updateCategory('bargainDetection', { running: false })
    toast.success('Bargain Detection tests completed')
  }

  const runAllTests = async () => {
    toast.info('Starting comprehensive AI edge case tests...')
    await runImageAnalysisTests()
    await runPressingIdentificationTests()
    await runConditionGradingTests()
    await runListingGenerationTests()
    await runBargainDetectionTests()
    toast.success('All tests completed!')
  }

  const getResultIcon = (passed: boolean) => {
    return passed ? 
      <CheckCircle className="text-green-500" weight="fill" /> : 
      <XCircle className="text-red-500" weight="fill" />
  }

  const getOverallStats = (category: TestCategory) => {
    const passed = category.tests.filter(t => t.passed).length
    const total = category.tests.length
    const percentage = total > 0 ? Math.round((passed / total) * 100) : 0
    return { passed, total, percentage }
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">AI Feature Edge Case Testing</CardTitle>
          <CardDescription>
            Comprehensive testing of all AI-powered features with edge cases like missing data, empty strings, null values, and invalid inputs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Button onClick={runAllTests} size="lg">
              <Play className="mr-2" />
              Run All Tests
            </Button>
            <Button onClick={runImageAnalysisTests} variant="outline">
              Test Image Analysis
            </Button>
            <Button onClick={runPressingIdentificationTests} variant="outline">
              Test Pressing ID
            </Button>
            <Button onClick={runConditionGradingTests} variant="outline">
              Test Condition Grading
            </Button>
            <Button onClick={runListingGenerationTests} variant="outline">
              Test Listing Gen
            </Button>
            <Button onClick={runBargainDetectionTests} variant="outline">
              Test Bargain Detection
            </Button>
          </div>

          <Tabs defaultValue="imageAnalysis" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              {Object.entries(categories).map(([key, category]) => {
                const stats = getOverallStats(category)
                return (
                  <TabsTrigger key={key} value={key} className="relative">
                    {category.name}
                    {category.running && <Spinner className="ml-2 h-4 w-4 animate-spin" />}
                    {stats.total > 0 && (
                      <Badge 
                        variant={stats.percentage === 100 ? "default" : stats.percentage >= 50 ? "secondary" : "destructive"}
                        className="ml-2"
                      >
                        {stats.passed}/{stats.total}
                      </Badge>
                    )}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {Object.entries(categories).map(([key, category]) => {
              const stats = getOverallStats(category)
              return (
                <TabsContent key={key} value={key} className="mt-4">
                  {stats.total > 0 && (
                    <Alert className="mb-4">
                      <Warning className="h-4 w-4" />
                      <AlertDescription>
                        <strong>{category.name} Summary:</strong> {stats.passed} of {stats.total} tests passed ({stats.percentage}%)
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <ScrollArea className="h-[600px] w-full rounded-md border p-4">
                    {category.tests.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Warning className="h-12 w-12 mb-2" />
                        <p>No tests run yet. Click a test button to start.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {category.tests.map((test, idx) => (
                          <Card key={idx}>
                            <CardHeader>
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3 flex-1">
                                  {getResultIcon(test.passed)}
                                  <div className="flex-1">
                                    <CardTitle className="text-base">{test.testName}</CardTitle>
                                    <CardDescription className="mt-1">
                                      {test.message}
                                    </CardDescription>
                                    <div className="mt-2 text-xs text-muted-foreground">
                                      Duration: {test.duration.toFixed(2)}ms
                                    </div>
                                  </div>
                                </div>
                                <Badge variant={test.passed ? "default" : "destructive"}>
                                  {test.passed ? "PASS" : "FAIL"}
                                </Badge>
                              </div>
                            </CardHeader>
                            {test.details !== undefined && (
                              <CardContent>
                                <Separator className="mb-3" />
                                <div className="text-xs">
                                  <strong>Details:</strong>
                                  <pre className="mt-2 p-3 bg-muted rounded-md overflow-x-auto">
                                    {JSON.stringify(test.details, null, 2)}
                                  </pre>
                                </div>
                              </CardContent>
                            )}
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
