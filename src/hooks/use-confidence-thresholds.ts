import { useKV } from '@github/spark/hooks'

interface ConfidenceThresholds {
  imageClassification: number
  pressingIdentification: number
  conditionGrading: number
  bargainDetection: number
}

const defaultThresholds: ConfidenceThresholds = {
  imageClassification: 75,
  pressingIdentification: 70,
  conditionGrading: 65,
  bargainDetection: 80,
}

export function useConfidenceThresholds() {
  const [thresholds] = useKV<ConfidenceThresholds>(
    'vinyl-vault-confidence-thresholds',
    defaultThresholds
  )

  const checkConfidence = (type: keyof ConfidenceThresholds, score: number): boolean => {
    const threshold = thresholds?.[type] ?? defaultThresholds[type]
    return score >= threshold / 100
  }

  const getThreshold = (type: keyof ConfidenceThresholds): number => {
    return thresholds?.[type] ?? defaultThresholds[type]
  }

  const getConfidenceBand = (score: number): 'high' | 'medium' | 'low' | 'ambiguous' => {
    if (score >= 0.80) return 'high'
    if (score >= 0.60) return 'medium'
    if (score >= 0.40) return 'low'
    return 'ambiguous'
  }

  const shouldAutoMatch = (type: keyof ConfidenceThresholds, score: number): boolean => {
    return checkConfidence(type, score)
  }

  return {
    thresholds: thresholds ?? defaultThresholds,
    checkConfidence,
    getThreshold,
    getConfidenceBand,
    shouldAutoMatch,
  }
}
