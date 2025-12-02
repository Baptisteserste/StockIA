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

  const prompt = `Vous êtes un trader professionnel expérimenté. 

Contexte précédent:
${context}

Données actuelles:
- Prix: ${snapshot.price}$
- RSI: ${snapshot.rsi ?? 'N/A'}
- MACD: ${snapshot.macd ?? 'N/A'}
- Sentiment: ${snapshot.sentimentScore} (${snapshot.sentimentReason})

Votre portefeuille:
- Cash: ${portfolio.cash}$
- Actions: ${portfolio.shares}

Règles:
- LONG-ONLY: Ne vendez que si vous possédez des actions (shares > 0)
- Analysez les indicateurs techniques et le sentiment pour prendre une décision éclairée
- Si certains indicateurs sont "N/A", basez-vous sur les autres données disponibles (Prix, Sentiment, etc.)
- Décidez intelligemment entre BUY, SELL ou HOLD

Répondez en JSON strict:
{"action": "BUY"|"SELL"|"HOLD", "quantity": nombre, "reason": "explication détaillée de votre analyse", "confidence": 0-1}`;

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
        max_tokens: 250
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

    // Extraire JSON du texte (peut contenir des backticks markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', content);
      throw new Error('No JSON in response');
    }

    let decision;
    try {
      decision = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Failed to parse JSON:', jsonMatch[0]);
      throw new Error('Invalid JSON format');
    }

    // Valider la décision
    return {
      action: decision.action || 'HOLD',
      quantity: Math.max(0, Math.floor(decision.quantity || 0)),
      reason: decision.reason || 'Décision de l\'IA',
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
