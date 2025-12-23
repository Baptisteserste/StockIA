import { jsonrepair } from 'jsonrepair';
import { getBotContext } from '../bot-context';

interface DecisionResult {
  action: 'BUY' | 'SELL' | 'HOLD';
  quantity: number;
  reason: string;
  confidence: number;
  tokens?: number;
  cost?: number;
  debugData?: DebugData;
}

interface DebugData {
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  finishReason?: string;
  rawResponse?: string;
  error?: string;
  timestamp: string;
  cost?: number;
}

interface MarketSnapshot {
  price: number;
  rsi: number | null;
  macd: number | null;
  sentimentScore: number;
  sentimentReason: string;
  newsHeadlines?: string[];  // Titres des dernières news
}

interface Portfolio {
  cash: number;
  shares: number;
}

export async function decide(
  snapshot: MarketSnapshot & { simulationId?: string },
  portfolio: Portfolio,
  modelId: string
): Promise<DecisionResult> {
  const context = snapshot.simulationId
    ? await getBotContext(snapshot.simulationId, 'PREMIUM', 3)
    : "Première décision de trading.";
  // Préparer les headlines pour le prompt
  const headlinesText = snapshot.newsHeadlines?.length
    ? snapshot.newsHeadlines.slice(0, 5).map((h, i) => `  ${i + 1}. ${h}`).join('\n')
    : '  Aucune actualité récente';

  const prompt = `Vous êtes un trader professionnel expérimenté.

Contexte précédent:
${context}

Données actuelles:
- Prix: ${snapshot.price}$
- RSI: ${snapshot.rsi ?? 'N/A'}
- MACD: ${snapshot.macd ?? 'N/A'}
- Sentiment: ${snapshot.sentimentScore} (${snapshot.sentimentReason})

Actualités récentes (ANALYSEZ-LES pour votre décision):
${headlinesText}

Votre portefeuille:
- Cash: ${portfolio.cash}$
- Actions: ${portfolio.shares}

Règles de trading (SUIVEZ-LES STRICTEMENT) :
1. ACHETEZ si: sentiment > 0.3 OU RSI < 40 OU actualités très positives
2. VENDEZ si vous avez des actions ET: RSI > 65 OU sentiment < -0.2 OU actualités négatives
3. Ne faites PAS HOLD tout le temps - soyez actif !
4. Quantité: utilisez 20-50% de votre cash pour acheter, vendez 50-100% de vos actions

Répondez en JSON strict:
{"action": "BUY"|"SELL"|"HOLD", "quantity": nombre, "reason": "analyse concise basée sur les actualités", "confidence": 0-1}`;

  const debugData: DebugData = {
    model: modelId,
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      debugData.error = `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`OpenRouter API failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Capturer les infos de debug
    if (data.usage) {
      debugData.promptTokens = data.usage.prompt_tokens;
      debugData.completionTokens = data.usage.completion_tokens;
      debugData.totalTokens = data.usage.total_tokens;
      debugData.cost = data.usage.cost;
    }
    debugData.finishReason = data.choices?.[0]?.finish_reason;

    // Gérer les erreurs de l'API
    if (data.error) {
      debugData.error = JSON.stringify(data.error);
      console.error('OpenRouter error:', data.error);
      throw new Error(data.error.message || 'OpenRouter API error');
    }

    let content = data.choices?.[0]?.message?.content || '';
    debugData.rawResponse = content.substring(0, 500); // Limiter la taille

    // Certains modèles (reasoning) mettent le contenu dans reasoning
    if (!content && data.choices?.[0]?.message?.reasoning) {
      console.warn('Model returned reasoning instead of content, using fallback');
      throw new Error('Model returned empty content');
    }

    if (!content) {
      debugData.error = 'Empty response from model';
      console.error('Empty response from model:', JSON.stringify(data));
      throw new Error('Empty response from model');
    }

    // Nettoyage basique (enlève markdown ```json ... ```)
    let cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();

    // Extraction du bloc JSON si possible (pour aider jsonrepair)
    const firstBrace = cleanContent.indexOf('{');
    const lastBrace = cleanContent.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanContent = cleanContent.substring(firstBrace, lastBrace + 1);
    } else if (firstBrace !== -1) {
      cleanContent = cleanContent.substring(firstBrace);
    }

    let decision;
    try {
      const repaired = jsonrepair(cleanContent);
      decision = JSON.parse(repaired);
    } catch (e) {
      console.warn('jsonrepair failed, trying regex fallback. Error:', e);

      const actionMatch = content.match(/"action"\s*:\s*"?(BUY|SELL|HOLD)"?/i);
      const quantityMatch = content.match(/"quantity"\s*:\s*(\d+(\.\d+)?)/);

      if (actionMatch) {
        console.log('Regex fallback successful');
        decision = {
          action: actionMatch[1].toUpperCase(),
          quantity: quantityMatch ? parseFloat(quantityMatch[1]) : 0,
          reason: "Récupéré via fallback (JSON invalide)",
          confidence: 0.5
        };
      } else {
        throw new Error(`Failed to parse JSON and fallback failed: ${(e as Error).message}`);
      }
    }

    // Valider la décision
    const safeAction = (decision.action as 'BUY' | 'SELL' | 'HOLD') || 'HOLD';
    const safeQuantity = safeAction === 'HOLD' ? 0 : Math.max(0, Math.floor(decision.quantity || 0));

    return {
      action: safeAction,
      quantity: safeQuantity,
      reason: decision.reason || 'Décision de l\'IA (Recovered)',
      confidence: Math.min(1, Math.max(0, decision.confidence || 0.5)),
      tokens: debugData.totalTokens || 0,
      cost: debugData.cost || 0,
      debugData
    };
  } catch (error: any) {
    console.error('Premium agent decision failed:', error.message);
    debugData.error = error.message;

    return {
      action: 'HOLD',
      quantity: 0,
      reason: `Erreur lors de la prise de décision: ${error.message}`,
      confidence: 0,
      tokens: 0,
      cost: 0,
      debugData
    };
  }
}
