import { useState, useRef, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { CollectionItem } from '@/lib/types'
import { ChatMessage, ChatCorrection, LearningData, askAboutRecord, askGeneralQuestion } from '@/lib/ai-chat-service'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  PaperPlaneRight, 
  Sparkle, 
  CheckCircle, 
  XCircle, 
  Pencil,
  Robot,
  User,
  Lightbulb,
  Microphone,
  Stop
} from '@phosphor-icons/react'
import { toast } from 'sonner'

interface AIChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: CollectionItem
  allItems: CollectionItem[]
  onApplyCorrection?: (itemId: string, corrections: Record<string, string>) => void
}

export function AIChatDialog({ 
  open, 
  onOpenChange, 
  item,
  allItems,
  onApplyCorrection 
}: AIChatDialogProps) {
  const [messages, setMessages] = useKV<ChatMessage[]>('ai-chat-messages', [])
  const [learningData, setLearningData] = useKV<LearningData[]>('ai-learning-data', [])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

  const safeMessages = messages || []
  const safeLearning = learningData || []

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      setIsSupported(true)
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = 'en-US'

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setInput(transcript)
        setIsRecording(false)
        toast.success('Voice captured successfully')
      }

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsRecording(false)
        if (event.error === 'no-speech') {
          toast.error('No speech detected')
        } else if (event.error === 'not-allowed') {
          toast.error('Microphone access denied')
        } else {
          toast.error('Voice input failed')
        }
      }

      recognitionRef.current.onend = () => {
        setIsRecording(false)
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [safeMessages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      itemContext: item?.id,
    }

    setMessages(current => [...(current || []), userMessage])
    setInput('')
    setIsLoading(true)

    try {
      let answer: string
      let suggestedCorrections: ChatCorrection[] = []

      if (item) {
        const response = await askAboutRecord(input.trim(), item, allItems, safeMessages)
        answer = response.answer
        suggestedCorrections = response.suggestedCorrections || []
      } else {
        answer = await askGeneralQuestion(input.trim(), allItems, safeMessages)
      }

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: answer,
        timestamp: new Date().toISOString(),
        itemContext: item?.id,
        suggestedCorrection: suggestedCorrections.length > 0 ? suggestedCorrections[0] : undefined,
        correctionApplied: false,
      }

      setMessages(current => [...(current || []), assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      toast.error('Failed to get response')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyCorrection = (messageId: string, correction: ChatCorrection) => {
    if (!item || !onApplyCorrection) return

    onApplyCorrection(item.id, {
      [correction.field]: correction.suggestedValue,
    })

    setMessages(current =>
      (current || []).map(msg =>
        msg.id === messageId ? { ...msg, correctionApplied: true } : msg
      )
    )

    toast.success('Correction applied to item')
  }

  const handleStartEdit = (messageId: string, content: string) => {
    setEditingMessageId(messageId)
    setEditedContent(content)
  }

  const handleSaveEdit = (messageId: string, originalContent: string, userQuestion: string) => {
    if (!editedContent.trim()) return

    const learning: LearningData = {
      id: `learn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      question: userQuestion,
      originalAnswer: originalContent,
      userCorrection: editedContent.trim(),
      context: {
        itemId: item?.id,
        artistName: item?.artistName,
        releaseTitle: item?.releaseTitle,
      },
      timestamp: new Date().toISOString(),
      applied: true,
    }

    setLearningData(current => [...(current || []), learning])

    setMessages(current =>
      (current || []).map(msg =>
        msg.id === messageId ? { ...msg, content: editedContent.trim() } : msg
      )
    )

    setEditingMessageId(null)
    setEditedContent('')
    toast.success('Correction saved - AI will learn from this')
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditedContent('')
  }

  const handleVoiceInput = () => {
    if (!isSupported) {
      toast.error('Voice input not supported in this browser')
      return
    }

    if (isRecording) {
      recognitionRef.current?.stop()
      setIsRecording(false)
    } else {
      try {
        recognitionRef.current?.start()
        setIsRecording(true)
        toast.info('Listening... Speak now')
      } catch (error) {
        console.error('Failed to start recording:', error)
        toast.error('Failed to start voice input')
      }
    }
  }

  const conversationMessages = item
    ? safeMessages.filter(msg => msg.itemContext === item.id)
    : safeMessages.filter(msg => !msg.itemContext)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkle size={24} weight="fill" className="text-accent" />
            AI Record Assistant
          </DialogTitle>
          <DialogDescription>
            {item ? (
              <>Ask questions about {item.artistName} - {item.releaseTitle}</>
            ) : (
              <>Ask questions about vinyl collecting and your collection</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {conversationMessages.length === 0 && (
                <Card className="p-6 bg-muted/50 border-dashed">
                  <div className="flex items-start gap-3 text-muted-foreground">
                    <Lightbulb size={24} className="mt-1" />
                    <div className="space-y-2">
                      <p className="font-medium">Try asking:</p>
                      <ul className="text-sm space-y-1">
                        {item ? (
                          <>
                            <li>• "What makes this pressing valuable?"</li>
                            <li>• "How can I identify if this is a first pressing?"</li>
                            <li>• "What should I look for in the matrix numbers?"</li>
                          </>
                        ) : (
                          <>
                            <li>• "What are my most valuable records?"</li>
                            <li>• "How should I store my vinyl collection?"</li>
                            <li>• "Explain vinyl grading standards"</li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                </Card>
              )}

              {conversationMessages.map((message, idx) => {
                const prevMessage = idx > 0 ? conversationMessages[idx - 1] : null
                const isEditing = editingMessageId === message.id

                return (
                  <div key={message.id}>
                    <div
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                          <Robot size={18} className="text-primary-foreground" />
                        </div>
                      )}

                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card border border-border'
                        }`}
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              className="w-full min-h-[100px] p-2 rounded bg-background text-foreground border border-input"
                              value={editedContent}
                              onChange={(e) => setEditedContent(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() =>
                                  handleSaveEdit(
                                    message.id,
                                    message.content,
                                    prevMessage?.content || ''
                                  )
                                }
                              >
                                <CheckCircle size={16} />
                                Save Correction
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                              >
                                <XCircle size={16} />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="whitespace-pre-wrap">{message.content}</p>
                            
                            {message.role === 'assistant' && !message.correctionApplied && (
                              <div className="mt-3 flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    handleStartEdit(message.id, message.content)
                                  }
                                  className="gap-2"
                                >
                                  <Pencil size={14} />
                                  Correct Answer
                                </Button>
                              </div>
                            )}

                            {message.suggestedCorrection && !message.correctionApplied && (
                              <Card className="mt-3 p-3 bg-accent/10 border-accent">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="secondary" className="text-xs">
                                        Suggested Correction
                                      </Badge>
                                      <Badge variant="outline" className="text-xs">
                                        {Math.round(message.suggestedCorrection.confidence * 100)}% confident
                                      </Badge>
                                    </div>
                                    <p className="text-sm">
                                      <span className="font-medium">{message.suggestedCorrection.field}:</span>{' '}
                                      <span className="line-through text-muted-foreground">
                                        {message.suggestedCorrection.originalValue}
                                      </span>{' '}
                                      →{' '}
                                      <span className="text-accent font-medium">
                                        {message.suggestedCorrection.suggestedValue}
                                      </span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {message.suggestedCorrection.reasoning}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleApplyCorrection(message.id, message.suggestedCorrection!)
                                    }
                                    className="gap-2"
                                  >
                                    <CheckCircle size={14} />
                                    Apply
                                  </Button>
                                </div>
                              </Card>
                            )}

                            {message.correctionApplied && (
                              <Badge variant="default" className="mt-2 gap-1">
                                <CheckCircle size={12} />
                                Applied
                              </Badge>
                            )}
                          </>
                        )}
                      </div>

                      {message.role === 'user' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                          <User size={18} className="text-accent-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <Robot size={18} className="text-primary-foreground" />
                  </div>
                  <Card className="p-4 border border-border">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </ScrollArea>

          {safeLearning.length > 0 && (
            <div className="px-1">
              <Separator className="mb-2" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkle size={14} weight="fill" />
                <span>{safeLearning.length} correction{safeLearning.length !== 1 ? 's' : ''} learned</span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder={item ? "Ask about this record..." : "Ask about your collection..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                disabled={isLoading || isRecording}
                className="pr-12"
              />
              {isSupported && (
                <Button
                  size="icon"
                  variant={isRecording ? "default" : "ghost"}
                  onClick={handleVoiceInput}
                  disabled={isLoading}
                  className={`absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 ${
                    isRecording ? 'animate-pulse bg-destructive hover:bg-destructive' : ''
                  }`}
                  title={isRecording ? 'Stop recording' : 'Start voice input'}
                >
                  {isRecording ? (
                    <Stop size={18} weight="fill" />
                  ) : (
                    <Microphone size={18} weight="fill" />
                  )}
                </Button>
              )}
            </div>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isRecording}
              className="gap-2"
            >
              <PaperPlaneRight size={18} weight="fill" />
              Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
