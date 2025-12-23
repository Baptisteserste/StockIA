import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Test du score Algo Bot via l'app Vercel
 * Explique comment le score composite est calculé
 */

const VERCEL_URL = 'https://nextjs-navy-ten-24.vercel.app';

// Configuration de l'Algo Bot
const CONFIG = {
    WEIGHT_TECHNICAL: 0.40,   // 40% du score
    WEIGHT_SENTIMENT: 0.40,   // 40% du score
    WEIGHT_FEAR_GREED: 0.20,  // 20% du score
    BUY_THRESHOLD: 0.15,      // Nouveau seuil (était 0.35)
    SELL_THRESHOLD: -0.15,    // Nouveau seuil (était -0.35)
};

function calculateTechnicalScore(rsi: number | null, macd: number | null, macdHistogram?: number | null): { score: number; details: string[] } {
    const details: string[] = [];
    let score = 0;
    let factors = 0;

    // RSI
    if (rsi !== null) {
        factors++;
        if (rsi < 30) {
            score += 1;
            details.push(`RSI ${rsi.toFixed(0)} (oversold) → +1`);
        } else if (rsi < 40) {
            score += 0.5;
            details.push(`RSI ${rsi.toFixed(0)} (bas) → +0.5`);
        } else if (rsi > 70) {
            score -= 1;
            details.push(`RSI ${rsi.toFixed(0)} (overbought) → -1`);
        } else if (rsi > 60) {
            score -= 0.5;
            details.push(`RSI ${rsi.toFixed(0)} (haut) → -0.5`);
        } else {
            details.push(`RSI ${rsi.toFixed(0)} (neutre) → 0`);
        }
    }

    // MACD
    if (macd !== null) {
        factors++;
        if (macd > 0) {
            score += 0.5;
            details.push(`MACD ${macd.toFixed(2)} (positif) → +0.5`);
        } else {
            score -= 0.5;
            details.push(`MACD ${macd.toFixed(2)} (négatif) → -0.5`);
        }
    }

    return {
        score: factors > 0 ? score / factors : 0,
        details
    };
}

function calculateSentimentScore(sentimentScore: number, stocktwitsBulls: number | null): { score: number; details: string[] } {
    const details: string[] = [];
    let score = 0;
    let factors = 0;

    // Gemini sentiment
    if (sentimentScore !== undefined) {
        factors++;
        score += sentimentScore;
        details.push(`Gemini sentiment: ${sentimentScore.toFixed(2)} → +${sentimentScore.toFixed(2)}`);
    }

    // Stocktwits
    if (stocktwitsBulls !== null && stocktwitsBulls !== undefined) {
        factors++;
        const stocktwitsScore = (stocktwitsBulls - 50) / 50; // Convertir 0-100 en -1 à +1
        score += stocktwitsScore;
        details.push(`Stocktwits ${stocktwitsBulls}% bulls → ${stocktwitsScore > 0 ? '+' : ''}${stocktwitsScore.toFixed(2)}`);
    }

    return {
        score: factors > 0 ? score / factors : 0,
        details
    };
}

function calculateFearGreedScore(index: number | null): { score: number; details: string[] } {
    const details: string[] = [];

    if (index === null || index === undefined) {
        return { score: 0, details: ['Fear & Greed: N/A'] };
    }

    // Stratégie CONTRARIAN
    let score = 0;

    if (index < 20) {
        score = 0.8;
        details.push(`Fear & Greed ${index} (Extreme Fear) → +0.8 (CONTRARIAN BUY)`);
    } else if (index < 35) {
        score = 0.4;
        details.push(`Fear & Greed ${index} (Fear) → +0.4 (contrarian)`);
    } else if (index > 80) {
        score = -0.8;
        details.push(`Fear & Greed ${index} (Extreme Greed) → -0.8 (CONTRARIAN SELL)`);
    } else if (index > 65) {
        score = -0.4;
        details.push(`Fear & Greed ${index} (Greed) → -0.4 (contrarian)`);
    } else {
        details.push(`Fear & Greed ${index} (Neutral) → 0`);
    }

    return { score, details };
}

async function fetchLatestDataFromVercel(): Promise<any> {
    console.log(`📡 Fetching latest tick from Vercel...\n`);

    try {
        // Essayer d'obtenir les dernières données via l'API status
        const res = await fetch(`${VERCEL_URL}/api/simulation/status`);

        if (!res.ok) {
            console.log(`   ⚠️ Status API returned ${res.status}`);
            return null;
        }

        const data = await res.json();
        return data;
    } catch (error) {
        console.error('   ❌ Failed to fetch from Vercel:', error);
        return null;
    }
}

async function main() {
    console.log('🧮 ALGO BOT SCORE CALCULATOR\n');
    console.log('='.repeat(70));
    console.log('\n📊 How the composite score is calculated:\n');
    console.log('   Score = Technical × 40% + Sentiment × 40% + Fear&Greed × 20%\n');
    console.log('   BUY if Score > 0.35');
    console.log('   SELL if Score < -0.35');
    console.log('   HOLD otherwise\n');
    console.log('='.repeat(70));

    // Récupérer les données depuis Vercel
    const vercelData = await fetchLatestDataFromVercel();

    // Données du dernier tick (si disponible) ou mock
    let marketData: any;

    if (vercelData?.simulation?.lastSnapshot) {
        marketData = vercelData.simulation.lastSnapshot;
        console.log('\n✅ Using real data from Vercel:\n');
    } else {
        // Données mockées basées sur le dernier export
        marketData = {
            price: 183.38,
            rsi: 46.5,
            macd: -2.31,
            sentimentScore: 0.6,
            stocktwitsBulls: 88,
            stocktwitsBears: 12,
            fearGreedIndex: 39,
            fearGreedLabel: 'Fear'
        };
        console.log('\n⚠️ Using cached data (from last export):\n');
    }

    console.log('─'.repeat(70));
    console.log('📈 MARKET DATA:');
    console.log('─'.repeat(70));
    console.log(`   Price:          $${marketData.price}`);
    console.log(`   RSI:            ${marketData.rsi}`);
    console.log(`   MACD:           ${marketData.macd}`);
    console.log(`   Sentiment:      ${marketData.sentimentScore}`);
    console.log(`   Stocktwits:     ${marketData.stocktwitsBulls}% bulls`);
    console.log(`   Fear & Greed:   ${marketData.fearGreedIndex} (${marketData.fearGreedLabel})`);

    // Calculer chaque composante
    console.log('\n' + '─'.repeat(70));
    console.log('🔧 TECHNICAL SCORE (40%):');
    console.log('─'.repeat(70));
    const technical = calculateTechnicalScore(marketData.rsi, marketData.macd);
    for (const d of technical.details) console.log(`   ${d}`);
    console.log(`   → Score technique: ${technical.score.toFixed(2)}`);

    console.log('\n' + '─'.repeat(70));
    console.log('💬 SENTIMENT SCORE (40%):');
    console.log('─'.repeat(70));
    const sentiment = calculateSentimentScore(marketData.sentimentScore, marketData.stocktwitsBulls);
    for (const d of sentiment.details) console.log(`   ${d}`);
    console.log(`   → Score sentiment: ${sentiment.score.toFixed(2)}`);

    console.log('\n' + '─'.repeat(70));
    console.log('😱 FEAR & GREED SCORE (20%):');
    console.log('─'.repeat(70));
    const fearGreed = calculateFearGreedScore(marketData.fearGreedIndex);
    for (const d of fearGreed.details) console.log(`   ${d}`);
    console.log(`   → Score F&G: ${fearGreed.score.toFixed(2)}`);

    // Score composite
    const compositeScore =
        technical.score * CONFIG.WEIGHT_TECHNICAL +
        sentiment.score * CONFIG.WEIGHT_SENTIMENT +
        fearGreed.score * CONFIG.WEIGHT_FEAR_GREED;

    console.log('\n' + '='.repeat(70));
    console.log('🎯 COMPOSITE SCORE CALCULATION:');
    console.log('='.repeat(70));
    console.log(`   Technical:  ${technical.score.toFixed(2)} × 40% = ${(technical.score * 0.4).toFixed(3)}`);
    console.log(`   Sentiment:  ${sentiment.score.toFixed(2)} × 40% = ${(sentiment.score * 0.4).toFixed(3)}`);
    console.log(`   Fear&Greed: ${fearGreed.score.toFixed(2)} × 20% = ${(fearGreed.score * 0.2).toFixed(3)}`);
    console.log(`   ─────────────────────────────`);
    console.log(`   TOTAL SCORE: ${compositeScore.toFixed(3)}\n`);

    // Décision
    let decision = 'HOLD';
    let emoji = '⏳';
    if (compositeScore > CONFIG.BUY_THRESHOLD) {
        decision = 'BUY';
        emoji = '🟢';
    } else if (compositeScore < CONFIG.SELL_THRESHOLD) {
        decision = 'SELL';
        emoji = '🔴';
    }

    console.log(`   ${emoji} DECISION: ${decision}`);
    console.log(`   (Score ${compositeScore.toFixed(3)} vs thresholds: BUY>${CONFIG.BUY_THRESHOLD}, SELL<${CONFIG.SELL_THRESHOLD})`);

    console.log('\n' + '='.repeat(70));
}

main();
