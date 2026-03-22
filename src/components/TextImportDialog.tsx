import { useState, useRef, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Sparkle,
  CheckCircle,
  PencilSimple,
  X,
  FileText,
  ClipboardText,
  ArrowRight,
  Check,
  CircleNotch,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { CollectionItem, Format, MediaGrade, SleeveGrade } from '@/lib/types'
import { parseTextToImportItems, ParsedImportItem } from '@/lib/text-import-service'
import { identifyPressing, PressingIdentificationInput } from '@/lib/pressing-identification-ai'

type Step = 'input' | 'parsing' | 'overview' | 'complete'

const FORMAT_OPTIONS: Format[] = ['LP', '7in', '12in', 'EP', 'Boxset']
const GRADE_OPTIONS: MediaGrade[] = ['M', 'NM', 'EX', 'VG+', 'VG', 'G', 'F', 'P']

interface TextImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onItemsAdded: (items: CollectionItem[]) => void
}

function convertToCollectionItem(item: ParsedImportItem): CollectionItem {
  const now = new Date().toISOString()
  return {
    id: item.id,
    collectionId: 'default',
    artistName: item.artistName,
    releaseTitle: item.releaseTitle,
    format: item.format,
    year: item.year,
    country: item.country,
    labelName: item.labelName,
    catalogNumber: item.catalogNumber,
    notes: item.notes,
    purchaseCurrency: 'GBP',
    sourceType: 'unknown',
    quantity: 1,
    status: 'owned',
    condition: {
      mediaGrade: item.mediaGrade,
      sleeveGrade: item.sleeveGrade,
      gradingStandard: 'Goldmine',
      gradedAt: now,
    },
    createdAt: now,
    updatedAt: now,
    acquisitionDate: now,
  }
}

export function TextImportDialog({ open, onOpenChange, onItemsAdded }: TextImportDialogProps) {
  const [apiKeys] = useKV<{ openaiKey?: string }>('vinyl-vault-api-keys', {})

  const [step, setStep] = useState<Step>('input')
  const [rawText, setRawText] = useState('')
  const [items, setItems] = useState<ParsedImportItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [analysingAll, setAnalysingAll] = useState(false)
  const [analysingIds, setAnalysingIds] = useState<Set<string>>(new Set())

  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetDialog = () => {
    setStep('input')
    setRawText('')
    setItems([])
    setEditingId(null)
    setAnalysingAll(false)
    setAnalysingIds(new Set())
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text === 'string') {
        setRawText(text)
        toast.success(`Loaded ${file.name}`)
      }
    }
    reader.readAsText(file)
    // Reset file input so same file can be re-uploaded
    e.target.value = ''
  }

  const handleParse = async () => {
    if (!rawText.trim()) {
      toast.error('Please enter some text or upload a file first')
      return
    }
    setStep('parsing')
    try {
      const parsed = await parseTextToImportItems(rawText)
      setItems(parsed)
      setStep('overview')
      toast.success(`Parsed ${parsed.length} record${parsed.length !== 1 ? 's' : ''}`)
    } catch (err) {
      console.error(err)
      toast.error('Parsing failed. Please try again.')
      setStep('input')
    }
  }

  const updateItem = useCallback((id: string, updates: Partial<ParsedImportItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)))
  }, [])

  const confirmItem = useCallback(
    (id: string) => {
      updateItem(id, { confirmed: true })
      setEditingId(null)
    },
    [updateItem],
  )

  const handleAIAnalyse = async (item: ParsedImportItem) => {
    const discogsToken = apiKeys?.openaiKey ? undefined : undefined
    setAnalysingIds((prev) => new Set(prev).add(item.id))
    try {
      const input: PressingIdentificationInput = {
        manualHints: {
          artist: item.artistName,
          title: item.releaseTitle,
          country: item.country !== 'Unknown' ? item.country : undefined,
          year: item.year !== 1970 ? item.year : undefined,
          format: item.format,
          labelName: item.labelName,
          catalogNumber: item.catalogNumber,
        },
        discogsSearchEnabled: false,
        discogsApiToken: discogsToken,
      }
      const candidates = await identifyPressing(input)
      if (candidates.length > 0) {
        const top = candidates[0]
        updateItem(item.id, {
          country: top.country ?? item.country,
          labelName: item.labelName,
          catalogNumber: top.catalogNumber ?? item.catalogNumber,
          year: top.year ?? item.year,
          notes: item.notes
            ? `${item.notes} [AI: ${top.releaseTitle}]`
            : `AI identified: ${top.releaseTitle ?? item.releaseTitle}`,
        })
        toast.success(`AI identified pressing for ${item.artistName} - ${item.releaseTitle}`)
      } else {
        toast.info('No pressing candidates found')
      }
    } catch (err) {
      console.error(err)
      toast.error('AI analysis failed')
    } finally {
      setAnalysingIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  const handleAIAnalyseAll = async () => {
    setAnalysingAll(true)
    try {
      await Promise.all(items.map((item) => handleAIAnalyse(item)))
      toast.success('AI analysis complete for all items')
    } finally {
      setAnalysingAll(false)
    }
  }

  const handleDone = () => {
    const confirmed = items.filter((i) => i.confirmed)
    if (confirmed.length === 0) {
      toast.error('Please confirm at least one item')
      return
    }
    const collectionItems = confirmed.map(convertToCollectionItem)
    onItemsAdded(collectionItems)
    setStep('complete')
  }

  const allConfirmed = items.length > 0 && items.every((i) => i.confirmed)
  const confirmedCount = items.filter((i) => i.confirmed).length

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetDialog()
        onOpenChange(isOpen)
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-slate-900 border-slate-700 text-white">
        {/* Step: input */}
        {step === 'input' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <FileText size={22} weight="fill" className="text-accent" />
                Import Records from Text
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 overflow-y-auto flex-1 pr-1">
              {/* File upload */}
              <div
                className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-accent/60 hover:bg-slate-800/50 transition-all"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files?.[0]
                  if (file && file.name.endsWith('.txt')) {
                    const reader = new FileReader()
                    reader.onload = (ev) => {
                      const text = ev.target?.result
                      if (typeof text === 'string') {
                        setRawText(text)
                        toast.success(`Loaded ${file.name}`)
                      }
                    }
                    reader.readAsText(file)
                  } else {
                    toast.error('Please drop a .txt file')
                  }
                }}
              >
                <FileText size={40} className="mx-auto mb-3 text-slate-500" />
                <p className="text-slate-300 font-medium">Drag &amp; drop a .txt file here</p>
                <p className="text-slate-500 text-sm mt-1">or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-700" />
                <span className="text-slate-500 text-sm">or paste text below</span>
                <div className="flex-1 h-px bg-slate-700" />
              </div>

              {/* Textarea */}
              <div className="flex flex-col gap-2">
                <Label className="flex items-center gap-2 text-slate-300">
                  <ClipboardText size={16} />
                  Paste your records here
                </Label>
                <textarea
                  className="w-full h-48 bg-slate-800 border border-slate-600 rounded-lg p-3 text-white placeholder:text-slate-500 text-sm resize-none focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30"
                  placeholder={`The Beatles - Abbey Road (1969) UK\nPink Floyd - The Wall (1979) NM/VG+\nArtist: Led Zeppelin, Title: Physical Graffiti\nMiles Davis - Kind of Blue, 1959, Columbia, LP`}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
                <p className="text-slate-500 text-xs">
                  Supports various formats: "Artist - Title (Year)", "Artist: ..., Title: ...", plain names, etc.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-slate-600 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleParse}
                disabled={!rawText.trim()}
                className="bg-accent hover:bg-accent/90 gap-2"
              >
                <ArrowRight size={16} weight="bold" />
                Parse Records
              </Button>
            </div>
          </>
        )}

        {/* Step: parsing */}
        {step === 'parsing' && (
          <div className="flex flex-col items-center justify-center flex-1 gap-6 py-16">
            <div className="relative">
              <CircleNotch size={56} className="text-accent animate-spin" />
              <Sparkle
                size={24}
                weight="fill"
                className="text-accent absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              />
            </div>
            <div className="text-center">
              <p className="text-white text-lg font-semibold">AI is parsing your records...</p>
              <p className="text-slate-400 text-sm mt-1">
                Extracting artist, title, year, format and condition information
              </p>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-accent animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Step: overview */}
        {step === 'overview' && (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-xl flex items-center gap-2">
                  <FileText size={22} weight="fill" className="text-accent" />
                  Upload Overview
                  <Badge variant="secondary" className="ml-2 bg-slate-700 text-slate-200">
                    {items.length} record{items.length !== 1 ? 's' : ''}
                  </Badge>
                </DialogTitle>
              </div>
            </DialogHeader>

            {/* Top action bar */}
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAIAnalyseAll}
                  disabled={analysingAll}
                  className="gap-1.5 border-slate-600 text-slate-200 hover:bg-slate-700"
                >
                  {analysingAll ? (
                    <CircleNotch size={16} className="animate-spin" />
                  ) : (
                    <Sparkle size={16} weight="fill" className="text-yellow-400" />
                  )}
                  AI Analyse All
                </Button>
                <span className="text-slate-500 text-xs">
                  {confirmedCount}/{items.length} confirmed
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleDone}
                disabled={!allConfirmed}
                className="gap-1.5 bg-accent hover:bg-accent/90"
              >
                <Check size={16} weight="bold" />
                Done
              </Button>
            </div>

            {/* Items grid */}
            <div className="overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
                {items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    editingId={editingId}
                    analysingIds={analysingIds}
                    onEdit={(id) => setEditingId(editingId === id ? null : id)}
                    onConfirm={confirmItem}
                    onAIAnalyse={handleAIAnalyse}
                    onUpdate={updateItem}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Step: complete */}
        {step === 'complete' && (
          <div className="flex flex-col items-center justify-center flex-1 gap-6 py-12">
            <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-400 flex items-center justify-center">
              <CheckCircle size={48} weight="fill" className="text-green-400" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Added to Collection! 🎉</h2>
              <p className="text-slate-300 mt-2">
                Successfully added{' '}
                <span className="text-accent font-semibold">
                  {items.filter((i) => i.confirmed).length} record
                  {items.filter((i) => i.confirmed).length !== 1 ? 's' : ''}
                </span>{' '}
                to your collection.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  resetDialog()
                  onOpenChange(false)
                }}
                className="border-slate-600 text-slate-300"
              >
                View Collection
              </Button>
              <Button
                onClick={resetDialog}
                className="bg-accent hover:bg-accent/90 gap-2"
              >
                <ArrowRight size={16} />
                Import More
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ─── Inline item card used in overview step ────────────────────────────── */

interface ItemCardProps {
  item: ParsedImportItem
  editingId: string | null
  analysingIds: Set<string>
  onEdit: (id: string) => void
  onConfirm: (id: string) => void
  onAIAnalyse: (item: ParsedImportItem) => void
  onUpdate: (id: string, updates: Partial<ParsedImportItem>) => void
}

function ItemCard({
  item,
  editingId,
  analysingIds,
  onEdit,
  onConfirm,
  onAIAnalyse,
  onUpdate,
}: ItemCardProps) {
  const isEditing = editingId === item.id
  const isAnalysing = analysingIds.has(item.id)

  return (
    <div
      className={`transition-all duration-500 border-2 rounded-xl p-4 bg-slate-800/60 ${
        item.confirmed
          ? 'border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.6),0_0_40px_rgba(74,222,128,0.3)]'
          : 'border-slate-700'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-white text-sm truncate">{item.artistName}</p>
            {item.confirmed && (
              <CheckCircle size={16} weight="fill" className="text-green-400 shrink-0" />
            )}
          </div>
          <p className="text-slate-300 text-xs truncate">{item.releaseTitle}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="secondary" className="bg-slate-700 text-slate-200 text-xs px-1.5 py-0">
            {item.format}
          </Badge>
          <Badge
            variant="outline"
            className={`text-xs px-1.5 py-0 ${
              item.confidence >= 0.7
                ? 'border-green-500/50 text-green-400'
                : item.confidence >= 0.5
                  ? 'border-yellow-500/50 text-yellow-400'
                  : 'border-red-500/50 text-red-400'
            }`}
          >
            {Math.round(item.confidence * 100)}%
          </Badge>
        </div>
      </div>

      {/* Info row */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400 mb-3">
        <span>{item.year}</span>
        <span>{item.country}</span>
        <span>
          {item.mediaGrade}/{item.sleeveGrade}
        </span>
        {item.labelName && <span className="truncate max-w-[120px]">{item.labelName}</span>}
      </div>

      {/* Inline edit panel */}
      {isEditing && (
        <EditPanel item={item} onUpdate={onUpdate} onClose={() => onEdit(item.id)} />
      )}

      {/* Action buttons */}
      {!isEditing && (
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(item.id)}
            className="h-7 px-2 text-xs gap-1 border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <PencilSimple size={12} />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAIAnalyse(item)}
            disabled={isAnalysing}
            className="h-7 px-2 text-xs gap-1 border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            {isAnalysing ? (
              <CircleNotch size={12} className="animate-spin" />
            ) : (
              <Sparkle size={12} weight="fill" className="text-yellow-400" />
            )}
            AI Analyse
          </Button>
          {!item.confirmed && (
            <Button
              size="sm"
              onClick={() => onConfirm(item.id)}
              className="h-7 px-2 text-xs gap-1 bg-green-600 hover:bg-green-500 text-white ml-auto"
            >
              <CheckCircle size={12} weight="fill" />
              Confirm
            </Button>
          )}
          {item.confirmed && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUpdate(item.id, { confirmed: false })}
              className="h-7 px-2 text-xs gap-1 border-slate-600 text-slate-400 hover:bg-slate-700 ml-auto"
            >
              <X size={12} />
              Unconfirm
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Inline edit panel ─────────────────────────────────────────────────── */

interface EditPanelProps {
  item: ParsedImportItem
  onUpdate: (id: string, updates: Partial<ParsedImportItem>) => void
  onClose: () => void
}

function EditPanel({ item, onUpdate, onClose }: EditPanelProps) {
  const [draft, setDraft] = useState<ParsedImportItem>({ ...item })

  const handleSave = () => {
    onUpdate(item.id, draft)
    onClose()
  }

  const field = (
    label: string,
    key: keyof ParsedImportItem,
    type: 'text' | 'number' = 'text',
  ) => (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-slate-400">{label}</Label>
      <Input
        type={type}
        value={String(draft[key] ?? '')}
        onChange={(e) =>
          setDraft((d) => ({
            ...d,
            [key]: type === 'number' ? parseInt(e.target.value, 10) || 0 : e.target.value,
          }))
        }
        className="h-7 text-xs bg-slate-700 border-slate-600 text-white"
      />
    </div>
  )

  return (
    <div className="border border-slate-600 rounded-lg p-3 mb-3 bg-slate-900/60">
      <div className="grid grid-cols-2 gap-2 mb-2">
        {field('Artist', 'artistName')}
        {field('Title', 'releaseTitle')}
        {field('Year', 'year', 'number')}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-slate-400">Format</Label>
          <Select
            value={draft.format}
            onValueChange={(v) => setDraft((d) => ({ ...d, format: v as Format }))}
          >
            <SelectTrigger className="h-7 text-xs bg-slate-700 border-slate-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600 text-white">
              {FORMAT_OPTIONS.map((f) => (
                <SelectItem key={f} value={f} className="text-xs">
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {field('Country', 'country')}
        {field('Label', 'labelName')}
        {field('Cat. No.', 'catalogNumber')}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-slate-400">Media Grade</Label>
          <Select
            value={draft.mediaGrade}
            onValueChange={(v) => setDraft((d) => ({ ...d, mediaGrade: v as MediaGrade }))}
          >
            <SelectTrigger className="h-7 text-xs bg-slate-700 border-slate-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600 text-white">
              {GRADE_OPTIONS.map((g) => (
                <SelectItem key={g} value={g} className="text-xs">
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-slate-400">Sleeve Grade</Label>
          <Select
            value={draft.sleeveGrade}
            onValueChange={(v) => setDraft((d) => ({ ...d, sleeveGrade: v as SleeveGrade }))}
          >
            <SelectTrigger className="h-7 text-xs bg-slate-700 border-slate-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600 text-white">
              {GRADE_OPTIONS.map((g) => (
                <SelectItem key={g} value={g} className="text-xs">
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notes full width */}
      <div className="flex flex-col gap-1 mb-3">
        <Label className="text-xs text-slate-400">Notes</Label>
        <Input
          value={draft.notes ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value || undefined }))}
          className="h-7 text-xs bg-slate-700 border-slate-600 text-white"
          placeholder="Optional notes..."
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={onClose}
          className="h-7 px-2 text-xs border-slate-600 text-slate-300"
        >
          <X size={12} />
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          className="h-7 px-2 text-xs bg-accent hover:bg-accent/90"
        >
          <Check size={12} />
          Save
        </Button>
      </div>
    </div>
  )
}
