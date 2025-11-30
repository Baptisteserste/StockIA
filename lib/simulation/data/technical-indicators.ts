/**
 * Indicateurs techniques avancés
 * Calculés à partir des prix historiques
 */

import { EMA, BollingerBands, RSI, MACD, ATR, SMA } from 'technicalindicators';

export interface TechnicalIndicators {
  // RSI
  rsi: number | null;
  rsiSignal: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
  
  // MACD
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  macdTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  
  // EMA
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  emaTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  
  // Bollinger Bands
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  bollingerPosition: 'ABOVE' | 'BELOW' | 'MIDDLE';
  bollingerWidth: number | null;  // Mesure de volatilité
  
  // ATR (Average True Range) - Volatilité
  atr: number | null;
  atrPercent: number | null;  // ATR en % du prix
  
  // Score composite
  technicalScore: number;  // -1 à +1
}

export interface PriceData {
  close: number[];
  high?: number[];
  low?: number[];
}

/**
 * Calcule tous les indicateurs techniques à partir des prix historiques
 */
export function calculateTechnicalIndicators(
  prices: PriceData,
  currentPrice: number
): TechnicalIndicators {
  const closePrices = prices.close;
  
  if (closePrices.length < 30) {
    return getEmptyIndicators();
  }

  // RSI (14 périodes)
  const rsiValues = RSI.calculate({
    values: closePrices,
    period: 14
  });
  const rsi = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : null;
  const rsiSignal = getRsiSignal(rsi);

  // MACD (12, 26, 9)
  const macdValues = MACD.calculate({
    values: closePrices,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  const lastMacd = macdValues.length > 0 ? macdValues[macdValues.length - 1] : null;
  const macd = lastMacd?.MACD ?? null;
  const macdSignal = lastMacd?.signal ?? null;
  const macdHistogram = lastMacd?.histogram ?? null;
  const macdTrend = getMacdTrend(macdHistogram, macdValues);

  // EMA (9, 21, 50)
  const ema9Values = EMA.calculate({ values: closePrices, period: 9 });
  const ema21Values = EMA.calculate({ values: closePrices, period: 21 });
  const ema50Values = closePrices.length >= 50 
    ? EMA.calculate({ values: closePrices, period: 50 })
    : [];
  
  const ema9 = ema9Values.length > 0 ? ema9Values[ema9Values.length - 1] : null;
  const ema21 = ema21Values.length > 0 ? ema21Values[ema21Values.length - 1] : null;
  const ema50 = ema50Values.length > 0 ? ema50Values[ema50Values.length - 1] : null;
  const emaTrend = getEmaTrend(ema9, ema21, ema50);

  // Bollinger Bands (20, 2)
  const bbValues = BollingerBands.calculate({
    values: closePrices,
    period: 20,
    stdDev: 2
  });
  const lastBB = bbValues.length > 0 ? bbValues[bbValues.length - 1] : null;
  const bollingerUpper = lastBB?.upper ?? null;
  const bollingerMiddle = lastBB?.middle ?? null;
  const bollingerLower = lastBB?.lower ?? null;
  const bollingerPosition = getBollingerPosition(currentPrice, bollingerUpper, bollingerLower);
  const bollingerWidth = bollingerUpper && bollingerLower && bollingerMiddle
    ? (bollingerUpper - bollingerLower) / bollingerMiddle
    : null;

  // ATR (14 périodes) - nécessite high/low
  let atr: number | null = null;
  let atrPercent: number | null = null;
  
  if (prices.high && prices.low && prices.high.length >= 14) {
    const atrValues = ATR.calculate({
      high: prices.high,
      low: prices.low,
      close: closePrices,
      period: 14
    });
    atr = atrValues.length > 0 ? atrValues[atrValues.length - 1] : null;
    atrPercent = atr && currentPrice > 0 ? (atr / currentPrice) * 100 : null;
  }

  // Score composite (-1 à +1)
  const technicalScore = calculateCompositeScore({
    rsi, rsiSignal,
    macdTrend, macdHistogram,
    emaTrend,
    bollingerPosition,
    currentPrice, ema9, ema21
  });

  return {
    rsi, rsiSignal,
    macd, macdSignal, macdHistogram, macdTrend,
    ema9, ema21, ema50, emaTrend,
    bollingerUpper, bollingerMiddle, bollingerLower, bollingerPosition, bollingerWidth,
    atr, atrPercent,
    technicalScore
  };
}

function getRsiSignal(rsi: number | null): 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL' {
  if (rsi === null) return 'NEUTRAL';
  if (rsi < 30) return 'OVERSOLD';      // Signal d'achat
  if (rsi > 70) return 'OVERBOUGHT';    // Signal de vente
  return 'NEUTRAL';
}

function getMacdTrend(
  histogram: number | null,
  macdValues: any[]
): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  if (histogram === null || macdValues.length < 2) return 'NEUTRAL';
  
  const prevHistogram = macdValues[macdValues.length - 2]?.histogram;
  
  // MACD croise au-dessus de la ligne de signal
  if (histogram > 0 && (prevHistogram === undefined || prevHistogram <= 0)) {
    return 'BULLISH';
  }
  // MACD croise en-dessous de la ligne de signal
  if (histogram < 0 && (prevHistogram === undefined || prevHistogram >= 0)) {
    return 'BEARISH';
  }
  // Momentum croissant
  if (histogram > 0 && prevHistogram !== undefined && histogram > prevHistogram) {
    return 'BULLISH';
  }
  // Momentum décroissant
  if (histogram < 0 && prevHistogram !== undefined && histogram < prevHistogram) {
    return 'BEARISH';
  }
  
  return 'NEUTRAL';
}

function getEmaTrend(
  ema9: number | null,
  ema21: number | null,
  ema50: number | null
): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  if (ema9 === null || ema21 === null) return 'NEUTRAL';
  
  // Golden cross: EMA9 > EMA21 (> EMA50 si disponible)
  if (ema9 > ema21) {
    if (ema50 === null || ema21 > ema50) {
      return 'BULLISH';
    }
  }
  
  // Death cross: EMA9 < EMA21 (< EMA50 si disponible)
  if (ema9 < ema21) {
    if (ema50 === null || ema21 < ema50) {
      return 'BEARISH';
    }
  }
  
  return 'NEUTRAL';
}

function getBollingerPosition(
  price: number,
  upper: number | null,
  lower: number | null
): 'ABOVE' | 'BELOW' | 'MIDDLE' {
  if (upper === null || lower === null) return 'MIDDLE';
  
  if (price > upper) return 'ABOVE';     // Surachat
  if (price < lower) return 'BELOW';     // Survente
  return 'MIDDLE';
}

interface ScoreInputs {
  rsi: number | null;
  rsiSignal: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
  macdTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  macdHistogram: number | null;
  emaTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  bollingerPosition: 'ABOVE' | 'BELOW' | 'MIDDLE';
  currentPrice: number;
  ema9: number | null;
  ema21: number | null;
}

function calculateCompositeScore(inputs: ScoreInputs): number {
  let score = 0;
  let weights = 0;

  // RSI (poids: 25%)
  if (inputs.rsi !== null) {
    if (inputs.rsiSignal === 'OVERSOLD') score += 0.25;       // Achat
    else if (inputs.rsiSignal === 'OVERBOUGHT') score -= 0.25; // Vente
    weights += 0.25;
  }

  // MACD (poids: 25%)
  if (inputs.macdTrend !== 'NEUTRAL') {
    if (inputs.macdTrend === 'BULLISH') score += 0.25;
    else if (inputs.macdTrend === 'BEARISH') score -= 0.25;
    weights += 0.25;
  }

  // EMA Trend (poids: 30%)
  if (inputs.emaTrend !== 'NEUTRAL') {
    if (inputs.emaTrend === 'BULLISH') score += 0.30;
    else if (inputs.emaTrend === 'BEARISH') score -= 0.30;
    weights += 0.30;
  }

  // Bollinger Position (poids: 20%)
  if (inputs.bollingerPosition !== 'MIDDLE') {
    if (inputs.bollingerPosition === 'BELOW') score += 0.20;   // Achat (survente)
    else if (inputs.bollingerPosition === 'ABOVE') score -= 0.20; // Vente (surachat)
    weights += 0.20;
  }

  // Normaliser si on n'a pas tous les indicateurs
  if (weights > 0 && weights < 1) {
    score = score / weights;
  }

  // Clamp entre -1 et 1
  return Math.max(-1, Math.min(1, score));
}

function getEmptyIndicators(): TechnicalIndicators {
  return {
    rsi: null, rsiSignal: 'NEUTRAL',
    macd: null, macdSignal: null, macdHistogram: null, macdTrend: 'NEUTRAL',
    ema9: null, ema21: null, ema50: null, emaTrend: 'NEUTRAL',
    bollingerUpper: null, bollingerMiddle: null, bollingerLower: null,
    bollingerPosition: 'MIDDLE', bollingerWidth: null,
    atr: null, atrPercent: null,
    technicalScore: 0
  };
}

/**
 * Calcule le prix de stop-loss basé sur ATR
 */
export function calculateATRStopLoss(
  entryPrice: number,
  atr: number | null,
  multiplier: number = 2
): number {
  if (!atr) {
    // Fallback: 5% du prix d'entrée
    return entryPrice * 0.95;
  }
  return entryPrice - (atr * multiplier);
}

/**
 * Calcule la taille de position optimale (Kelly Criterion simplifié)
 * @param winRate - Taux de réussite historique (0-1)
 * @param avgWin - Gain moyen en %
 * @param avgLoss - Perte moyenne en %
 * @param maxPositionPercent - Position max en % du capital
 */
export function calculateKellyPosition(
  winRate: number = 0.55,
  avgWin: number = 0.10,
  avgLoss: number = 0.05,
  maxPositionPercent: number = 0.20
): number {
  // Kelly Criterion: f* = (bp - q) / b
  // où b = avgWin/avgLoss, p = winRate, q = 1-winRate
  
  const b = avgWin / avgLoss;
  const p = winRate;
  const q = 1 - winRate;
  
  const kelly = (b * p - q) / b;
  
  // Ne jamais dépasser le max et ne jamais être négatif
  return Math.max(0, Math.min(kelly, maxPositionPercent));
}
