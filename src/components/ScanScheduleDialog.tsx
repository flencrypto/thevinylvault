import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Clock, Calendar, Plus, Trash, Play, Pause, Info, CheckCircle, Warning, Sparkle, Lightning, MagnifyingGlass, Eye } from '@phosphor-icons/react'
import { useKV } from '@github/spark/hooks'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface ScheduledScan {
  id: string
  name: string
  enabled: boolean
  time: string
  frequency: 'daily' | 'weekdays' | 'weekends' | 'custom'
  daysOfWeek?: number[]
  searchQuery: string
  includeEbay: boolean
  includeDiscogs: boolean
  maxPrice?: number
  minScore: number
  maxResults: number
  lastRun?: string
  nextRun?: string
}

interface ScanScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

export function ScanScheduleDialog({ open, onOpenChange }: ScanScheduleDialogProps) {
  const [schedules = [], setSchedules] = useKV<ScheduledScan[]>('scan-schedules', [])
  const [editingSchedule, setEditingSchedule] = useState<ScheduledScan | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const [name, setName] = useState('')
  const [time, setTime] = useState('09:00')
  const [frequency, setFrequency] = useState<'daily' | 'weekdays' | 'weekends' | 'custom'>('daily')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [includeEbay, setIncludeEbay] = useState(true)
  const [includeDiscogs, setIncludeDiscogs] = useState(true)
  const [maxPrice, setMaxPrice] = useState<string>('')
  const [minScore, setMinScore] = useState<number>(70)
  const [maxResults, setMaxResults] = useState<number>(50)

  useEffect(() => {
    if (editingSchedule) {
      setName(editingSchedule.name)
      setTime(editingSchedule.time)
      setFrequency(editingSchedule.frequency)
      setSelectedDays(editingSchedule.daysOfWeek || [])
      setSearchQuery(editingSchedule.searchQuery)
      setIncludeEbay(editingSchedule.includeEbay)
      setIncludeDiscogs(editingSchedule.includeDiscogs)
      setMaxPrice(editingSchedule.maxPrice?.toString() || '')
      setMinScore(editingSchedule.minScore)
      setMaxResults(editingSchedule.maxResults)
      setShowCreateForm(true)
    }
  }, [editingSchedule])

  const resetForm = () => {
    setName('')
    setTime('09:00')
    setFrequency('daily')
    setSelectedDays([])
    setSearchQuery('')
    setIncludeEbay(true)
    setIncludeDiscogs(true)
    setMaxPrice('')
    setMinScore(70)
    setMaxResults(50)
    setEditingSchedule(null)
    setShowCreateForm(false)
  }

  const applyPreset = (preset: 'morning-rare' | 'morning-bargains' | 'lunchtime-new-listings' | 'evening-watchlist') => {
    switch (preset) {
      case 'morning-rare':
        setName('Morning Rare Pressings')
        setTime('08:00')
        setFrequency('daily')
        setSearchQuery('first pressing rare original')
        setIncludeEbay(true)
        setIncludeDiscogs(true)
        setMaxPrice('500')
        setMinScore(75)
        setMaxResults(30)
        toast.success('Applied Morning Rare Pressings preset')
        break
      case 'morning-bargains':
        setName('Morning Bargain Hunt')
        setTime('07:00')
        setFrequency('weekdays')
        setSearchQuery('vinyl record lot collection')
        setIncludeEbay(true)
        setIncludeDiscogs(true)
        setMaxPrice('50')
        setMinScore(65)
        setMaxResults(50)
        toast.success('Applied Morning Bargain Hunt preset')
        break
      case 'lunchtime-new-listings':
        setName('Lunchtime New Listings')
        setTime('12:00')
        setFrequency('daily')
        setSearchQuery('vinyl LP')
        setIncludeEbay(true)
        setIncludeDiscogs(true)
        setMaxPrice('')
        setMinScore(60)
        setMaxResults(40)
        toast.success('Applied Lunchtime New Listings preset')
        break
      case 'evening-watchlist':
        setName('Evening Watchlist Check')
        setTime('18:00')
        setFrequency('daily')
        setSearchQuery('rare collectible')
        setIncludeEbay(true)
        setIncludeDiscogs(true)
        setMaxPrice('')
        setMinScore(70)
        setMaxResults(50)
        toast.success('Applied Evening Watchlist Check preset')
        break
    }
  }

  const calculateNextRun = (schedule: ScheduledScan): string => {
    const now = new Date()
    const [hours, minutes] = schedule.time.split(':').map(Number)
    
    let nextRun = new Date()
    nextRun.setHours(hours, minutes, 0, 0)

    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1)
    }

    if (schedule.frequency === 'weekdays') {
      while (nextRun.getDay() === 0 || nextRun.getDay() === 6) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
    } else if (schedule.frequency === 'weekends') {
      while (nextRun.getDay() !== 0 && nextRun.getDay() !== 6) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
    } else if (schedule.frequency === 'custom' && schedule.daysOfWeek) {
      while (!schedule.daysOfWeek.includes(nextRun.getDay())) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
    }

    return nextRun.toISOString()
  }

  const handleSave = () => {
    if (!name.trim() || !searchQuery.trim()) {
      toast.error('Please provide a name and search query')
      return
    }

    if (frequency === 'custom' && selectedDays.length === 0) {
      toast.error('Please select at least one day for custom frequency')
      return
    }

    const newSchedule: ScheduledScan = {
      id: editingSchedule?.id || Date.now().toString(),
      name: name.trim(),
      enabled: editingSchedule?.enabled ?? true,
      time,
      frequency,
      daysOfWeek: frequency === 'custom' ? selectedDays : undefined,
      searchQuery: searchQuery.trim(),
      includeEbay,
      includeDiscogs,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      minScore,
      maxResults,
      lastRun: editingSchedule?.lastRun,
      nextRun: undefined,
    }

    newSchedule.nextRun = calculateNextRun(newSchedule)

    if (editingSchedule) {
      setSchedules((current = []) =>
        current.map(s => s.id === editingSchedule.id ? newSchedule : s)
      )
      toast.success('Scan schedule updated')
    } else {
      setSchedules((current = []) => [...current, newSchedule])
      toast.success('Scan schedule created')
    }

    resetForm()
  }

  const handleDelete = (id: string) => {
    setSchedules((current = []) => current.filter(s => s.id !== id))
    toast.success('Scan schedule deleted')
  }

  const handleToggle = (id: string) => {
    setSchedules((current = []) =>
      current.map(s => {
        if (s.id === id) {
          const updated = { ...s, enabled: !s.enabled }
          if (updated.enabled) {
            updated.nextRun = calculateNextRun(updated)
          }
          return updated
        }
        return s
      })
    )
  }

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  const formatNextRun = (dateString?: string): string => {
    if (!dateString) return 'Not scheduled'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (diffHours < 24) {
      return `in ${diffHours}h ${diffMins}m`
    }
    const diffDays = Math.floor(diffHours / 24)
    return `in ${diffDays}d ${diffHours % 24}h`
  }

  const getFrequencyLabel = (schedule: ScheduledScan): string => {
    if (schedule.frequency === 'daily') return 'Daily'
    if (schedule.frequency === 'weekdays') return 'Weekdays'
    if (schedule.frequency === 'weekends') return 'Weekends'
    if (schedule.frequency === 'custom' && schedule.daysOfWeek) {
      return schedule.daysOfWeek.map(d => DAYS_OF_WEEK[d].label).join(', ')
    }
    return 'Unknown'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent" weight="bold" />
            Scheduled Scans
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Automatically scan marketplaces for bargains at specific times
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!showCreateForm ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Info className="w-4 h-4" />
                  <span>Scans run in the background and save results to Bargains</span>
                </div>
                <Button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Schedule
                </Button>
              </div>

              {schedules.length === 0 ? (
                <Card className="bg-slate-950/50 border-slate-800">
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">No scheduled scans yet</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Create a schedule to automatically scan for bargains
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {schedules.map(schedule => (
                    <Card
                      key={schedule.id}
                      className={cn(
                        "bg-slate-950/50 border-slate-800 transition-all",
                        !schedule.enabled && "opacity-50"
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-white truncate">
                                {schedule.name}
                              </h4>
                              {schedule.enabled ? (
                                <Badge variant="outline" className="border-green-500/50 text-green-400 bg-green-500/10">
                                  <CheckCircle className="w-3 h-3 mr-1" weight="fill" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-slate-600 text-slate-400">
                                  <Pause className="w-3 h-3 mr-1" />
                                  Paused
                                </Badge>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-400">
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>{schedule.time} - {getFrequencyLabel(schedule)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span>Next: {formatNextRun(schedule.nextRun)}</span>
                              </div>
                              <div className="col-span-2 truncate">
                                Query: "{schedule.searchQuery}"
                              </div>
                              <div className="flex items-center gap-2">
                                {schedule.includeEbay && (
                                  <Badge variant="outline" className="text-xs border-slate-700">eBay</Badge>
                                )}
                                {schedule.includeDiscogs && (
                                  <Badge variant="outline" className="text-xs border-slate-700">Discogs</Badge>
                                )}
                              </div>
                              <div>
                                Min Score: {schedule.minScore}%
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggle(schedule.id)}
                              className="text-slate-400 hover:text-white"
                            >
                              {schedule.enabled ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingSchedule(schedule)}
                              className="text-slate-400 hover:text-white"
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(schedule.id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          ) : (
            <Card className="bg-slate-950/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white text-lg">
                  {editingSchedule ? 'Edit Schedule' : 'Create Schedule'}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Configure automatic marketplace scanning
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-slate-200">Quick Presets</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset('morning-rare')}
                      className="bg-gradient-to-br from-accent/20 to-transparent border-accent/40 hover:bg-accent/30 text-accent-foreground"
                    >
                      <Sparkle className="w-4 h-4 mr-2" weight="fill" />
                      Morning Rare Pressings
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset('morning-bargains')}
                      className="bg-gradient-to-br from-green-500/20 to-transparent border-green-500/40 hover:bg-green-500/30 text-green-400"
                    >
                      <Lightning className="w-4 h-4 mr-2" weight="fill" />
                      Morning Bargains
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset('lunchtime-new-listings')}
                      className="bg-gradient-to-br from-blue-500/20 to-transparent border-blue-500/40 hover:bg-blue-500/30 text-blue-400"
                    >
                      <MagnifyingGlass className="w-4 h-4 mr-2" weight="fill" />
                      Lunchtime New Listings
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset('evening-watchlist')}
                      className="bg-gradient-to-br from-purple-500/20 to-transparent border-purple-500/40 hover:bg-purple-500/30 text-purple-400"
                    >
                      <Eye className="w-4 h-4 mr-2" weight="fill" />
                      Evening Watchlist
                    </Button>
                  </div>
                </div>

                <Separator className="bg-slate-800" />

                <div className="space-y-2">
                  <Label htmlFor="schedule-name" className="text-slate-200">Schedule Name</Label>
                  <Input
                    id="schedule-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Morning Bargain Hunt"
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scan-time" className="text-slate-200">Time</Label>
                    <Input
                      id="scan-time"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scan-frequency" className="text-slate-200">Frequency</Label>
                    <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekdays">Weekdays Only</SelectItem>
                        <SelectItem value="weekends">Weekends Only</SelectItem>
                        <SelectItem value="custom">Custom Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {frequency === 'custom' && (
                  <div className="space-y-2">
                    <Label className="text-slate-200">Days of Week</Label>
                    <div className="flex gap-2">
                      {DAYS_OF_WEEK.map(day => (
                        <Button
                          key={day.value}
                          type="button"
                          size="sm"
                          variant={selectedDays.includes(day.value) ? 'default' : 'outline'}
                          onClick={() => toggleDay(day.value)}
                          className={cn(
                            "flex-1",
                            selectedDays.includes(day.value)
                              ? "bg-accent hover:bg-accent/90 text-accent-foreground border-accent"
                              : "border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                          )}
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <Separator className="bg-slate-800" />

                <div className="space-y-2">
                  <Label htmlFor="search-query" className="text-slate-200">Search Query</Label>
                  <Input
                    id="search-query"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g., Beatles first pressing UK"
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700">
                    <Label htmlFor="include-ebay" className="text-slate-200">Include eBay</Label>
                    <Switch
                      id="include-ebay"
                      checked={includeEbay}
                      onCheckedChange={setIncludeEbay}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700">
                    <Label htmlFor="include-discogs" className="text-slate-200">Include Discogs</Label>
                    <Switch
                      id="include-discogs"
                      checked={includeDiscogs}
                      onCheckedChange={setIncludeDiscogs}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max-price" className="text-slate-200">Max Price</Label>
                    <Input
                      id="max-price"
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="Any"
                      className="bg-slate-900 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min-score" className="text-slate-200">Min Score</Label>
                    <Input
                      id="min-score"
                      type="number"
                      value={minScore}
                      onChange={(e) => setMinScore(parseInt(e.target.value) || 0)}
                      min={0}
                      max={100}
                      className="bg-slate-900 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-results" className="text-slate-200">Max Results</Label>
                    <Input
                      id="max-results"
                      type="number"
                      value={maxResults}
                      onChange={(e) => setMaxResults(parseInt(e.target.value) || 0)}
                      min={1}
                      max={200}
                      className="bg-slate-900 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <Warning className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-200">
                    Scheduled scans run in the background when the app is open. Make sure your device doesn't go to sleep during scheduled times.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {showCreateForm && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={resetForm}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
