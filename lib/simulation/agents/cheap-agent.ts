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
    ? await getBotContext(snapshot.simulationId, 'CHEAP', 3)
    : "Première décision de trading.";
  // Préparer les headlines pour le prompt
  const headlinesText = snapshot.newsHeadlines?.length
    ? snapshot.newsHeadlines.slice(0, 5).map((h, i) => `  ${i + 1}. ${h}`).join('\n')
    : '  Aucune actualité récente';

  // Calculer la quantité max achetable
  const maxBuyQuantity = Math.floor(portfolio.cash / snapshot.price);
  const suggestedBuyQty = Math.floor(maxBuyQuantity * 0.3); // 30% du max

  const prompt = `Vous êtes un trader actif. 

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
- Cash: ${portfolio.cash.toFixed(2)}$
- Actions: ${portfolio.shares}
- MAXIMUM ACHETABLE: ${maxBuyQuantity} actions (avec votre cash actuel)
- QUANTITÉ SUGGÉRÉE pour BUY: ${suggestedBuyQty} actions (30% du cash)

⚠️ RÈGLES CRITIQUES:
1. Pour BUY: La quantité DOIT être <= ${maxBuyQuantity} (sinon ordre rejeté!)
2. Pour SELL: La quantité DOIT être <= ${portfolio.shares}
3. ACHETEZ si sentiment > 0.3 OU RSI < 40 OU actualités positives
4. VENDEZ si RSI > 65 OU sentiment < -0.2 OU actualités négatives
5. Soyez actif, évitez HOLD systématique

Répondez en JSON strict:
{"action": "BUY"|"SELL"|"HOLD", "quantity": nombre_entier, "reason": "explication courte", "confidence": 0-1}`;

  const debugData: DebugData = {
    model: modelId,
    timestamp: new Date().toISOString()
  };

  try {
    let currentModel = modelId;
    // Modèles gratuits = pas de limite, on met beaucoup pour les thinking models
    const maxTokens = modelId.includes(':free') ? 2000 : 200;

    let response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: currentModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: maxTokens
      })
    });

    // Fallback si modèle n'existe plus (404)
    // Ordre par intelligence: gros modèles et thinking d'abord
    if (response.status === 404) {
      console.warn(`Model ${modelId} not found, trying fallback...`);
      const fallbackModels = [
        'qwen/qwen3-235b-a22b:free',           // 235B - le plus gros
        'tngtech/deepseek-r1t-chimera:free',   // Reasoning/thinking
        'allenai/olmo-3-32b-think:free',       // 32B thinking
        'nvidia/nemotron-nano-9b-v2:free',     // 9B Nvidia
        'google/gemma-3n-e4b-it:free',         // 4B Google
        'qwen/qwen3-4b:free'                   // 4B Qwen
      ];

      for (const fallback of fallbackModels) {
        if (fallback === modelId) continue; // Skip le modèle qui a fail
        currentModel = fallback;
        debugData.model = fallback;
        const fallbackMaxTokens = fallback.includes(':free') ? 2000 : 200;
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: fallback,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: fallbackMaxTokens
          })
        });

        if (response.status !== 404 && response.status !== 429) {
          console.log(`Fallback to ${fallback} successful`);
          break;
        }
      }
    }

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

    // Extraire JSON du texte (peut contenir des backticks markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      debugData.error = 'No JSON found in response';
      console.error('No JSON found in response:', content);
      throw new Error('No JSON in response');
    }
    const decision = JSON.parse(jsonMatch[0]);

    // Valider la décision
    return {
      action: decision.action || 'HOLD',
      quantity: Math.max(0, Math.floor(decision.quantity || 0)),
      reason: decision.reason || 'Décision de l\'IA',
      confidence: Math.min(1, Math.max(0, decision.confidence || 0.5)),
      tokens: debugData.totalTokens || 0,
      cost: debugData.cost || 0,
      debugData
    };
  } catch (error: any) {
    console.error('Cheap agent decision failed:', error);
    debugData.error = error.message;

    return {
      action: 'HOLD',
      quantity: 0,
      reason: 'Erreur lors de la prise de décision',
      confidence: 0,
      tokens: 0,
      cost: 0,
      debugData
    };
  }
}
