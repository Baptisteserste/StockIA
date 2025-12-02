import { jsonrepair } from 'jsonrepair';
import { getBotContext } from '../bot-context';

interface DecisionResult {
  action: 'BUY' | 'SELL' | 'HOLD';
  quantity: number;
  reason: string;
  confidence: number;
}

interface MarketSnapshot {
  price: number;
  rsi: number | null;
  macd: number | null;
  sentimentScore: number;
  sentimentReason: string;
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

  const prompt = `Tu es une API JSON. Réponds UNIQUEMENT en JSON strict.
  
  Trader Pro. Objectif: Performance Max.

Contexte:
${context}

Marché:
- Prix: ${snapshot.price}$
- RSI: ${snapshot.rsi ?? 'N/A'}
- MACD: ${snapshot.macd ?? 'N/A'}
- Sentiment: ${snapshot.sentimentScore} (${snapshot.sentimentReason})

Portfolio:
- Cash: ${portfolio.cash}$
- Actions: ${portfolio.shares}

Règles:
1. LONG-ONLY (Pas de short).
2. Si indicateurs "N/A": Utilise Prix/Sentiment.
3. CONCISION EXTRÊME: "reason" doit faire MOINS DE 20 MOTS.

JSON attendu:
{"action": "BUY"|"SELL"|"HOLD", "quantity": number, "reason": "Court (<20 mots)", "confidence": 0-1}`;

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
        max_tokens: 1000 // Augmenté pour éviter la troncature
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Gérer les erreurs de l'API
    if (data.error) {
      console.error('OpenRouter error:', data.error);
      throw new Error(data.error.message || 'OpenRouter API error');
    }

    let content = data.choices?.[0]?.message?.content || '';

    // Certains modèles (reasoning) mettent le contenu dans reasoning
    if (!content && data.choices?.[0]?.message?.reasoning) {
      console.warn('Model returned reasoning instead of content, using fallback');
      throw new Error('Model returned empty content');
    }

    if (!content) {
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
      // Si on a le début mais pas la fin (tronqué), on prend tout depuis le début
      cleanContent = cleanContent.substring(firstBrace);
    }

    let decision;
    try {
      // Tentative 1: jsonrepair (magique pour les JSON tronqués ou malformés)
      const repaired = jsonrepair(cleanContent);
      decision = JSON.parse(repaired);
    } catch (e) {
      console.warn('jsonrepair failed, trying regex fallback. Error:', e);

      // Tentative 2: Fallback Regex "Sauve qui peut"
      // On cherche juste l'action et la quantité, le reste on met des valeurs par défaut
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
      confidence: Math.min(1, Math.max(0, decision.confidence || 0.5))
    };
  } catch (error: any) {
    console.error('Premium agent decision failed:', error.message);
    if (error.cause) console.error('Cause:', error.cause);

    return {
      action: 'HOLD',
      quantity: 0,
      reason: `Erreur lors de la prise de décision: ${error.message}`,
      confidence: 0
    };
  }
}
