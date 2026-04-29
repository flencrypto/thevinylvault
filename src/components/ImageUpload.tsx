import { useState, useRef } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ImageType, ItemImage } from '@/lib/types'
import { Camera, Trash, Image as ImageIcon, CloudArrowUp, CheckCircle, Sparkle, CircleNotch } from '@phosphor-icons/react'
import { uploadImageToImgBB } from '@/lib/imgbb-service'
import { classifyImage } from '@/lib/openai-vision-service'
import { useConfidenceThresholds } from '@/hooks/use-confidence-thresholds'
import { toast } from 'sonner'
import { DragDropImageZone } from '@/components/DragDropImageZone'

interface ImageUploadProps {
  images: ItemImage[]
  onImagesChange: (images: ItemImage[]) => void
  maxImages?: number
  autoUploadToImgBB?: boolean
  autoDetectType?: boolean
}

export function ImageUpload({ images, onImagesChange, maxImages = 10, autoUploadToImgBB = false, autoDetectType = true }: ImageUploadProps) {
  const [selectedType, setSelectedType] = useState<ImageType>('front_cover')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [apiKeys] = useKV<{ imgbbKey?: string, openaiKey?: string }>('vinyl-vault-api-keys', {})
  const [uploadingImages, setUploadingImages] = useState<Set<string>>(new Set())
  const [detectingTypes, setDetectingTypes] = useState<Set<string>>(new Set())
  const { checkConfidence, getThreshold } = useConfidenceThresholds()

  // Keep a ref to the latest images so async callbacks (auto-detect, imgBB upload)
  // never operate on a stale closure and accidentally drop newly-added images
  // or a sibling's just-applied imgBB metadata. Sync during render so a
  // parent-driven `images` update is visible to event handlers immediately —
  // a useEffect-only sync would leave a post-commit gap where handlers could
  // still read the previous value and write back stale state.
  const imagesRef = useRef(images)
  imagesRef.current = images

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (imagesRef.current.length >= maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`)
      return
    }

    const newImages: ItemImage[] = []

    for (let i = 0; i < files.length && imagesRef.current.length + newImages.length < maxImages; i++) {
      const file = files[i]
      
      if (!file.type.startsWith('image/')) continue

      const dataUrl = await fileToDataUrl(file)
      
      const newImage: ItemImage = {
        id: `img-${Date.now()}-${i}`,
        type: selectedType,
        dataUrl,
        mimeType: file.type,
        uploadedAt: new Date().toISOString()
      }

      newImages.push(newImage)
    }

    // Read from imagesRef.current rather than the prop snapshot — `fileToDataUrl`
    // is awaited above, so any in-flight async update (imgBB upload / type
    // detection) may have already written newer state we must not clobber.
    const updatedImages = [...imagesRef.current, ...newImages]
    imagesRef.current = updatedImages
    onImagesChange(updatedImages)

    if (autoDetectType && apiKeys?.openaiKey) {
      for (const img of newImages) {
        detectImageType(img)
      }
    }

    if (autoUploadToImgBB && apiKeys?.imgbbKey) {
      for (const img of newImages) {
        await uploadToImgBB(img)
      }
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCameraCapture = () => {
    if (images.length >= maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`)
      return
    }
    cameraInputRef.current?.click()
  }

  const handleFilesDropped = async (files: File[]) => {
    const fakeEvent = {
      target: {
        files: files
      }
    } as unknown as React.ChangeEvent<HTMLInputElement>
    
    await handleFileSelect(fakeEvent)
  }

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const detectImageType = async (image: ItemImage) => {
    if (!autoDetectType) return

    setDetectingTypes(prev => new Set(prev).add(image.id))

    try {
      const result = await classifyImage(image.dataUrl)
      const meetsThreshold = checkConfidence('imageClassification', result.confidence)
      
      if (meetsThreshold) {
        const next = imagesRef.current.map(img =>
          img.id === image.id
            ? { ...img, type: result.imageType as ImageType }
            : img
        )
        imagesRef.current = next
        onImagesChange(next)
        toast.success(`Auto-detected: ${result.imageType.replace(/_/g, ' ')}`, {
          description: `${Math.round(result.confidence * 100)}% confidence - ${result.reasoning}`
        })
      } else {
        const threshold = getThreshold('imageClassification')
        toast.warning(`Low confidence: ${result.imageType.replace(/_/g, ' ')}`, {
          description: `${Math.round(result.confidence * 100)}% (threshold: ${threshold}%) - type unchanged, please verify manually`
        })
      }
    } catch (error) {
      console.error('Image type detection failed:', error)
      toast.error('Auto-detection failed', {
        description: error instanceof Error ? error.message : 'Please select image type manually'
      })
    } finally {
      setDetectingTypes(prev => {
        const next = new Set(prev)
        next.delete(image.id)
        return next
      })
    }
  }

  const handleRemoveImage = (imageId: string) => {
    const next = imagesRef.current.filter(img => img.id !== imageId)
    imagesRef.current = next
    onImagesChange(next)
  }

  const handleTypeChange = (imageId: string, newType: ImageType) => {
    const next = imagesRef.current.map(img => img.id === imageId ? { ...img, type: newType } : img)
    imagesRef.current = next
    onImagesChange(next)
  }

  const uploadToImgBB = async (image: ItemImage) => {
    const imgbbKey = apiKeys?.imgbbKey
    if (!imgbbKey) {
      toast.error('imgBB API key not configured', {
        description: 'Please add your imgBB API key in Settings'
      })
      return
    }

    if (image.imgbbUrl) {
      toast.info('Image already uploaded to imgBB')
      return
    }

    setUploadingImages(prev => new Set(prev).add(image.id))

    try {
      const uploaded = await uploadImageToImgBB(image.dataUrl, imgbbKey, `vinyl-${image.type}`)
      
      const next = imagesRef.current.map(img =>
        img.id === image.id 
          ? {
              ...img,
              imgbbUrl: uploaded.url,
              imgbbDisplayUrl: uploaded.displayUrl,
              imgbbThumbUrl: uploaded.thumbUrl,
              imgbbDeleteUrl: uploaded.deleteUrl
            }
          : img
      )
      imagesRef.current = next
      onImagesChange(next)

      toast.success('Image uploaded to imgBB', {
        description: 'Image URL ready for eBay listings'
      })
    } catch (error) {
      toast.error('Failed to upload to imgBB', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setUploadingImages(prev => {
        const next = new Set(prev)
        next.delete(image.id)
        return next
      })
    }
  }

  const uploadAllToImgBB = async () => {
    const imgbbKey = apiKeys?.imgbbKey
    if (!imgbbKey) {
      toast.error('imgBB API key not configured', {
        description: 'Please add your imgBB API key in Settings'
      })
      return
    }

    const unuploadedImages = images.filter(img => !img.imgbbUrl)
    if (unuploadedImages.length === 0) {
      toast.info('All images already uploaded')
      return
    }

    toast.info(`Uploading ${unuploadedImages.length} images...`)

    for (const img of unuploadedImages) {
      await uploadToImgBB(img)
    }
  }

  const batchAutoDetectAll = async () => {
    if (images.length === 0) {
      toast.info('No images to classify')
      return
    }

    toast.info(`Auto-detecting types for ${images.length} image${images.length > 1 ? 's' : ''}...`)

    let successCount = 0
    let failCount = 0
    const detectedTypes = new Map<string, ImageType>()
    const targetImages = images

    for (let i = 0; i < targetImages.length; i++) {
      const img = targetImages[i]
      setDetectingTypes(prev => new Set(prev).add(img.id))

      try {
        const result = await classifyImage(img.dataUrl)

        detectedTypes.set(img.id, result.imageType as ImageType)
        successCount++
      } catch (error) {
        console.error(`Image type detection failed for ${img.id}:`, error)
        failCount++
      } finally {
        setDetectingTypes(prev => {
          const next = new Set(prev)
          next.delete(img.id)
          return next
        })
      }
    }

    // Merge detected types into the LATEST images array so we don't drop
    // images added during processing or wipe imgBB metadata applied in parallel.
    const next = imagesRef.current.map(img =>
      detectedTypes.has(img.id)
        ? { ...img, type: detectedTypes.get(img.id)! }
        : img
    )
    imagesRef.current = next
    onImagesChange(next)

    if (successCount > 0) {
      toast.success(`Auto-detected ${successCount} image${successCount > 1 ? 's' : ''}`, {
        description: failCount > 0 ? `${failCount} failed - please verify manually. Check confidence scores.` : 'Review and adjust if needed'
      })
    } else {
      toast.error('Auto-detection failed for all images', {
        description: 'Please select image types manually'
      })
    }
  }

  return (
    <DragDropImageZone 
      onFilesSelected={handleFilesDropped}
      maxFiles={maxImages}
      currentFileCount={images.length}
      showUploadPrompt={false}
      className="space-y-4"
    >
      <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        {!autoDetectType && (
          <div className="flex-1 min-w-[200px] space-y-2">
            <Label>Image Type (for manual uploads)</Label>
            <Select value={selectedType} onValueChange={(value: ImageType) => setSelectedType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="front_cover">Front Cover</SelectItem>
                <SelectItem value="back_cover">Back Cover</SelectItem>
                <SelectItem value="label">Label</SelectItem>
                <SelectItem value="runout">Runout / Matrix</SelectItem>
                <SelectItem value="insert">Insert</SelectItem>
                <SelectItem value="spine">Spine</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <Button
          type="button"
          variant="default"
          onClick={handleCameraCapture}
          disabled={images.length >= maxImages}
          className="gap-2"
        >
          <Camera size={18} weight="fill" />
          Take Photo
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= maxImages}
          className="gap-2"
        >
          <ImageIcon size={18} />
          Choose Files
        </Button>
        {images.length > 0 && autoDetectType && (
          <Button
            type="button"
            variant="secondary"
            onClick={batchAutoDetectAll}
            disabled={detectingTypes.size > 0}
            className="gap-2"
          >
            <Sparkle size={18} weight="fill" />
            Auto-Detect All Types
          </Button>
        )}
        {images.length > 0 && apiKeys?.imgbbKey && (
          <Button
            type="button"
            onClick={uploadAllToImgBB}
            disabled={images.every(img => img.imgbbUrl)}
            className="gap-2 bg-accent hover:bg-accent/90"
          >
            <CloudArrowUp size={18} />
            Upload All to imgBB
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((image) => (
            <Card key={image.id} className="relative group overflow-hidden">
              <div className="aspect-square bg-muted relative">
                <img
                  src={image.dataUrl}
                  alt={image.type}
                  className="w-full h-full object-cover"
                />
                {image.imgbbUrl && !detectingTypes.has(image.id) && (
                  <Badge className="absolute top-2 right-2 bg-green-600 text-white gap-1">
                    <CheckCircle size={14} weight="fill" />
                    Hosted
                  </Badge>
                )}
                {detectingTypes.has(image.id) && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-white text-sm flex flex-col items-center gap-2">
                      <CircleNotch size={24} className="animate-spin" weight="bold" />
                      <span>Detecting type...</span>
                    </div>
                  </div>
                )}
                {uploadingImages.has(image.id) && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-white text-sm flex items-center gap-2">
                      <CloudArrowUp size={20} className="animate-pulse" />
                      Uploading...
                    </div>
                  </div>
                )}
              </div>
              <div className="p-3 space-y-2">
                <Select
                  value={image.type}
                  onValueChange={(value: ImageType) => handleTypeChange(image.id, value)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="front_cover">Front Cover</SelectItem>
                    <SelectItem value="back_cover">Back Cover</SelectItem>
                    <SelectItem value="label">Label</SelectItem>
                    <SelectItem value="runout">Runout / Matrix</SelectItem>
                    <SelectItem value="insert">Insert</SelectItem>
                    <SelectItem value="spine">Spine</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2 flex-wrap">
                  {autoDetectType && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => detectImageType(image)}
                      disabled={detectingTypes.has(image.id)}
                      className="flex-1 gap-2 text-xs"
                    >
                      <Sparkle size={14} weight="fill" />
                      Auto-Detect
                    </Button>
                  )}
                  {!image.imgbbUrl && apiKeys?.imgbbKey && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => uploadToImgBB(image)}
                      disabled={uploadingImages.has(image.id)}
                      className="flex-1 gap-2 text-xs"
                    >
                      <CloudArrowUp size={14} />
                      Upload
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveImage(image.id)}
                    className="flex-1 gap-2"
                  >
                    <Trash size={14} />
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <Card className="border-dashed">
          <div className="p-12 text-center">
            <ImageIcon size={48} className="mx-auto mb-4 text-muted-foreground" weight="thin" />
            <p className="text-sm text-muted-foreground">
              No images uploaded yet. Add photos of your vinyl to enable AI identification.
            </p>
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Use "Take Photo" to capture images directly with your camera, or "Choose Files" to upload from your device. Upload up to {maxImages} images. {autoDetectType ? 'AI automatically detects image types when photos are added using pattern matching. Use "Auto-Detect All Types" to classify all images at once. Always verify the detected type. ' : ''}{apiKeys?.imgbbKey ? 'Images can be hosted on imgBB for eBay listings.' : 'Configure imgBB API key in Settings to host images for eBay listings.'}
      </p>
      </div>
    </DragDropImageZone>
  )
}
