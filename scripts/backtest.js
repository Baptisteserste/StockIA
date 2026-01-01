/**
 * 📊 BACKTESTING ENGINE - Algo Bot Strategy Tester
 * 
 * Teste différentes configurations de l'algo sur des données historiques
 * et compare avec une stratégie Buy & Hold
 * 
 * Usage: node scripts/backtest.js [SYMBOL] [DAYS]
 * Example: node scripts/backtest.js NVDA 180
 */

require('dotenv').config();

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

// ============== CONFIGURATION ==============

const CONFIGS_TO_TEST = [
    { name: 'Buy & Hold', type: 'buyhold' },
    { name: 'Algo 50/50', weightTechnical: 50 },
    { name: 'Algo 60/40', weightTechnical: 60 },
    { name: 'Algo 70/30', weightTechnical: 70 },
    { name: 'Algo 80/20', weightTechnical: 80 },
    { name: 'Algo 100% Tech', weightTechnical: 100 },
];

const INITIAL_CAPITAL = 10000;

// ============== ALGO LOGIC (simplified) ==============

function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;

    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function calculateMACD(prices) {
    if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };

    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macd = ema12 - ema26;

    return { macd, signal: 0, histogram: macd };
}

function calculateEMA(prices, period) {
    if (prices.length < period) return prices[prices.length - 1];

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b) / period;

    for (let i = period; i < prices.length; i++) {
        ema = (prices[i] - ema) * multiplier + ema;
    }
    return ema;
}

function algoDecide(prices, currentPrice, weightTechnical, portfolio) {
    const rsi = calculateRSI(prices);
    const { macd, histogram } = calculateMACD(prices);

    // Technical score (-1 to +1)
    let techScore = 0;
    if (rsi < 30) techScore += 0.8;
    else if (rsi < 40) techScore += 0.4;
    else if (rsi > 70) techScore -= 0.8;
    else if (rsi > 60) techScore -= 0.4;

    if (macd > 0) techScore += 0.3;
    else techScore -= 0.3;

    // Sentiment score (simulated based on price momentum)
    const momentum = prices.length > 5 ? (currentPrice - prices[prices.length - 5]) / prices[prices.length - 5] : 0;
    let sentScore = momentum * 10; // Scale momentum to -1 to +1 range
    sentScore = Math.max(-1, Math.min(1, sentScore));

    // Combined score
    const techWeight = weightTechnical / 100;
    const sentWeight = 1 - techWeight;
    const score = techScore * techWeight + sentScore * sentWeight;

    // Decision thresholds
    const BUY_THRESHOLD = 0.05;
    const SELL_THRESHOLD = 0.00;

    if (score > BUY_THRESHOLD && portfolio.cash >= currentPrice) {
        const quantity = Math.floor((portfolio.cash * 0.3) / currentPrice);
        return { action: 'BUY', quantity, reason: `Score: ${score.toFixed(2)}` };
    }

    if (score < SELL_THRESHOLD && portfolio.shares > 0) {
        const quantity = Math.floor(portfolio.shares * 0.3);
        return { action: 'SELL', quantity: Math.max(1, quantity), reason: `Score: ${score.toFixed(2)}` };
    }

    return { action: 'HOLD', quantity: 0, reason: `Score: ${score.toFixed(2)}` };
}

// ============== SIMULATION ENGINE ==============

function simulateBuyAndHold(prices, initialCapital) {
    const buyPrice = prices[0];
    const shares = Math.floor(initialCapital / buyPrice);
    const cashLeft = initialCapital - shares * buyPrice;

    const history = prices.map((price, i) => ({
        day: i,
        price,
        value: cashLeft + shares * price,
        roi: ((cashLeft + shares * price) / initialCapital - 1) * 100
    }));

    const finalValue = cashLeft + shares * prices[prices.length - 1];
    const roi = ((finalValue / initialCapital) - 1) * 100;
    const maxDrawdown = calculateMaxDrawdown(history.map(h => h.value));

    return { roi, maxDrawdown, trades: 1, winRate: roi > 0 ? 100 : 0, history };
}

function simulateAlgo(prices, initialCapital, weightTechnical) {
    let portfolio = { cash: initialCapital, shares: 0 };
    const trades = [];
    const history = [];

    for (let i = 30; i < prices.length; i++) { // Start after enough data for indicators
        const priceHistory = prices.slice(0, i + 1);
        const currentPrice = prices[i];

        const decision = algoDecide(priceHistory, currentPrice, weightTechnical, portfolio);

        if (decision.action === 'BUY' && decision.quantity > 0) {
            const qty = Math.min(decision.quantity, Math.floor(portfolio.cash / currentPrice));
            if (qty > 0) {
                portfolio.cash -= qty * currentPrice;
                portfolio.shares += qty;
                trades.push({ type: 'BUY', price: currentPrice, quantity: qty, day: i });
            }
        } else if (decision.action === 'SELL' && decision.quantity > 0) {
            const qty = Math.min(decision.quantity, portfolio.shares);
            if (qty > 0) {
                portfolio.cash += qty * currentPrice;
                portfolio.shares -= qty;
                trades.push({ type: 'SELL', price: currentPrice, quantity: qty, day: i });
            }
        }

        const totalValue = portfolio.cash + portfolio.shares * currentPrice;
        history.push({ day: i, price: currentPrice, value: totalValue, roi: ((totalValue / initialCapital) - 1) * 100 });
    }

    // Calculate final metrics
    const finalPrice = prices[prices.length - 1];
    const finalValue = portfolio.cash + portfolio.shares * finalPrice;
    const roi = ((finalValue / initialCapital) - 1) * 100;
    const maxDrawdown = calculateMaxDrawdown(history.map(h => h.value));

    // Calculate win rate
    let wins = 0;
    for (let i = 0; i < trades.length; i++) {
        if (trades[i].type === 'BUY') {
            // Find next sell or use final price
            const sellTrade = trades.slice(i + 1).find(t => t.type === 'SELL');
            const exitPrice = sellTrade ? sellTrade.price : finalPrice;
            if (exitPrice > trades[i].price) wins++;
        }
    }
    const buyTrades = trades.filter(t => t.type === 'BUY').length;
    const winRate = buyTrades > 0 ? (wins / buyTrades) * 100 : 0;

    return { roi, maxDrawdown, trades: trades.length, winRate, history };
}

function calculateMaxDrawdown(values) {
    let maxDrawdown = 0;
    let peak = values[0];

    for (const value of values) {
        if (value > peak) peak = value;
        const drawdown = ((peak - value) / peak) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return maxDrawdown;
}

// ============== DATA FETCHING (Yahoo Finance) ==============

async function fetchHistoricalData(symbol, days) {
    const now = Math.floor(Date.now() / 1000);
    const from = now - days * 24 * 60 * 60;

    // Yahoo Finance API (gratuit, pas de clé requise)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${from}&period2=${now}&interval=1d`;

    console.log(`📡 Fetching ${days} days of ${symbol} data from Yahoo Finance...`);

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    const data = await response.json();

    if (!data.chart?.result?.[0]?.indicators?.quote?.[0]?.close) {
        throw new Error(`Failed to fetch data: ${JSON.stringify(data)}`);
    }

    const closes = data.chart.result[0].indicators.quote[0].close.filter(p => p !== null);

    console.log(`✅ Got ${closes.length} data points\n`);
    return closes;
}

// ============== MAIN ==============

async function runBacktest() {
    const symbol = process.argv[2] || 'NVDA';
    const days = parseInt(process.argv[3]) || 180;

    console.log('\n' + '='.repeat(60));
    console.log('📊 BACKTESTING ENGINE - Algo Bot Strategy Tester');
    console.log('='.repeat(60));
    console.log(`Symbol: ${symbol} | Period: ${days} days | Capital: $${INITIAL_CAPITAL}`);
    console.log('='.repeat(60) + '\n');

    try {
        const prices = await fetchHistoricalData(symbol, days);

        console.log('Running simulations...\n');

        const results = [];

        for (const config of CONFIGS_TO_TEST) {
            let result;
            if (config.type === 'buyhold') {
                result = simulateBuyAndHold(prices, INITIAL_CAPITAL);
            } else {
                result = simulateAlgo(prices, INITIAL_CAPITAL, config.weightTechnical);
            }
            results.push({ ...config, ...result });
        }

        // Sort by ROI
        results.sort((a, b) => b.roi - a.roi);

        // Display results
        console.log('📈 RESULTS (sorted by ROI)');
        console.log('-'.repeat(70));
        console.log('Strategy         | ROI       | Win Rate  | Trades | Max Drawdown');
        console.log('-'.repeat(70));

        for (const r of results) {
            const roi = r.roi >= 0 ? `+${r.roi.toFixed(2)}%` : `${r.roi.toFixed(2)}%`;
            const wr = `${r.winRate.toFixed(0)}%`;
            const dd = `-${r.maxDrawdown.toFixed(2)}%`;
            const bestMark = r === results[0] ? ' ← BEST' : '';

            console.log(`${r.name.padEnd(16)} | ${roi.padEnd(9)} | ${wr.padEnd(9)} | ${String(r.trades).padEnd(6)} | ${dd}${bestMark}`);
        }

        console.log('-'.repeat(70));

        // Best strategy
        const best = results[0];
        console.log(`\n🏆 BEST STRATEGY: ${best.name}`);
        console.log(`   ROI: ${best.roi >= 0 ? '+' : ''}${best.roi.toFixed(2)}% | Win Rate: ${best.winRate.toFixed(0)}%`);

        // Compare with buy & hold
        const bh = results.find(r => r.type === 'buyhold');
        if (bh && best !== bh) {
            const diff = best.roi - bh.roi;
            console.log(`   Outperformed Buy & Hold by ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%`);
        }

        console.log('\n' + '='.repeat(60) + '\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

runBacktest();
