// v2/lib/ai-valuation-agent.ts
'use server';

import { DiscogsService } from '@/components/discogs-service';
import { ValuationService } from './valuation-service';
import { VinylAppraiser } from './vinyl-appraiser';
import type { CollectionItem } from './types';

const VINYL_AGENT_SYSTEM_PROMPT = `You are Vinylasis's expert Vinyl Valuation & Pressing Identification Agent.
// ── Interfaces (kept exactly as in your original spec) ──
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  itemContext?: string;
  suggestedCorrection?: ChatCorrection;
  correctionApplied?: boolean;
}

export interface ChatCorrection {
  field: string;
  originalValue: string;
  suggestedValue: string;
  reasoning: string;
  confidence: number;
}

export interface LearningData {
  id: string;
  question: string;
  originalAnswer: string;
  userCorrection: string;
  context: {
    itemId?: string;
    artistName?: string;
    releaseTitle?: string;
  };
  timestamp: string;
  applied: boolean;
}

export interface ValuationChatResponse {
  answer: string;
  suggestedCorrections?: ChatCorrection[];
}

// ── System prompt (Vinylasis branding + strict rules) ──
const VINYLASIS_AGENT_SYSTEM_PROMPT = `You are Vinylasis's expert Vinyl Valuation & Pressing Identification Agent.

When the user asks anything about value, worth, pressing identification, matrix, price, or "what's my copy worth?", base your entire response ONLY on the intelligence data provided below.

Your response MUST be valid JSON. Inside the JSON object, put all explanatory text in the "answer" field. Follow this exact numbered structure inside "answer":

1. Pressing identification summary (catalog, label, year, country)
2. Matrix comparison and match confidence percentage
3. Tracklist note (from the full release if available; otherwise "Not available")
4. Direct clickable link to the Discogs release page (if available)
5. Recent eBay sold listings based ONLY on the sold listing data provided (dates, prices, currencies, titles, links)
6. Discogs current lowest price + want/have ratio (if available)
7. Historical trend (30-day % change, if available)
8. Composite market momentum (if available)
9. Realistic price range and clear buy/sell recommendation (only if supported by data; otherwise explain insufficient data)
10. Final one-line summary

If confidence < 80%, explicitly add: "Confidence is moderate. Please click the Discogs link to double-check the matrix yourself."

Never guess, approximate, or fabricate any numbers, conditions, or links. If data is missing for a bullet, write "Not available".`;

// ── Helpers ──
function isValuationQuestion(question: string): boolean {
  const keywords = /\b(valu|worth|price|priced|pricing|pressing|matrix|runout|deadwax|sell|sold|buy|how much|market|trend|ebay|discogs|estimate|apprais|what.?s it)\b/i;
  return keywords.test(question);
}

function extractUserMatrix(question: string): string {
  const match = question.match(/(?:matrix|runout|deadwax)\s+(?:is\s+|:?\s*)([A-Z0-9\-./\s]+(?:etched|stamped)?)/i);
  return match ? match[1].trim() : '';
}

// ── Main valuation-aware AI function ──
export async function askAboutRecord(
  question: string,
  item: CollectionItem,
  conversationHistory: ChatMessage[] = []
): Promise<ValuationChatResponse> {
  const needsIntelligence = isValuationQuestion(question);
  let intelligenceContext = '';

  if (needsIntelligence) {
    try {
      const appraiser = new VinylAppraiser();
      const valuationService = new ValuationService();

      const userMatrix = extractUserMatrix(question);

      // 1. Pressing identification (Agent 1)
      const pressingResult = await appraiser.appraise(
        `${item.artistName} ${item.releaseTitle}`,
        item.notes || '',
        [],
        userMatrix || item.matrixNumbers?.[0] || null
      );

      // 2. Full valuation with comparables (Agent 3 + Agent 2 data)
      const valuation = await valuationService.generateDetailedValuation(item);

      intelligenceContext = `
=== VINYLASIS INTELLIGENCE RESULTS ===
${pressingResult.exactPressingConfirmed}
Condition: ${pressingResult.conditionVerdict}
Market average (last ${valuation.comparableSalesCount} UK sales): ${valuation.marketAnalysis.recentAverage}
Confidence: ${Math.round(valuation.confidenceScore * 100)}%
Recommendation: ${valuation.recommendation.buyItNow}
Trend: ${valuation.marketTrend}
=== END INTELLIGENCE RESULTS ===
`;
    } catch (err) {
      console.error('[ai-valuation-agent] Intelligence cycle failed:', err);
      intelligenceContext = '(Intelligence data temporarily unavailable — answering from record metadata only.)';
    }
  }

  const systemSection = needsIntelligence
    ? `${VINYLASIS_AGENT_SYSTEM_PROMPT}\n\n${intelligenceContext}\n\n`
    : 'You are a helpful vinyl record expert assistant for Vinylasis, a professional collection management app.\n\n';

  const prompt = `${systemSection}
Context about this record:
- Artist: ${item.artistName}
- Title: ${item.releaseTitle}
- Format: ${item.format}
- Year: ${item.year}
- Country: ${item.country}
- Catalog: ${item.catalogNumber || 'Not specified'}
- Condition: ${item.condition.mediaGrade} / ${item.condition.sleeveGrade}
- Purchase: ${item.purchasePrice ? `${item.purchaseCurrency} ${item.purchasePrice}` : 'Not recorded'}
- Notes: ${item.notes || 'None'}

User question: ${question}

Previous conversation (last 4 messages):
${conversationHistory.slice(-4).map((m) => `${m.role}: ${m.content}`).join('\n')}

Answer in valid JSON only:
{
  "answer": "Your full response here following the numbered structure",
  "suggestedCorrections": [
    {
      "field": "artistName",
      "originalValue": "current value",
      "suggestedValue": "corrected value",
      "reasoning": "why this correction is suggested",
      "confidence": 0.85
    }
  ]
}
Only include suggestedCorrections if you spot obvious data quality issues.`;

  // Use existing DeepSeek service (server-side only)
  const DeepSeekService = (await import('@/components/deepseek-service')).DeepSeekService;
  const deepseek = new DeepSeekService();
  const rawResponse = await deepseek.generateCompletion(prompt, {
    model: 'deepseek-chat',
    temperature: 0.3,
    maxTokens: 1200,
  });

  try {
    const parsed = JSON.parse(rawResponse);
    return {
      answer: parsed.answer || rawResponse,
      suggestedCorrections: parsed.suggestedCorrections || [],
    };
  } catch {
    return {
      answer: rawResponse,
      suggestedCorrections: [],
    };
  }
}

// ── General collection questions (unchanged logic, now server-only) ──
export async function askGeneralQuestion(
  question: string,
  allItems: CollectionItem[],
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  const stats = {
    totalRecords: allItems.length,
    formats: allItems.reduce((acc, item) => {
      acc[item.format] = (acc[item.format] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    topArtists: Object.entries(
      allItems.reduce((acc, item) => {
        acc[item.artistName] = (acc[item.artistName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([artist, count]) => `${artist} (${count})`),
  };

  const prompt = `You are a vinyl record expert assistant for Vinylasis.
User's collection overview:
- Total records: ${stats.totalRecords}
- Formats: ${Object.entries(stats.formats).map(([f, c]) => `${f}: ${c}`).join(', ')}
- Top artists: ${stats.topArtists.join(', ')}

Previous conversation:
${conversationHistory.slice(-4).map((m) => `${m.role}: ${m.content}`).join('\n')}

User's question: ${question}

Provide a helpful, knowledgeable answer about vinyl records, collecting, grading, or their collection. Be conversational and informative.`;

  const DeepSeekService = (await import('@/components/deepseek-service')).DeepSeekService;
  const deepseek = new DeepSeekService();
  return await deepseek.generateCompletion(prompt, { model: 'deepseek-chat', temperature: 0.7 });
}

// ── Record insights (with learning feedback) ──
export async function generateRecordInsights(
  item: CollectionItem,
  learningData: LearningData[] = []
): Promise<string> {
  const relevantLearning = learningData.filter(
    (ld) => ld.context.artistName === item.artistName || ld.context.releaseTitle === item.releaseTitle
  );

  const prompt = `You are analyzing a vinyl record in Vinylasis.

Record details:
- Artist: ${item.artistName}
- Title: ${item.releaseTitle}
- Format: ${item.format}
- Year: ${item.year}
- Country: ${item.country}
- Catalog Number: ${item.catalogNumber || 'Not specified'}
- Condition: Media ${item.condition.mediaGrade} / Sleeve ${item.condition.sleeveGrade}
- Purchase Price: ${item.purchasePrice ? `${item.purchaseCurrency} ${item.purchasePrice}` : 'Not recorded'}
${relevantLearning.length > 0 ? `
Previous learning from user feedback:
${relevantLearning.map((ld) => `- Q: ${ld.question}\nOriginal: ${ld.originalAnswer}\nCorrection: ${ld.userCorrection}`).join('\n')}
` : ''}

Provide 3-5 interesting insights about this record (historical significance, pressing variations, market trends, collecting tips, notable tracks). Keep it concise and collector-focused.`;

  const DeepSeekService = (await import('@/components/deepseek-service')).DeepSeekService;
  const deepseek = new DeepSeekService();
  return await deepseek.generateCompletion(prompt, { model: 'deepseek-chat', temperature: 0.6 });
}
