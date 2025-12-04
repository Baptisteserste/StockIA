import { decide, getOrCreateState, resetState, MarketSnapshot, Portfolio } from '../lib/simulation/agents/algo-agent';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Script de test pour l'Algo Bot
 * Teste la logique de trading avec des données simulées et réelles
 */

// Fetch les vraies données de marché
async function fetchRealMarketData(symbol: string): Promise<MarketSnapshot | null> {
    try {
        console.log(`📡 Fetching real market data for ${symbol}...`);

        // Yahoo Finance pour les candles
        const now = Math.floor(Date.now() / 1000);
        const from60d = now - 60 * 24 * 60 * 60;

        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${from60d}&period2=${now}&interval=1d`;
        const yahooRes = await fetch(yahooUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!yahooRes.ok) {
            console.log('   ❌ Yahoo Finance failed');
            return null;
        }

        const yahooData = await yahooRes.json();
        const result = yahooData.chart?.result?.[0];
        const quote = result?.indicators?.quote?.[0];

        if (!quote || !quote.close) {
            console.log('   ❌ No candle data');
            return null;
        }

        // Calculer RSI et MACD
        const closes = quote.close.filter((c: number | null) => c !== null);
        const price = result.meta?.regularMarketPrice || closes[closes.length - 1];

        // RSI simple (14 périodes)
        const rsiPeriod = 14;
        let gains = 0, losses = 0;
        for (let i = closes.length - rsiPeriod; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff > 0) gains += diff;
            else losses -= diff;
        }
        const avgGain = gains / rsiPeriod;
        const avgLoss = losses / rsiPeriod;
        const rs = avgGain / (avgLoss || 0.001);
        const rsi = 100 - (100 / (1 + rs));

        // MACD simple (12, 26)
        const ema12 = closes.slice(-12).reduce((a: number, b: number) => a + b, 0) / 12;
        const ema26 = closes.slice(-26).reduce((a: number, b: number) => a + b, 0) / 26;
        const macd = ema12 - ema26;

        console.log(`   ✅ Price: $${price.toFixed(2)}, RSI: ${rsi.toFixed(1)}, MACD: ${macd.toFixed(2)}`);

        // Fear & Greed
        let fearGreedIndex = null;
        let fearGreedLabel = null;
        try {
            const fgRes = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
                headers: { 'User-Agent': 'StockIA v1.0' }
            });
            if (fgRes.ok) {
                const fgData = await fgRes.json();
                fearGreedIndex = Math.round(fgData.fear_and_greed?.score || 50);
                fearGreedLabel = fgData.fear_and_greed?.rating || 'neutral';
                console.log(`   ✅ Fear & Greed: ${fearGreedIndex} (${fearGreedLabel})`);
            }
        } catch (e) {
            console.log('   ⚠️ Fear & Greed fetch failed');
        }

        // Stocktwits (peut échouer en local)
        let stocktwitsBulls = null;
        let stocktwitsBears = null;
        try {
            const stRes = await fetch(`https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json`, {
                headers: { 'User-Agent': 'StockIA v1.0' }
            });
            if (stRes.ok) {
                const stData = await stRes.json();
                const msgs = stData.messages || [];
                let bulls = 0, bears = 0;
                for (const msg of msgs) {
                    if (msg.entities?.sentiment?.basic === 'Bullish') bulls++;
                    if (msg.entities?.sentiment?.basic === 'Bearish') bears++;
                }
                const total = bulls + bears;
                stocktwitsBulls = total > 0 ? Math.round((bulls / total) * 100) : 50;
                stocktwitsBears = total > 0 ? 100 - stocktwitsBulls : 50;
                console.log(`   ✅ Stocktwits: ${stocktwitsBulls}% bulls`);
            }
        } catch (e) {
            console.log('   ⚠️ Stocktwits fetch failed (IP blocked)');
        }

        return {
            price,
            rsi,
            macd,
            sentimentScore: 0.3, // Simulé
            sentimentReason: 'Test sentiment',
            stocktwitsBulls,
            stocktwitsBears,
            fearGreedIndex,
            fearGreedLabel,
            macdHistogram: macd * 0.3, // Approximation
        };

    } catch (error) {
        console.error('Error fetching market data:', error);
        return null;
    }
}

async function testAlgoBot() {
    console.log('🤖 Testing ALGO BOT\n');
    console.log('='.repeat(70));

    const symbol = 'NVDA';
    const agentId = 'test-algo-bot';

    // Reset état pour test propre
    resetState(agentId);

    // Fetch vraies données
    const snapshot = await fetchRealMarketData(symbol);

    if (!snapshot) {
        console.log('\n❌ Could not fetch market data. Using mock data...');
        // Mock data
        const mockSnapshot: MarketSnapshot = {
            price: 145.00,
            rsi: 42,
            macd: -1.5,
            sentimentScore: 0.4,
            sentimentReason: 'Positive sentiment',
            stocktwitsBulls: 75,
            stocktwitsBears: 25,
            fearGreedIndex: 35,
            fearGreedLabel: 'Fear',
        };
        return runTest(mockSnapshot, agentId);
    }

    await runTest(snapshot, agentId);
}

async function runTest(snapshot: MarketSnapshot, agentId: string) {
    console.log('\n📊 Market Snapshot:');
    console.log('─'.repeat(50));
    console.log(`   Price:          $${snapshot.price.toFixed(2)}`);
    console.log(`   RSI:            ${snapshot.rsi?.toFixed(1) || 'N/A'}`);
    console.log(`   MACD:           ${snapshot.macd?.toFixed(2) || 'N/A'}`);
    console.log(`   Sentiment:      ${snapshot.sentimentScore}`);
    console.log(`   Stocktwits:     ${snapshot.stocktwitsBulls}% bulls`);
    console.log(`   Fear & Greed:   ${snapshot.fearGreedIndex} (${snapshot.fearGreedLabel})`);

    // Test avec différents portfolios
    const scenarios = [
        { name: '🆕 New trader (no shares)', portfolio: { cash: 10000, shares: 0 } },
        { name: '💼 Holding position', portfolio: { cash: 5000, shares: 30 } },
        { name: '💰 Cash heavy', portfolio: { cash: 15000, shares: 5 } },
    ];

    console.log('\n' + '='.repeat(70));
    console.log('📈 TESTING SCENARIOS:\n');

    for (const scenario of scenarios) {
        resetState(agentId); // Reset entre chaque scénario

        console.log(`\n${scenario.name}`);
        console.log(`   Portfolio: $${scenario.portfolio.cash} cash, ${scenario.portfolio.shares} shares`);

        const decision = decide(snapshot, scenario.portfolio, agentId);

        console.log(`   📍 Decision: ${decision.action}`);
        if (decision.quantity > 0) {
            console.log(`   📦 Quantity: ${decision.quantity}`);
        }
        console.log(`   💬 Reason: ${decision.reason}`);
        console.log(`   🎯 Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Algo Bot test complete!');

    // Afficher les seuils
    console.log('\n📊 Current Thresholds:');
    console.log('   BUY_THRESHOLD:  0.35 (score > 0.35 to buy)');
    console.log('   SELL_THRESHOLD: -0.35 (score < -0.35 to sell)');
}

testAlgoBot();
