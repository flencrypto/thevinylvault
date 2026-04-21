/**
 * TesseractOCRService — client-side OCR for vinyl record images.
 *
 * Uses Tesseract.js (lazy-loaded from CDN on first use) to extract
 * raw text from sleeve / label / deadwax photos, then applies
 * vinyl-specific heuristics to parse artist, title, label, catalogue
 * number, year, matrix runouts, and more.
 *
 * No API key required. All processing happens in the browser.
 */

import { RecordAnalysisResult } from './xai-service'

declare const Tesseract: {
  recognize(
    image: File | Blob | string,
    lang: string,
    options?: { logger?: (m: { status: string; progress: number }) => void }
  ): Promise<{ data: { text: string } }>
}

export interface OcrRecordAnalysisResult extends RecordAnalysisResult {
  isFirstPress: boolean | null
  pressingConfidence: 'high' | 'medium' | 'low'
  pressingEvidence: string[]
  identifierStrings: string[]
  rawText?: string
}

class TesseractOCRService {
  private _scriptLoaded = false
  private _loadPromise: Promise<void> | null = null

  async loadTesseract(): Promise<void> {
    if (this._scriptLoaded || typeof Tesseract !== 'undefined') {
      this._scriptLoaded = true
      return
    }
    if (this._loadPromise) return this._loadPromise

    this._loadPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/tesseract.js@5/dist/tesseract.min.js'
      script.crossOrigin = 'anonymous'
      script.onload = () => {
        this._scriptLoaded = true
        resolve()
      }
      script.onerror = () => reject(new Error('Failed to load Tesseract.js from CDN'))
      document.head.appendChild(script)
    })

    return this._loadPromise
  }

  // ─── Core OCR ────────────────────────────────────────────────────────────

  async extractText(
    image: File | Blob | string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    await this.loadTesseract()

    const { data } = await Tesseract.recognize(image, 'eng', {
      logger: (m) => {
        if (onProgress && m.status === 'recognizing text') {
          onProgress(Math.min(99, Math.floor(m.progress * 100)))
        }
      },
    })

    return data.text || ''
  }

  async analyzeRecordImages(
    imageFiles: File[],
    onProgress?: (progress: number) => void
  ): Promise<OcrRecordAnalysisResult> {
    if (!imageFiles || imageFiles.length === 0) {
      throw new Error('No images provided')
    }

    const texts: string[] = []
    for (let i = 0; i < imageFiles.length; i++) {
      const perImageProgress = onProgress
        ? (p: number) => {
            const overall = Math.floor(((i + p / 100) / imageFiles.length) * 100)
            onProgress(Math.min(99, overall))
          }
        : undefined

      const text = await this.extractText(imageFiles[i], perImageProgress)
      texts.push(text)
    }

    if (onProgress) onProgress(100)

    const combined = texts.join('\n\n---IMAGE BREAK---\n\n')
    const parsed = this.parseVinylText(combined)
    parsed.rawText = combined
    return parsed
  }

  // ─── Text parser ─────────────────────────────────────────────────────────

  parseVinylText(text: string): OcrRecordAnalysisResult {
    const result: OcrRecordAnalysisResult = {
      artist: null,
      title: null,
      catalogueNumber: null,
      label: null,
      barcode: null,
      matrixRunoutA: null,
      matrixRunoutB: null,
      year: null,
      country: null,
      format: null,
      genre: null,
      conditionEstimate: null,
      pressingInfo: null,
      isFirstPress: null,
      pressingType: 'unknown',
      pressingConfidence: 'low',
      pressingEvidence: [],
      identifierStrings: [],
      confidence: 'low',
      notes: [],
    }

    if (!text || !text.trim()) return result

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    // ── 1. Year ──────────────────────────────────────────────────────────
    const yearMatch = text.match(/\b(19[4-9]\d|20[0-2]\d)\b/)
    if (yearMatch) {
      result.year = parseInt(yearMatch[1], 10)
    }

    // ── 2. Catalogue number ──────────────────────────────────────────────
    const catPatterns = [
      /\b([A-Z]{1,5}[\s-]?\d{3,8}(?:[\s-][A-Z])?)\b/g,
      /\b(\d[A-Z]\s\d{3}-\d{4,6})\b/g,
    ]
    const catCandidates: string[] = []
    for (const pat of catPatterns) {
      let m: RegExpExecArray | null
      const clone = new RegExp(pat.source, pat.flags)
      while ((m = clone.exec(text)) !== null) {
        catCandidates.push(m[1].replace(/\s+/g, ' ').trim())
      }
    }
    if (catCandidates.length > 0) {
      result.catalogueNumber = catCandidates.find((c) => /[A-Z]/.test(c)) || catCandidates[0]
      result.identifierStrings.push(...catCandidates)
    }

    // ── 3. Barcode ───────────────────────────────────────────────────────
    const barcodeMatch = text.match(/\b(\d{8,14})\b/)
    if (barcodeMatch) {
      result.barcode = barcodeMatch[1]
      if (!result.identifierStrings.includes(result.barcode)) {
        result.identifierStrings.push(result.barcode)
      }
    }

    // ── 4. Label ─────────────────────────────────────────────────────────
    result.label = this._detectLabel(text)

    // ── 5. Matrix / runout ───────────────────────────────────────────────
    const matrixLines = this._extractMatrixLines(lines)
    if (matrixLines.length > 0) {
      result.matrixRunoutA = matrixLines[0] || null
      result.matrixRunoutB = matrixLines[1] || null
      result.pressingInfo = matrixLines.join(' / ')
      result.identifierStrings.push(...matrixLines)
      this._applyPressingHeuristics(result, matrixLines)
    }

    // ── 6. Format ────────────────────────────────────────────────────────
    if (/\b(LP|Long\s*Play)\b/i.test(text)) result.format = 'LP'
    else if (/\b(EP|Extended\s*Play)\b/i.test(text)) result.format = 'EP'
    else if (/\b45\s*RPM\b/i.test(text)) result.format = '7"'
    else if (/\b33\s*(?:1\/3)?\s*RPM\b/i.test(text)) result.format = 'LP'

    // ── 7. Country ───────────────────────────────────────────────────────
    // Use explicit case for "Made/made" + "in/In" without the i-flag so that
    // character classes [A-Z]/[a-z] retain strict case semantics — this
    // prevents all-caps words like "OBI" from being swallowed into the country.
    const countryMatch = text.match(/[Mm]ade\s+[Ii]n\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/)
    if (countryMatch) result.country = countryMatch[1]
    else if (/\bUK\b|\bU\.K\.\b|United\s+Kingdom/i.test(text)) result.country = 'UK'
    else if (/\bUSA?\b|\bU\.S\.A?\.\b|United\s+States/i.test(text)) result.country = 'US'
    else if (/\bGermany\b|\bDeutschland\b/i.test(text)) result.country = 'Germany'
    else if (/\bFrance\b|\bFrançais\b/i.test(text)) result.country = 'France'
    else if (/\bItaly\b|\bItalia\b/i.test(text)) result.country = 'Italy'
    else if (/\bJapan\b|\bJapanese\b/i.test(text)) result.country = 'Japan'

    // ── 8. Artist / Title heuristics ────────────────────────────────────
    this._inferArtistTitle(result, lines, text)

    // ── 9. Confidence ────────────────────────────────────────────────────
    let hits = 0
    if (result.artist) hits++
    if (result.title) hits++
    if (result.catalogueNumber) hits++
    if (result.label) hits++
    if (result.year) hits++
    if (hits >= 4) result.confidence = 'high'
    else if (hits >= 2) result.confidence = 'medium'
    else result.confidence = 'low'

    result.identifierStrings = [...new Set(result.identifierStrings)]

    return result
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private _detectLabel(text: string): string | null {
    const labels = [
      'Blue Note', 'Impulse', 'Atlantic', 'Prestige', 'Riverside',
      'Contemporary', 'Pacific Jazz', 'Fantasy', 'Verve', 'ECM',
      'Milestone', 'Savoy', 'Bethlehem',
      'Island', 'Harvest', 'Parlophone', 'Apple', 'Columbia', 'Capitol',
      'Elektra', 'Reprise', 'Warner Bros', 'Asylum', 'Geffen', 'Chrysalis',
      'Virgin', 'Stiff', 'Rough Trade', 'Factory', 'Creation', '4AD', 'Mute',
      'Sub Pop', 'Matador', 'Domino', 'XL',
      'Vertigo', 'Polydor', 'Decca', 'Deutsche Grammophon', 'Philips',
      'Mercury', 'RCA', 'CBS', 'EMI', 'HMV', 'Pye', 'Fontana', 'Immediate',
      'Bronze Records', 'Charisma', 'Transatlantic',
      'Warp', 'Ninja Tune', 'Hospital', 'Soma', 'Planet E', 'R&S', 'Tresor',
      'Haçienda',
      'Decca Classics', 'Archiv',
    ]

    const upperText = text.toUpperCase()
    for (const label of labels) {
      if (upperText.includes(label.toUpperCase())) return label
    }
    return null
  }

  private _extractMatrixLines(lines: string[]): string[] {
    const matrixPattern = /^[A-Z0-9]{2,6}[\s-][A-Z0-9]{2,8}(?:[\s-][A-Z0-9]{1,4})*$/
    const results: string[] = []

    for (const line of lines) {
      if (matrixPattern.test(line) && line.length >= 5 && line.length <= 30) {
        results.push(line)
        if (results.length >= 4) break
      }
      if (
        /\b(STERLING|PORKY|PECKO|TML|RL|EMI|CBS|HAECO|MCA|RE|PR|WEA)\b/.test(line)
      ) {
        if (!results.includes(line)) results.push(line)
      }
    }

    return results
  }

  private _applyPressingHeuristics(
    result: OcrRecordAnalysisResult,
    matrixLines: string[]
  ): void {
    const allMatrix = matrixLines.join(' ').toUpperCase()
    const evidence: string[] = []

    if (/\bA1\b|\bB1\b/.test(allMatrix)) {
      evidence.push('A1/B1 stamper identifier found — typical of first press')
      result.isFirstPress = true
      result.pressingType = 'first_press'
      result.pressingConfidence = 'medium'
    }

    if (/\bSTERLING\b/.test(allMatrix)) {
      evidence.push('STERLING (Bob Ludwig) plant code — original US pressing')
      result.pressingConfidence = 'high'
    }
    if (/\bPORKY\b/.test(allMatrix)) {
      evidence.push('PORKY (George Peckham) hand-etch — early UK pressing')
      result.pressingConfidence = 'high'
    }
    if (/\bRL\b/.test(allMatrix)) {
      evidence.push('RL (Robert Ludwig) mastering initials')
      result.pressingConfidence = 'medium'
    }

    if (!result.isFirstPress && evidence.length === 0) {
      result.pressingType = 'unknown'
    }

    result.pressingEvidence = evidence
  }

  private _inferArtistTitle(
    result: OcrRecordAnalysisResult,
    lines: string[],
    text: string
  ): void {
    const artistKeywordMatch = text.match(
      /(?:^|\n)\s*(?:Artist|Performer|By)[:\s]+([^\n]{2,60})/im
    )
    if (artistKeywordMatch) {
      result.artist = artistKeywordMatch[1].trim()
    }

    const titleKeywordMatch = text.match(
      /(?:^|\n)\s*(?:Title|Album|Record)[:\s]+([^\n]{2,80})/im
    )
    if (titleKeywordMatch) {
      result.title = titleKeywordMatch[1].trim()
    }

    if (result.artist && result.title) return

    const tracklistLines = lines.filter((line) => this._isLikelyTracklistLine(line))
    const filteredLines = lines.filter((line) => !this._isLikelyTracklistLine(line))
    const tracklistRatio = lines.length > 0 ? tracklistLines.length / lines.length : 0

    let contiguousTracklistBlock = 0
    let maxContiguousTracklistBlock = 0
    for (const line of lines) {
      if (this._isLikelyTracklistLine(line)) {
        contiguousTracklistBlock += 1
        maxContiguousTracklistBlock = Math.max(
          maxContiguousTracklistBlock,
          contiguousTracklistBlock
        )
      } else {
        contiguousTracklistBlock = 0
      }
    }

    const hasDominantTracklist =
      tracklistLines.length >= 6 &&
      (tracklistRatio >= 0.6 ||
        (tracklistRatio >= 0.5 && maxContiguousTracklistBlock >= 6))

    const substantial = filteredLines.filter(
      (l) =>
        l.length >= 3 &&
        l.length <= 80 &&
        /[A-Za-z]{2}/.test(l) &&
        !/^[\d\s\-/\\|]+$/.test(l) &&
        !/^(side|track|stereo|mono|℗|©|\(c\))/i.test(l)
    )

    if (hasDominantTracklist) return

    if (!result.artist && substantial.length >= 1) {
      result.artist = substantial[0]
    }
    if (!result.title && substantial.length >= 2) {
      result.title = substantial[1]
    }
  }

  private _isLikelyTracklistLine(line: string): boolean {
    const normalized = line.trim()
    if (!normalized) return false
    if (normalized === '---IMAGE BREAK---') return false
    if (normalized.length < 4 || normalized.length > 80) return false

    const stripped = normalized
      .replace(/^(?:side\s*[AB12]\s*[-:.]?\s*)/i, '')
      .replace(/^(?:track\s*\d+\s*[-:.]?\s*)/i, '')
      .replace(/^\d{1,2}[).:-]?\s*/, '')
      .trim()

    if (stripped.length < 3 || stripped.length > 60) return false
    if (/[,:;()[\]{}]/.test(stripped)) return false
    if (/^(artist|title|album|record|made in|catalog|cat\.?|side)\b/i.test(stripped)) return false

    const compact = stripped.replace(/\s+/g, '')
    const digitMatches = stripped.match(/\d/g) ?? []
    const digitCount = digitMatches.length
    const letterMatches = stripped.match(/[A-Za-z]/g) ?? []
    const letterCount = letterMatches.length
    const hasDigits = digitCount > 0
    const isNumericTitle =
      /^\d{4}$/.test(stripped) ||
      /^\d+'\d{2}$/.test(stripped)
    const looksLikeCatalogCode =
      /^[A-Z]{1,5}[-/]?\d{2,}[A-Z0-9/-]*$/i.test(compact) ||
      (/^[A-Z0-9-]{6,}$/.test(compact) && /\d/.test(compact))

    if (looksLikeCatalogCode && !isNumericTitle) return false

    if (hasDigits && !isNumericTitle) {
      const significantChars = stripped.replace(/[^A-Za-z0-9]/g, '').length
      if (significantChars > 0 && digitCount / significantChars > 0.5) return false
    }

    if (!isNumericTitle && letterCount < 3) return false

    const words = stripped.split(/\s+/).filter(Boolean)
    if (words.length < (isNumericTitle ? 1 : 2) || words.length > 9) return false

    const lettersOnly = stripped.replace(/[^A-Za-z]/g, '')
    if (!lettersOnly) return isNumericTitle
    const letterChars = lettersOnly.split('')
    const uppercaseChars = letterChars.filter((c) => c === c.toUpperCase()).length
    const uppercaseRatio = uppercaseChars / letterChars.length

    return uppercaseRatio >= 0.9
  }
}

export const tesseractOCRService = new TesseractOCRService()
