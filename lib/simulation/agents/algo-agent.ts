/**
 * ALGO BOT V2 - Professional Trading Strategy
 * 
 * Features:
 * - Stop-Loss automatique (-5% du prix d'entrée)
 * - Take-Profit progressif (+15% vend 50%, +25% vend tout)
 * - Trailing Stop (-3% du plus haut atteint)
 * - Position sizing via Kelly Criterion (5-20% du capital)
 * - Score composite: technique (40%) + sentiment (40%) + fear/greed (20%)
 * - EMA crossover pour confirmation de tendance
 * - Bollinger Bands pour détecter les excès
 * - ATR pour ajuster le stop-loss dynamiquement
 */

// ============== TYPES ==============

export interface DecisionResult {
  action: 'BUY' | 'SELL' | 'HOLD';
  quantity: number;
  reason: string;
  confidence: number;
  tokens: number; // AJOUT
  cost: number;   // AJOUT
}

export interface MarketSnapshot {
  price: number;
  // Indicateurs de base
  rsi: number | null;
  macd: number | null;
  sentimentScore: number;
  sentimentReason: string;
  // Nouveaux indicateurs v2
  stocktwitsBulls?: number | null;
  stocktwitsBears?: number | null;
  fearGreedIndex?: number | null;
  fearGreedLabel?: string | null;
  ema9?: number | null;
  ema21?: number | null;
  ema50?: number | null;
  emaTrend?: string | null;
  bollingerUpper?: number | null;
  bollingerMiddle?: number | null;
  bollingerLower?: number | null;
  bollingerWidth?: number | null;
  atr?: number | null;
  atrPercent?: number | null;
  macdSignal?: number | null;
  macdHistogram?: number | null;
}

export interface Portfolio {
  cash: number;
  shares: number;
}

export interface Position {
  entryPrice: number;
  quantity: number;
  highestPrice: number; // Pour trailing stop
  entryTime: number;
}

export interface AlgoState {
  position: Position | null;
  tradeHistory: TradeRecord[];
  lastSignal: string;
}

interface TradeRecord {
  type: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  timestamp: number;
  pnl?: number;
}

// ============== CONFIGURATION ==============

const CONFIG = {
  // Risk Management
  STOP_LOSS_PERCENT: 0.04,        // -4% stop-loss
  TRAILING_STOP_PERCENT: 0.015,   // -1.5% trailing stop
  TAKE_PROFIT_1: 0.03,            // +3% → vend 25%
  TAKE_PROFIT_2: 0.06,            // +6% → vend 50%
  TAKE_PROFIT_3: 0.12,            // +12% → vend tout

  // Position Sizing - Moins de trades, positions plus grosses
  MIN_POSITION_PERCENT: 0.20,     // Min 20% du capital
  MAX_POSITION_PERCENT: 0.60,     // Max 60% du capital
  DEFAULT_POSITION_PERCENT: 0.40, // Par défaut 40% (augmenté)

  // Score Weights - 60% technique optimal selon backtest
  WEIGHT_TECHNICAL: 0.60,         // 60% technique (optimisé via backtest)
  WEIGHT_SENTIMENT: 0.28,         // 28% sentiment
  WEIGHT_FEAR_GREED: 0.12,        // 12% Fear & Greed

  // Thresholds - Zone neutre ÉLARGIE pour moins de trades
  BUY_THRESHOLD: 0.15,            // Score > 0.15 pour acheter (était 0.05)
  SELL_THRESHOLD: -0.10,          // Score < -0.10 pour vendre (était 0.00)
  STRONG_BUY_THRESHOLD: 0.30,     // Score > 0.3 = position encore plus grosse

  // Bollinger
  BOLLINGER_OVERSOLD: 0.15,       // Prix sous 15% de la bande (plus strict)
  BOLLINGER_OVERBOUGHT: 0.80,     // Prix au-dessus 80% (plus strict)

  // RSI-based profit taking
  RSI_PROFIT_TAKE: 65,            // Si RSI > 65 et en profit → vend 30%
  RSI_EXTREME_SELL: 75,           // Si RSI > 75 → vend 50%

  // TIME-AWARE TRADING
  TIME_FORCE_BUY_THRESHOLD: 0.70,
  TIME_FORCE_BUY_CASH_MIN: 0.40,
  TIME_LIQUIDATE_THRESHOLD: 0.95,
} as const;

// ============== STATE MANAGEMENT ==============

// État global pour suivre les positions (en production, ça serait en DB)
const stateByAgent = new Map<string, AlgoState>();

export function getOrCreateState(agentId: string): AlgoState {
  if (!stateByAgent.has(agentId)) {
    stateByAgent.set(agentId, {
      position: null,
      tradeHistory: [],
      lastSignal: '',
    });
  }
  return stateByAgent.get(agentId)!;
}

export function resetState(agentId: string): void {
  stateByAgent.delete(agentId);
}

// ============== SCORE CALCULATION ==============

function calculateTechnicalScore(snapshot: MarketSnapshot): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;
  let factors = 0;

  // RSI (sur-achat/sur-vente)
  if (snapshot.rsi !== null) {
    factors++;
    if (snapshot.rsi < 30) {
      score += 1;
      signals.push(`RSI oversold (${snapshot.rsi.toFixed(0)})`);
    } else if (snapshot.rsi < 40) {
      score += 0.5;
      signals.push(`RSI bas (${snapshot.rsi.toFixed(0)})`);
    } else if (snapshot.rsi > 70) {
      score -= 1;
      signals.push(`RSI overbought (${snapshot.rsi.toFixed(0)})`);
    } else if (snapshot.rsi > 60) {
      score -= 0.5;
      signals.push(`RSI haut (${snapshot.rsi.toFixed(0)})`);
    }
  }

  // MACD + Histogramme
  if (snapshot.macd !== null) {
    factors++;
    const hist = snapshot.macdHistogram;
    if (hist !== null && hist !== undefined) {
      // Histogramme croissant = momentum positif
      if (hist > 0 && snapshot.macd > 0) {
        score += 1;
        signals.push('MACD bullish + momentum');
      } else if (hist < 0 && snapshot.macd < 0) {
        score -= 1;
        signals.push('MACD bearish + momentum');
      } else if (snapshot.macd > 0) {
        score += 0.3;
        signals.push('MACD positif');
      } else {
        score -= 0.3;
        signals.push('MACD négatif');
      }
    } else {
      if (snapshot.macd > 0) {
        score += 0.5;
        signals.push('MACD positif');
      } else {
        score -= 0.5;
        signals.push('MACD négatif');
      }
    }
  }

  // EMA Trend (Golden Cross / Death Cross)
  if (snapshot.emaTrend) {
    factors++;
    switch (snapshot.emaTrend) {
      case 'strong-bullish':
        score += 1;
        signals.push('EMA Golden Cross (9>21>50)');
        break;
      case 'bullish':
        score += 0.5;
        signals.push('EMA bullish (9>21)');
        break;
      case 'strong-bearish':
        score -= 1;
        signals.push('EMA Death Cross (9<21<50)');
        break;
      case 'bearish':
        score -= 0.5;
        signals.push('EMA bearish (9<21)');
        break;
    }
  }

  // Bollinger Bands
  if (snapshot.bollingerLower && snapshot.bollingerUpper && snapshot.bollingerMiddle) {
    factors++;
    const range = snapshot.bollingerUpper - snapshot.bollingerLower;
    const position = (snapshot.price - snapshot.bollingerLower) / range;

    if (position < CONFIG.BOLLINGER_OVERSOLD) {
      score += 0.8;
      signals.push(`Prix sous Bollinger (${(position * 100).toFixed(0)}%)`);
    } else if (position > CONFIG.BOLLINGER_OVERBOUGHT) {
      score -= 0.8;
      signals.push(`Prix au-dessus Bollinger (${(position * 100).toFixed(0)}%)`);
    }

    // Squeeze = faible volatilité = breakout potentiel
    if (snapshot.bollingerWidth && snapshot.bollingerWidth < 0.02) {
      signals.push('Bollinger squeeze (breakout proche)');
    }
  }

  return {
    score: factors > 0 ? score / factors : 0,
    signals
  };
}

function calculateSentimentScore(snapshot: MarketSnapshot): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;
  let factors = 0;

  // Gemini sentiment (déjà normalisé -1 à +1)
  if (snapshot.sentimentScore !== undefined) {
    factors++;
    score += snapshot.sentimentScore;
    if (Math.abs(snapshot.sentimentScore) > 0.3) {
      signals.push(`Gemini: ${snapshot.sentimentReason?.slice(0, 50) || 'N/A'}`);
    }
  }

  // Stocktwits Bulls/Bears ratio
  const bulls = snapshot.stocktwitsBulls;
  const bears = snapshot.stocktwitsBears;
  if (bulls !== undefined && bulls !== null && bears !== undefined && bears !== null) {
    const total = bulls + bears;
    if (total > 0) {
      factors++;
      const bullRatio = bulls / total;
      // Convertir ratio 0-1 en score -1 à +1
      const stocktwitsScore = (bullRatio - 0.5) * 2;
      score += stocktwitsScore;

      if (bullRatio > 0.65) {
        signals.push(`Stocktwits très bullish (${(bullRatio * 100).toFixed(0)}% bulls)`);
      } else if (bullRatio > 0.55) {
        signals.push(`Stocktwits bullish (${(bullRatio * 100).toFixed(0)}% bulls)`);
      } else if (bullRatio < 0.35) {
        signals.push(`Stocktwits très bearish (${(bullRatio * 100).toFixed(0)}% bulls)`);
      } else if (bullRatio < 0.45) {
        signals.push(`Stocktwits bearish (${(bullRatio * 100).toFixed(0)}% bulls)`);
      }
    }
  }

  return {
    score: factors > 0 ? score / factors : 0,
    signals
  };
}

function calculateFearGreedScore(snapshot: MarketSnapshot): { score: number; signals: string[] } {
  const signals: string[] = [];
  const index = snapshot.fearGreedIndex;

  if (index === undefined || index === null) {
    return { score: 0, signals: [] };
  }

  // Stratégie CONTRARIAN : acheter quand les autres ont peur
  // Fear & Greed va de 0 (Extreme Fear) à 100 (Extreme Greed)

  let score = 0;

  if (index < 20) {
    // Extreme Fear = BUY signal (contrarian)
    score = 0.8;
    signals.push(`🔥 Extreme Fear (${index}) - Contrarian BUY`);
  } else if (index < 35) {
    // Fear = mild BUY
    score = 0.4;
    signals.push(`Fear (${index}) - Légèrement bullish`);
  } else if (index > 80) {
    // Extreme Greed = SELL signal (contrarian)
    score = -0.8;
    signals.push(`⚠️ Extreme Greed (${index}) - Contrarian SELL`);
  } else if (index > 65) {
    // Greed = mild SELL
    score = -0.4;
    signals.push(`Greed (${index}) - Légèrement bearish`);
  } else {
    signals.push(`Neutral (${index})`);
  }

  return { score, signals };
}

// ============== POSITION SIZING (Kelly Criterion) ==============

function calculatePositionSize(
  cash: number,
  price: number,
  confidence: number,
  atrPercent?: number
): number {
  // Kelly Criterion simplifié: f* = (bp - q) / b
  // où b = gain potentiel, p = proba de gagner, q = 1-p

  // On utilise la confidence comme proxy de probabilité
  const winProb = 0.5 + (confidence * 0.3); // 50-80% selon confidence
  const winRatio = 1.5; // On vise 1.5x gains vs pertes

  const kelly = (winProb * winRatio - (1 - winProb)) / winRatio;

  // Limiter Kelly (souvent trop agressif)
  const halfKelly = Math.max(0, kelly * 0.5);

  // Position en % du capital
  let positionPercent = Math.max(
    CONFIG.MIN_POSITION_PERCENT,
    Math.min(CONFIG.MAX_POSITION_PERCENT, halfKelly)
  );

  // Réduire la taille si volatilité élevée (ATR > 3%)
  if (atrPercent && atrPercent > 3) {
    positionPercent *= 0.7;
  }

  const positionValue = cash * positionPercent;
  const quantity = Math.floor(positionValue / price);

  return quantity;
}

// ============== RISK MANAGEMENT ==============

interface RiskCheck {
  shouldSell: boolean;
  reason: string;
  sellQuantity: number;
  isStopLoss: boolean;
}

function checkRiskManagement(
  position: Position,
  currentPrice: number,
  atrPercent?: number
): RiskCheck {
  const pnlPercent = (currentPrice - position.entryPrice) / position.entryPrice;
  const highestPnl = (position.highestPrice - position.entryPrice) / position.entryPrice;
  const drawdown = (position.highestPrice - currentPrice) / position.highestPrice;

  // Stop-Loss adaptatif basé sur ATR
  let stopLossPercent: number = CONFIG.STOP_LOSS_PERCENT;
  if (atrPercent && atrPercent > 0) {
    // Stop-loss = max(5%, 2 x ATR%)
    stopLossPercent = Math.max(CONFIG.STOP_LOSS_PERCENT, atrPercent * 2 / 100);
  }

  // 1. STOP-LOSS: Vendre tout si perte > stopLoss
  if (pnlPercent < -stopLossPercent) {
    return {
      shouldSell: true,
      reason: `🛑 STOP-LOSS déclenché: ${(pnlPercent * 100).toFixed(1)}% (seuil: ${(stopLossPercent * 100).toFixed(1)}%)`,
      sellQuantity: position.quantity,
      isStopLoss: true
    };
  }

  // 2. TRAILING STOP: Si on était en profit et qu'on recule trop
  if (highestPnl > 0.05 && drawdown > CONFIG.TRAILING_STOP_PERCENT) {
    return {
      shouldSell: true,
      reason: `📉 TRAILING STOP: Drawdown ${(drawdown * 100).toFixed(1)}% depuis le plus haut`,
      sellQuantity: position.quantity,
      isStopLoss: true
    };
  }

  // 3. TAKE-PROFIT niveau 3: +20% → vendre tout
  if (pnlPercent >= CONFIG.TAKE_PROFIT_3) {
    return {
      shouldSell: true,
      reason: `🚀 TAKE-PROFIT 3: +${(pnlPercent * 100).toFixed(1)}% - Jackpot! Vente totale`,
      sellQuantity: position.quantity,
      isStopLoss: false
    };
  }

  // 4. TAKE-PROFIT niveau 2: +10% → vendre 50%
  if (pnlPercent >= CONFIG.TAKE_PROFIT_2) {
    const sellQty = Math.floor(position.quantity / 2);
    if (sellQty > 0) {
      return {
        shouldSell: true,
        reason: `🎯 TAKE-PROFIT 2: +${(pnlPercent * 100).toFixed(1)}% - Sécuriser 50%`,
        sellQuantity: sellQty,
        isStopLoss: false
      };
    }
  }

  // 5. TAKE-PROFIT niveau 1: +5% → vendre 25%
  if (pnlPercent >= CONFIG.TAKE_PROFIT_1) {
    const sellQty = Math.floor(position.quantity / 4);
    if (sellQty > 0) {
      return {
        shouldSell: true,
        reason: `💰 TAKE-PROFIT 1: +${(pnlPercent * 100).toFixed(1)}% - Profit rapide 25%`,
        sellQuantity: sellQty,
        isStopLoss: false
      };
    }
  }

  return {
    shouldSell: false,
    reason: '',
    sellQuantity: 0,
    isStopLoss: false
  };
}

// ============== MAIN DECISION FUNCTION ==============

export function decide(
  snapshot: MarketSnapshot,
  portfolio: Portfolio,
  agentId: string = 'algo-default',
  weightTechnical?: number, // 0-100, override CONFIG if provided
  currentDay?: number,      // Jour actuel de la simulation
  durationDays?: number     // Durée totale de la simulation
): DecisionResult {
  const state = getOrCreateState(agentId);
  const { price } = snapshot;
  const { cash, shares } = portfolio;

  // Mettre à jour le plus haut prix si en position
  if (state.position && price > state.position.highestPrice) {
    state.position.highestPrice = price;
  }

  // ========== TIME-AWARE TRADING ==========
  const timeProgress = (currentDay && durationDays) ? currentDay / durationDays : 0;
  const totalValue = cash + shares * price;
  const cashPercent = cash / totalValue;

  // LIQUIDATION: Si >95% de la durée écoulée et on a des positions → tout vendre
  if (timeProgress >= CONFIG.TIME_LIQUIDATE_THRESHOLD && shares > 0) {
    if (state.position) {
      state.position.quantity = 0;
      state.position = null;
    }
    state.tradeHistory.push({ type: 'SELL', price, quantity: shares, timestamp: Date.now() });

    return {
      action: 'SELL',
      quantity: shares,
      reason: `⏰ LIQUIDATION FIN DE SIMULATION: Jour ${currentDay}/${durationDays} (${(timeProgress * 100).toFixed(0)}%)`,
      confidence: 0.99,
      tokens: 0,
      cost: 0
    };
  }

  // FORCE BUY: Si >70% de la durée et encore beaucoup de cash → forcer un achat
  if (timeProgress >= CONFIG.TIME_FORCE_BUY_THRESHOLD &&
    cashPercent > CONFIG.TIME_FORCE_BUY_CASH_MIN &&
    cash >= price) {
    const forceQuantity = Math.floor((cash * 0.5) / price); // Déployer 50% du cash restant

    if (forceQuantity > 0) {
      if (!state.position) {
        state.position = { entryPrice: price, quantity: forceQuantity, highestPrice: price, entryTime: Date.now() };
      } else {
        const totalQty = state.position.quantity + forceQuantity;
        state.position.entryPrice = (state.position.entryPrice * state.position.quantity + price * forceQuantity) / totalQty;
        state.position.quantity = totalQty;
      }
      state.tradeHistory.push({ type: 'BUY', price, quantity: forceQuantity, timestamp: Date.now() });

      return {
        action: 'BUY',
        quantity: forceQuantity,
        reason: `⏰ FORCE BUY: ${(cashPercent * 100).toFixed(0)}% cash inutilisé au jour ${currentDay}/${durationDays}`,
        confidence: 0.80,
        tokens: 0,
        cost: 0
      };
    }
  }

  // ========== RISK MANAGEMENT CHECK ==========
  if (state.position && state.position.quantity > 0) {
    const atrPct = snapshot.atrPercent ?? undefined;
    const riskCheck = checkRiskManagement(state.position, price, atrPct);

    if (riskCheck.shouldSell) {
      const sellQty = Math.min(riskCheck.sellQuantity, shares);

      if (sellQty > 0) {
        // Mettre à jour l'état
        state.position.quantity -= sellQty;
        if (state.position.quantity <= 0) {
          state.position = null;
        }

        state.tradeHistory.push({
          type: 'SELL',
          price,
          quantity: sellQty,
          timestamp: Date.now(),
          pnl: (price - (state.position?.entryPrice || price)) * sellQty
        });

        return {
          action: 'SELL',
          quantity: sellQty,
          reason: riskCheck.reason,
          confidence: 0.95,
          tokens: 0,
          cost: 0
        };
      }
    }
  }

  // ========== RSI-BASED PROFIT TAKING ==========
  if (shares > 0 && snapshot.rsi !== null) {
    const rsi = snapshot.rsi;

    // RSI extrême (>75) → Vendre 50% même sans signal négatif
    if (rsi > CONFIG.RSI_EXTREME_SELL) {
      const sellQty = Math.floor(shares / 2);
      if (sellQty > 0) {
        if (state.position) {
          state.position.quantity -= sellQty;
          if (state.position.quantity <= 0) state.position = null;
        }
        state.tradeHistory.push({ type: 'SELL', price, quantity: sellQty, timestamp: Date.now() });

        return {
          action: 'SELL',
          quantity: sellQty,
          reason: `⚠️ RSI EXTRÊME: ${rsi.toFixed(0)} - Suracheté! Vente 50%`,
          confidence: 0.85,
          tokens: 0,
          cost: 0
        };
      }
    }

    // RSI élevé (>65) + en profit → Vendre 30%
    if (rsi > CONFIG.RSI_PROFIT_TAKE && state.position) {
      const pnl = (price - state.position.entryPrice) / state.position.entryPrice;
      if (pnl > 0.02) { // Au moins +2% de profit
        const sellQty = Math.floor(shares * 0.3);
        if (sellQty > 0) {
          state.position.quantity -= sellQty;
          if (state.position.quantity <= 0) state.position = null;
          state.tradeHistory.push({ type: 'SELL', price, quantity: sellQty, timestamp: Date.now() });

          return {
            action: 'SELL',
            quantity: sellQty,
            reason: `📊 RSI haut + profit: RSI=${rsi.toFixed(0)}, +${(pnl * 100).toFixed(1)}% - Sécuriser 30%`,
            confidence: 0.75,
            tokens: 0,
            cost: 0
          };
        }
      }
    }
  }

  // ========== CALCULATE COMPOSITE SCORE ==========
  const technical = calculateTechnicalScore(snapshot);
  const sentiment = calculateSentimentScore(snapshot);
  const fearGreed = calculateFearGreedScore(snapshot);

  // Use dynamic weights if provided (0-100 scale), else use CONFIG
  const techWeight = weightTechnical !== undefined
    ? weightTechnical / 100
    : CONFIG.WEIGHT_TECHNICAL;
  const sentWeight = weightTechnical !== undefined
    ? (100 - weightTechnical) / 100 * 0.85  // 85% of remaining goes to sentiment
    : CONFIG.WEIGHT_SENTIMENT;
  const fgWeight = weightTechnical !== undefined
    ? (100 - weightTechnical) / 100 * 0.15  // 15% of remaining goes to fear/greed
    : CONFIG.WEIGHT_FEAR_GREED;

  const compositeScore =
    technical.score * techWeight +
    sentiment.score * sentWeight +
    fearGreed.score * fgWeight;

  const allSignals = [...technical.signals, ...sentiment.signals, ...fearGreed.signals];
  const signalSummary = allSignals.slice(0, 4).join(' | '); // Max 4 signaux

  // ========== BUY DECISION ==========
  if (compositeScore > CONFIG.BUY_THRESHOLD && cash >= price) {
    // Ne pas acheter si on a déjà une grosse position
    const currentValue = shares * price;
    const totalValue = cash + currentValue;
    const currentAllocation = currentValue / totalValue;

    if (currentAllocation < CONFIG.MAX_POSITION_PERCENT) {
      // Position sizing
      const confidence = Math.min((compositeScore - CONFIG.BUY_THRESHOLD) / 0.5, 1);
      const atrPct = snapshot.atrPercent ?? undefined;
      let quantity = calculatePositionSize(cash, price, confidence, atrPct);

      // Augmenter position si signal très fort
      if (compositeScore > CONFIG.STRONG_BUY_THRESHOLD) {
        quantity = Math.floor(quantity * 1.5);
      }

      // Ne pas dépasser le cash disponible
      quantity = Math.min(quantity, Math.floor(cash / price));

      if (quantity > 0) {
        // Créer ou mettre à jour la position
        if (!state.position) {
          state.position = {
            entryPrice: price,
            quantity: quantity,
            highestPrice: price,
            entryTime: Date.now()
          };
        } else {
          // Moyenner le prix d'entrée
          const totalQty = state.position.quantity + quantity;
          state.position.entryPrice =
            (state.position.entryPrice * state.position.quantity + price * quantity) / totalQty;
          state.position.quantity = totalQty;
        }

        state.tradeHistory.push({
          type: 'BUY',
          price,
          quantity,
          timestamp: Date.now()
        });

        const emoji = compositeScore > CONFIG.STRONG_BUY_THRESHOLD ? '🚀' : '📈';
        return {
          action: 'BUY',
          quantity,
          reason: `${emoji} Score: ${compositeScore.toFixed(2)} | ${signalSummary}`,
          confidence,
          tokens: 0,
          cost: 0
        };
      }
    }
  }

  // ========== SELL DECISION (Signal-based) ==========
  if (compositeScore < CONFIG.SELL_THRESHOLD && shares > 0) {
    const confidence = Math.min((Math.abs(compositeScore) - Math.abs(CONFIG.SELL_THRESHOLD)) / 0.5, 1);

    // Vendre proportionnellement à la force du signal
    let sellPercent = 0.3; // Par défaut 30%
    if (compositeScore < -0.6) {
      sellPercent = 0.7; // Signal fort = 70%
    } else if (compositeScore < -0.5) {
      sellPercent = 0.5; // Signal moyen = 50%
    }

    const quantity = Math.max(1, Math.floor(shares * sellPercent));

    if (state.position) {
      state.position.quantity -= quantity;
      if (state.position.quantity <= 0) {
        state.position = null;
      }
    }

    state.tradeHistory.push({
      type: 'SELL',
      price,
      quantity,
      timestamp: Date.now()
    });

    return {
      action: 'SELL',
      quantity,
      reason: `📉 Score: ${compositeScore.toFixed(2)} | ${signalSummary}`,
      confidence,
      tokens: 0,
      cost: 0
    };
  }

  // ========== HOLD ==========
  const holdReason = state.position
    ? `Position ouverte à $${state.position.entryPrice.toFixed(2)} | Score: ${compositeScore.toFixed(2)}`
    : `Attente signal | Score: ${compositeScore.toFixed(2)}`;

  return {
    action: 'HOLD',
    quantity: 0,
    reason: `⏳ ${holdReason}`,
    confidence: 0.5,
    tokens: 0,
    cost: 0
  };
}

// ============== UTILITY EXPORTS ==============

export function getTradeHistory(agentId: string): TradeRecord[] {
  return getOrCreateState(agentId).tradeHistory;
}

export function getPosition(agentId: string): Position | null {
  return getOrCreateState(agentId).position;
}

export { CONFIG as ALGO_CONFIG };
