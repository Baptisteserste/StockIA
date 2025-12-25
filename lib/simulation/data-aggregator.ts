import prisma from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RSI, MACD } from 'technicalindicators';
import Snoowrap from 'snoowrap';
import { fetchStocktwitsSentiment } from './data/stocktwits';
import { fetchFearGreedIndex } from './data/fear-greed';
import { calculateTechnicalIndicators as calcTechIndicators, TechnicalIndicators, PriceData } from './data/technical-indicators';

interface MarketSnapshotData {
  simulationId: string;
  symbol: string;
  price: number;
  sentimentScore: number;
  sentimentReason: string;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  redditHype: number | null;
  // Stocktwits
  stocktwitsBulls: number | null;
  stocktwitsBears: number | null;
  stocktwitsVolume: number | null;
  // Fear & Greed
  fearGreedIndex: number | null;
  fearGreedLabel: string | null;
  // EMA
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  emaTrend: string | null;
  // Bollinger
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  bollingerWidth: number | null;
  // ATR
  atr: number | null;
  atrPercent: number | null;
  // News headlines pour les agents LLM
  newsHeadlines?: string[];
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries reached');
}

async function fetchWithFallback<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error('API call failed, using fallback:', error);
    return fallback;
  }
}



async function fetchFinnhubData(symbol: string) {
  const apiKey = process.env.FINNHUB_API_KEY;
  const baseUrl = 'https://finnhub.io/api/v1';

  // Prix actuel
  const quoteRes = await fetch(`${baseUrl}/quote?symbol=${symbol}&token=${apiKey}`);
  const quote = await quoteRes.json();

  if (!quote.c) {
    throw new Error(`Invalid symbol or no data available for ${symbol}`);
  }

  // News dernières 24h
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const to = new Date().toISOString().split('T')[0];
  const newsRes = await fetch(`${baseUrl}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${apiKey}`);
  const newsRaw = await newsRes.json();
  const news = (Array.isArray(newsRaw) ? newsRaw : []).slice(0, 10);

  // Prix historiques 30 jours pour calculs techniques
  // Stratégie : Tenter Finnhub (payant), fallback sur Yahoo Finance (gratuit)
  let candles = null;

  // 1. Essai Finnhub
  try {
    const from30d = Math.floor((Date.now() - 45 * 24 * 60 * 60 * 1000) / 1000); // 45 jours pour être sûr d'avoir 30 candles
    const toNow = Math.floor(Date.now() / 1000);
    const candlesRes = await fetch(`${baseUrl}/stock/candle?symbol=${symbol}&resolution=D&from=${from30d}&to=${toNow}&token=${apiKey}`);
    const candlesData = await candlesRes.json();

    if (candlesData.s === 'ok' && candlesData.c && candlesData.c.length >= 30) {
      candles = candlesData;
    } else if (candlesData.error) {
      console.warn('Finnhub candles not available (free plan limitation):', candlesData.error);
    }
  } catch (error) {
    console.warn('Finnhub candles fetch failed:', error);
  }

  // 2. Fallback Yahoo Finance si pas de candles Finnhub
  if (!candles) {
    try {
      console.log(`Fetching historical data for ${symbol} from Yahoo Finance...`);

      const now = Math.floor(Date.now() / 1000);
      const from60d = now - 60 * 24 * 60 * 60; // 60 jours

      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${from60d}&period2=${now}&interval=1d`;

      const yahooRes = await fetch(yahooUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (yahooRes.ok) {
        const yahooData = await yahooRes.json();
        const result = yahooData.chart?.result?.[0];

        if (result && result.indicators?.quote?.[0]) {
          const timestamps = result.timestamp || [];
          const quote = result.indicators.quote[0];

          // Filtrer les données valides
          const validIndices = timestamps.map((_: any, i: number) => i)
            .filter((i: number) => quote.close?.[i] !== null);

          if (validIndices.length >= 30) {
            candles = {
              c: validIndices.map((i: number) => quote.close[i]),
              h: validIndices.map((i: number) => quote.high?.[i] || quote.close[i]),
              l: validIndices.map((i: number) => quote.low?.[i] || quote.close[i]),
              o: validIndices.map((i: number) => quote.open?.[i] || quote.close[i]),
              v: validIndices.map((i: number) => quote.volume?.[i] || 0),
              t: validIndices.map((i: number) => timestamps[i]),
              s: 'ok'
            };
            console.log(`Successfully fetched ${candles.c.length} candles from Yahoo Finance`);
          }
        }
      }
    } catch (error) {
      console.error('Yahoo Finance fetch failed:', error);
    }
  }

  return {
    currentPrice: quote.c,
    news,
    candles
  };
}

async function calculateTechnicalIndicators(candles: any) {
  if (!candles || !candles.c || candles.c.length < 30) {
    return { rsi: null, macd: null };
  }

  const closePrices = candles.c;

  // RSI (14 périodes)
  const rsiValues = RSI.calculate({
    values: closePrices,
    period: 14
  });

  // MACD (12, 26, 9)
  const macdValues = MACD.calculate({
    values: closePrices,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });

  return {
    rsi: rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : null,
    macd: macdValues.length > 0 ? macdValues[macdValues.length - 1].MACD : null
  };
}

async function analyzeSentimentWithGemini(symbol: string, news: any[]) {
  // Utilise Google Gemini 2.5-flash-lite pour le sentiment
  if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not set, using default neutral sentiment');
    return { score: 0, reason: 'Analyse de sentiment indisponible (clé API manquante)' };
  }

  if (news.length === 0) {
    return { score: 0, reason: 'Aucune news disponible pour analyse' };
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const headlines = news.map(n => n.headline).join('\n');
    const prompt = `Analyse le sentiment global de ces titres financiers pour ${symbol}.

Retourne un objet JSON avec:
- score: nombre entre -1 (très négatif) et 1 (très positif)
- reason: résumé en 20 mots max

Titres:
${headlines}

JSON:`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extraire JSON du texte (peut contenir des backticks markdown)
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return JSON.parse(text);
  } catch (error) {
    console.error('Sentiment analysis failed:', error);
    return { score: 0, reason: 'Erreur lors de l\'analyse de sentiment' };
  }
}

async function scrapeRedditHype(symbol: string): Promise<number | null> {
  if (
    !process.env.REDDIT_CLIENT_ID ||
    !process.env.REDDIT_CLIENT_SECRET ||
    !process.env.REDDIT_USERNAME ||
    !process.env.REDDIT_PASSWORD
  ) {
    console.warn('Reddit credentials not set, skipping Reddit scraping');
    return null;
  }

  try {
    const reddit = new Snoowrap({
      userAgent: 'StockIA Trading Simulator v1.0',
      clientId: process.env.REDDIT_CLIENT_ID,
      clientSecret: process.env.REDDIT_CLIENT_SECRET,
      username: process.env.REDDIT_USERNAME,
      password: process.env.REDDIT_PASSWORD
    });

    const posts = await reddit
      .getSubreddit('wallstreetbets')
      .search({ query: symbol, time: 'day' })
      .then((results: any) => results.slice(0, 25));

    if (posts.length === 0) {
      return 0;
    }

    // Calculer score basé sur upvotes et ratio
    const hypeScore = posts.reduce((sum: number, p: any) => {
      return sum + (p.upvote_ratio * p.score);
    }, 0) / posts.length;

    // Normaliser sur échelle 0-10
    return Math.min(hypeScore / 100, 10);
  } catch (error) {
    console.error('Reddit scraping failed:', error);
    return null;
  }
}

export async function createMarketSnapshot(
  simulationId: string,
  symbol: string,
  useReddit: boolean
): Promise<MarketSnapshotData> {
  console.log(`Creating market snapshot for ${symbol}...`);

  // Fetch toutes les données en parallèle
  const [finnhubData, redditHype, stocktwitsData, fearGreedData] = await Promise.all([
    fetchFinnhubData(symbol),
    useReddit ? fetchWithFallback(() => scrapeRedditHype(symbol), null) : Promise.resolve(null),
    fetchWithFallback(() => fetchStocktwitsSentiment(symbol), null),
    fetchWithFallback(() => fetchFearGreedIndex(), null)
  ]);

  // Calculer indicateurs techniques basiques (rétrocompatibilité)
  const basicIndicators = await calculateTechnicalIndicators(finnhubData.candles);

  // Calculer indicateurs avancés si on a les candles
  let advancedIndicators: TechnicalIndicators | null = null;
  if (finnhubData.candles?.c && finnhubData.candles.c.length >= 30) {
    const priceData: PriceData = {
      close: finnhubData.candles.c,
      high: finnhubData.candles.h,
      low: finnhubData.candles.l
    };
    advancedIndicators = calcTechIndicators(priceData, finnhubData.currentPrice);
  }

  // Analyser sentiment des news
  const sentiment = await analyzeSentimentWithGemini(symbol, finnhubData.news);

  // Préparer les données complètes
  const snapshotData: MarketSnapshotData = {
    simulationId,
    symbol,
    price: finnhubData.currentPrice,
    sentimentScore: sentiment.score,
    sentimentReason: sentiment.reason,

    // Indicateurs techniques
    rsi: advancedIndicators?.rsi ?? basicIndicators.rsi ?? null,
    macd: advancedIndicators?.macd ?? basicIndicators.macd ?? null,
    macdSignal: advancedIndicators?.macdSignal ?? null,
    macdHistogram: advancedIndicators?.macdHistogram ?? null,

    // Reddit
    redditHype,

    // Stocktwits
    stocktwitsBulls: stocktwitsData?.bullish ?? null,
    stocktwitsBears: stocktwitsData?.bearish ?? null,
    stocktwitsVolume: stocktwitsData?.volume ?? null,

    // Fear & Greed
    fearGreedIndex: fearGreedData?.value ?? null,
    fearGreedLabel: fearGreedData?.label ?? null,

    // EMA
    ema9: advancedIndicators?.ema9 ?? null,
    ema21: advancedIndicators?.ema21 ?? null,
    ema50: advancedIndicators?.ema50 ?? null,
    emaTrend: advancedIndicators?.emaTrend ?? null,

    // Bollinger
    bollingerUpper: advancedIndicators?.bollingerUpper ?? null,
    bollingerMiddle: advancedIndicators?.bollingerMiddle ?? null,
    bollingerLower: advancedIndicators?.bollingerLower ?? null,
    bollingerWidth: advancedIndicators?.bollingerWidth ?? null,

    // ATR
    atr: advancedIndicators?.atr ?? null,
    atrPercent: advancedIndicators?.atrPercent ?? null,

    // News headlines pour les agents LLM (5 derniers titres)
    // Note: Ce champ n'est PAS stocké en base, juste passé aux agents
    newsHeadlines: finnhubData.news.slice(0, 5).map((n: any) => n.headline)
  };

  // Extraire les données pour Prisma (sans newsHeadlines qui n'existe pas en base)
  const { newsHeadlines, ...prismaData } = snapshotData;

  // Insérer en base avec retry (sans newsHeadlines)
  await withRetry(() =>
    prisma.marketSnapshot.create({
      data: prismaData
    })
  );

  console.log(`Market snapshot created for ${symbol} at $${finnhubData.currentPrice}`);
  console.log(`  - Stocktwits: ${stocktwitsData?.bullish ?? 'N/A'}% bulls`);
  console.log(`  - Fear & Greed: ${fearGreedData?.value ?? 'N/A'} (${fearGreedData?.label ?? 'N/A'})`);
  console.log(`  - EMA Trend: ${advancedIndicators?.emaTrend ?? 'N/A'}`);
  console.log(`  - News Headlines: ${newsHeadlines?.length ?? 0} articles`);

  return snapshotData;
}
