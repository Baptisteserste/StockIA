import prisma from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RSI, MACD } from 'technicalindicators';
import Snoowrap from 'snoowrap';

interface MarketSnapshotData {
  simulationId: string;
  symbol: string;
  price: number;
  sentimentScore: number;
  sentimentReason: string;
  rsi: number | null;
  macd: number | null;
  redditHype: number | null;
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
  // Note: Cette API n'est PAS disponible sur le plan gratuit Finnhub
  let candles = null;
  try {
    const from30d = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const toNow = Math.floor(Date.now() / 1000);
    const candlesRes = await fetch(`${baseUrl}/stock/candle?symbol=${symbol}&resolution=D&from=${from30d}&to=${toNow}&token=${apiKey}`);
    const candlesData = await candlesRes.json();
    
    // Vérifier si on a accès (plan payant)
    if (candlesData.s === 'ok' && candlesData.c) {
      candles = candlesData;
    } else if (candlesData.error) {
      console.warn('Finnhub candles not available (free plan limitation):', candlesData.error);
    }
  } catch (error) {
    console.warn('Finnhub candles fetch failed:', error);
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
  if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not set, using default neutral sentiment');
    return { score: 0, reason: 'Analyse de sentiment indisponible (clé API manquante)' };
  }

  if (news.length === 0) {
    return { score: 0, reason: 'Aucune news disponible pour analyse' };
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const headlines = news.map(n => n.headline).join('\n');
    const prompt = `Analyse le sentiment de ces titres financiers pour ${symbol}. Réponds uniquement en JSON strict: {"score": nombre entre -1 et 1, "reason": "résumé en 20 mots max"}

Titres:
${headlines}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Extraire JSON du texte (peut contenir des backticks markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return JSON.parse(text);
  } catch (error) {
    console.error('Gemini sentiment analysis failed:', error);
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
  const [finnhubData, redditHype] = await Promise.all([
    fetchFinnhubData(symbol),
    useReddit ? fetchWithFallback(() => scrapeRedditHype(symbol), null) : Promise.resolve(null)
  ]);

  // Calculer indicateurs techniques
  const { rsi, macd } = await calculateTechnicalIndicators(finnhubData.candles);

  // Analyser sentiment des news
  const sentiment = await analyzeSentimentWithGemini(symbol, finnhubData.news);

  // Préparer les données
  const snapshotData = {
    simulationId,
    symbol,
    price: finnhubData.currentPrice,
    sentimentScore: sentiment.score,
    sentimentReason: sentiment.reason,
    rsi: rsi ?? null,
    macd: macd ?? null,
    redditHype
  };

  // Insérer en base avec retry
  const snapshot = await withRetry(() =>
    prisma.marketSnapshot.create({
      data: snapshotData
    })
  );

  console.log(`Market snapshot created successfully for ${symbol} at $${finnhubData.currentPrice}`);

  return snapshotData;
}
