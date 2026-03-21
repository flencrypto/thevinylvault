import { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Barcode, CheckCircle, Warning, Camera, Upload } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export interface BarcodeScanResult {
  barcode: string
  artist: string
  title: string
  year: number
  format: string
  label: string
  country: string
  catalogNumber?: string
  imageUrl?: string
  confidence: number
}

interface BarcodeScannerWidgetProps {
  onScanComplete?: (result: BarcodeScanResult) => void
  variant?: 'compact' | 'card' | 'fab'
}

export default function BarcodeScannerWidget({ onScanComplete, variant = 'card' }: BarcodeScannerWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [scanMode, setScanMode] = useState<'camera' | 'manual' | null>(null)
  const [manualBarcode, setManualBarcode] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<BarcodeScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const startCameraMode = async () => {
    setScanMode('camera')
    setError(null)
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      })
      
      streamRef.current = stream
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch {
      setError('Camera access denied. Please enable camera permissions.')
      toast.error('Camera access denied')
      setScanMode('manual')
    }
  }

  const captureAndScan = async () => {
    if (!videoRef.current) return

    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    const imageData = canvas.toDataURL('image/jpeg', 0.95)

    setIsScanning(true)
    try {
      const barcode = await detectBarcodeFromImage(imageData)
      if (barcode) {
        await performBarcodeSearch(barcode)
      } else {
        toast.error('No barcode detected. Try again or enter manually.')
      }
    } catch {
      toast.error('Failed to scan barcode')
    } finally {
      setIsScanning(false)
    }
  }

  const detectBarcodeFromImage = async (imageData: string): Promise<string | null> => {
    const prompt = spark.llmPrompt`You are a barcode detection system. Analyze this image and extract any UPC, EAN, or barcode visible on a vinyl record, CD, or music product packaging.

Image: ${imageData}

Look for:
- UPC barcodes (12 digits)
- EAN barcodes (13 digits)
- Any numeric codes near barcode symbols
- Catalog numbers that might help identify the release

Return ONLY the barcode number as a plain string with no additional text. If no barcode is found, return "NOT_FOUND".`

    try {
      const result = await spark.llm(prompt, 'gpt-4o', false)
      const cleaned = result.trim().replace(/[^0-9]/g, '')
      
      if (cleaned && cleaned.length >= 10 && cleaned !== 'NOT_FOUND') {
        return cleaned
      }
      return null
    } catch {
      return null
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const imageData = event.target?.result as string
      setIsScanning(true)
      
      try {
        const barcode = await detectBarcodeFromImage(imageData)
        if (barcode) {
          await performBarcodeSearch(barcode)
        } else {
          toast.error('No barcode detected in image')
        }
      } catch {
        toast.error('Failed to process image')
      } finally {
        setIsScanning(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const performBarcodeSearch = async (barcode: string) => {
    setIsScanning(true)
    setError(null)

    try {
      const result = await lookupBarcodeAI(barcode)
      
      if (result) {
        setScanResult(result)
        stopCamera()
        toast.success('Barcode found!')
        
        if (onScanComplete) {
          onScanComplete(result)
        }
      } else {
        setError('Barcode not found in database. Try manual entry.')
        toast.error('Barcode not recognized')
      }
    } catch {
      setError('Search failed. Please try again.')
      toast.error('Barcode lookup failed')
    } finally {
      setIsScanning(false)
    }
  }

  const lookupBarcodeAI = async (barcode: string): Promise<BarcodeScanResult | null> => {
    const prompt = spark.llmPrompt`You are a vinyl record and music product barcode lookup assistant. Given a barcode (UPC/EAN), identify the music release.

Barcode: ${barcode}

Search your knowledge base for this barcode and identify the corresponding vinyl record, CD, or music release. Return detailed information in JSON format.

If the barcode matches a known release, return:
{
  "found": true,
  "barcode": "${barcode}",
  "artist": "Artist name",
  "title": "Album or release title",
  "year": 2023,
  "format": "LP|12\"|7\"|CD|Cassette",
  "label": "Record label name",
  "country": "Country code (US, UK, etc)",
  "catalogNumber": "Catalog number if known",
  "confidence": 0.95
}

If the barcode is NOT found or cannot be identified:
{
  "found": false,
  "barcode": "${barcode}",
  "confidence": 0
}

Return ONLY valid JSON with no additional explanation.`

    try {
      const response = await spark.llm(prompt, 'gpt-4o', true)
      const data = JSON.parse(response)
      
      if (!data.found) {
        return null
      }
      
      return {
        barcode: data.barcode,
        artist: data.artist,
        title: data.title,
        year: data.year,
        format: data.format,
        label: data.label,
        country: data.country,
        catalogNumber: data.catalogNumber,
        confidence: data.confidence
      }
    } catch (error) {
      console.error('Barcode lookup failed:', error)
      return null
    }
  }

  const handleManualSubmit = () => {
    if (manualBarcode.length < 10) {
      toast.error('Please enter a valid barcode (10+ digits)')
      return
    }
    
    performBarcodeSearch(manualBarcode)
  }

  const handleClose = () => {
    setIsOpen(false)
    setScanMode(null)
    setScanResult(null)
    setError(null)
    setManualBarcode('')
    stopCamera()
  }

  const handleUseResult = () => {
    handleClose()
  }

  if (variant === 'fab') {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-4 z-40 w-14 h-14 bg-accent text-accent-foreground rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
          aria-label="Scan barcode"
        >
          <Barcode className="w-6 h-6" weight="bold" />
        </button>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle>Quick Barcode Scan</DialogTitle>
            </DialogHeader>
            {renderDialogContent()}
          </DialogContent>
        </Dialog>
      </>
    )
  }

  if (variant === 'compact') {
    return (
      <>
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Barcode className="w-4 h-4" />
          Scan
        </Button>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle>Quick Barcode Scan</DialogTitle>
            </DialogHeader>
            {renderDialogContent()}
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <>
      <Card 
        className="p-4 bg-card border-border hover:border-accent/50 cursor-pointer transition-all active:scale-[0.98]"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
            <Barcode className="w-6 h-6 text-accent" weight="bold" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Quick Scan</h3>
            <p className="text-xs text-muted-foreground">Scan vinyl barcode</p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">UPC/EAN</Badge>
        </div>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Quick Barcode Scan</DialogTitle>
          </DialogHeader>
          {renderDialogContent()}
        </DialogContent>
      </Dialog>
    </>
  )

  function renderDialogContent() {
    if (scanResult) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-500">
            <CheckCircle className="w-5 h-5" weight="fill" />
            <span className="font-medium">Found!</span>
          </div>

          {scanResult.imageUrl && (
            <img 
              src={scanResult.imageUrl} 
              alt={scanResult.title}
              className="w-full h-48 object-cover rounded-lg"
            />
          )}

          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground">Artist</div>
              <div className="font-semibold">{scanResult.artist}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Title</div>
              <div className="font-semibold">{scanResult.title}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Year</div>
                <div className="font-mono text-sm">{scanResult.year}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Format</div>
                <div className="font-mono text-sm">{scanResult.format}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Country</div>
                <div className="text-sm">{scanResult.country}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Label</div>
                <div className="text-sm">{scanResult.label}</div>
              </div>
            </div>
            {scanResult.catalogNumber && (
              <div>
                <div className="text-xs text-muted-foreground">Catalog #</div>
                <div className="font-mono text-sm">{scanResult.catalogNumber}</div>
              </div>
            )}
            <div>
              <div className="text-xs text-muted-foreground">Barcode</div>
              <div className="font-mono text-sm">{scanResult.barcode}</div>
            </div>
          </div>

          <Separator />

          <div className="flex gap-2">
            <Button onClick={handleClose} variant="outline" className="flex-1">
              Close
            </Button>
            <Button onClick={handleUseResult} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90">
              Use This Data
            </Button>
          </div>
        </div>
      )
    }

    if (!scanMode) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Choose how to scan the barcode:</p>
          
          <Button
            onClick={startCameraMode}
            className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
            size="lg"
          >
            <Camera className="w-5 h-5" weight="bold" />
            Use Camera
          </Button>

          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="w-full gap-2"
            size="lg"
          >
            <Upload className="w-5 h-5" />
            Upload Photo
          </Button>

          <Button
            onClick={() => setScanMode('manual')}
            variant="outline"
            className="w-full gap-2"
            size="lg"
          >
            <Barcode className="w-5 h-5" />
            Enter Manually
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>
      )
    }

    if (scanMode === 'camera') {
      return (
        <div className="space-y-4">
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 border-2 border-accent/50 rounded-lg pointer-events-none">
              <div className="absolute inset-8 border border-accent/70 rounded-lg" />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <Warning className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => {
                stopCamera()
                setScanMode(null)
              }}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={captureAndScan}
              disabled={isScanning}
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isScanning ? 'Scanning...' : 'Capture & Scan'}
            </Button>
          </div>
        </div>
      )
    }

    if (scanMode === 'manual') {
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Barcode Number</label>
            <input
              type="text"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Enter 10-13 digit barcode"
              className="w-full px-3 py-2 bg-background border border-input rounded-md font-mono"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              Usually found on the back cover or spine
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <Warning className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => setScanMode(null)}
              variant="outline"
              className="flex-1"
            >
              Back
            </Button>
            <Button
              onClick={handleManualSubmit}
              disabled={isScanning || manualBarcode.length < 10}
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isScanning ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </div>
      )
    }

    return null
  }
}
