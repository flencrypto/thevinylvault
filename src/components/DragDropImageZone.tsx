import { useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Upload, Image as ImageIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface DragDropImageZoneProps {
  onFilesSelected: (files: File[]) => void
  maxFiles?: number
  currentFileCount?: number
  disabled?: boolean
  accept?: string
  children?: React.ReactNode
  className?: string
  showUploadPrompt?: boolean
}

export function DragDropImageZone({
  onFilesSelected,
  maxFiles = 10,
  currentFileCount = 0,
  disabled = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  accept: _accept = 'image/*',
  children,
  className,
  showUploadPrompt = true
}: DragDropImageZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    const remainingSlots = maxFiles - currentFileCount
    const filesToProcess = imageFiles.slice(0, remainingSlots)

    if (filesToProcess.length > 0) {
      onFilesSelected(filesToProcess)
    }
  }, [disabled, maxFiles, currentFileCount, onFilesSelected])

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        'relative transition-all',
        className
      )}
    >
      {children}
      
      {isDragging && !disabled && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          <Card className={cn(
            'absolute inset-0 border-4 border-dashed border-accent bg-accent/10 backdrop-blur-sm',
            'flex items-center justify-center'
          )}>
            <div className="text-center space-y-4 pointer-events-none">
              <div className="w-20 h-20 mx-auto bg-accent/20 rounded-full flex items-center justify-center">
                <Upload size={40} weight="fill" className="text-accent" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-accent">Drop images here</h3>
                <p className="text-sm text-muted-foreground">
                  {maxFiles - currentFileCount} slot{maxFiles - currentFileCount !== 1 ? 's' : ''} available
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {showUploadPrompt && !children && (
        <Card className="border-2 border-dashed border-border hover:border-accent/50 transition-colors">
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
              <ImageIcon size={32} className="text-muted-foreground" weight="thin" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Drag & drop images here</h3>
            <p className="text-sm text-muted-foreground">
              or use the buttons below to upload
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
