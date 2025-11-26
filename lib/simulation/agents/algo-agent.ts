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

interface AlgoConfig {
  weightTechnical: number;
  weightSentiment: number;
}

export function decide(
  snapshot: MarketSnapshot,
  portfolio: Portfolio,
  config: AlgoConfig = { weightTechnical: 60, weightSentiment: 40 }
): DecisionResult {
  const { rsi, macd, sentimentScore, price } = snapshot;
  const { cash, shares } = portfolio;
  const { weightTechnical, weightSentiment } = config;

  // Calcul score technique
  let technicalScore = 0;
  let technicalSignals: string[] = [];

  if (rsi !== null) {
    if (rsi < 30) {
      technicalScore += 1;
      technicalSignals.push('RSI oversold');
    } else if (rsi > 70) {
      technicalScore -= 1;
      technicalSignals.push('RSI overbought');
    }
  }

  if (macd !== null) {
    if (macd > 0) {
      technicalScore += 1;
      technicalSignals.push('MACD positif');
    } else {
      technicalScore -= 1;
      technicalSignals.push('MACD négatif');
    }
  }

  // Normaliser le score technique
  technicalScore /= 3;

  // Score final pondéré
  const totalWeight = weightTechnical + weightSentiment;
  const finalScore = (
    (technicalScore * weightTechnical) + 
    (sentimentScore * weightSentiment)
  ) / totalWeight;

  // Décision BUY
  if (finalScore > 0.3 && cash >= price) {
    const quantity = Math.floor(cash / price / 3); // Acheter 1/3 du possible
    if (quantity > 0) {
      return {
        action: 'BUY',
        quantity,
        reason: `Score positif ${finalScore.toFixed(2)} - ${technicalSignals.join(', ')}`,
        confidence: Math.min(finalScore, 1)
      };
    }
  }

  // Décision SELL
  if (finalScore < -0.3 && shares > 0) {
    const quantity = Math.floor(shares / 2); // Vendre moitié
    if (quantity > 0) {
      return {
        action: 'SELL',
        quantity,
        reason: `Score négatif ${finalScore.toFixed(2)} - ${technicalSignals.join(', ')}`,
        confidence: Math.min(Math.abs(finalScore), 1)
      };
    }
  }

  // Par défaut HOLD
  return {
    action: 'HOLD',
    quantity: 0,
    reason: `Score neutre ${finalScore.toFixed(2)} - Attente de meilleurs signaux`,
    confidence: 0.5
  };
}
