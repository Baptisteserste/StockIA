/**
 * 📊 BACKTESTING WITH TICKS - Simule le comportement du cron
 * 
 * Utilise des données HORAIRES pour simuler les 5 ticks/jour du cron
 * Plus réaliste que le backtest quotidien
 * 
 * Usage: node scripts/backtesting-withtick.js [SYMBOL] [DAYS]
 * Example: node scripts/backtesting-withtick.js NVDA 30
 * 
 * Note: Yahoo Finance limite les données horaires à 60 jours max
 */

require('dotenv').config();

const INITIAL_CAPITAL = 10000;
const WEIGHTS_TO_TEST = [50, 60, 70, 80, 100];

// ============== ALGO LOGIC ==============

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
    return 100 - (100 / (1 + avgGain / avgLoss));
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

function calculateMACD(prices) {
    if (prices.length < 26) return { macd: 0 };
    return { macd: calculateEMA(prices, 12) - calculateEMA(prices, 26) };
}

function algoDecide(prices, currentPrice, weightTechnical, portfolio) {
    const rsi = calculateRSI(prices);
    const { macd } = calculateMACD(prices);

    let techScore = 0;
    if (rsi < 30) techScore += 0.8;
    else if (rsi < 40) techScore += 0.4;
    else if (rsi > 70) techScore -= 0.8;
    else if (rsi > 60) techScore -= 0.4;
    if (macd > 0) techScore += 0.3;
    else techScore -= 0.3;

    const momentum = prices.length > 5 ? (currentPrice - prices[prices.length - 5]) / prices[prices.length - 5] : 0;
    let sentScore = Math.max(-1, Math.min(1, momentum * 10));

    const score = techScore * (weightTechnical / 100) + sentScore * (1 - weightTechnical / 100);

    // OPTIMIZED thresholds based on backtest results
    if (score > 0.15 && portfolio.cash >= currentPrice) {
        return { action: 'BUY', quantity: Math.floor((portfolio.cash * 0.4) / currentPrice), score };
    }
    if (score < -0.10 && portfolio.shares > 0) {
        return { action: 'SELL', quantity: Math.max(1, Math.floor(portfolio.shares * 0.4)), score };
    }
    return { action: 'HOLD', quantity: 0, score };
}

// ============== SIMULATION ==============

function simulate(data, weightTechnical) {
    const portfolio = { cash: INITIAL_CAPITAL, shares: 0 };
    const prices = data.map(d => d.price);

    // Buy & Hold
    const bhShares = Math.floor(INITIAL_CAPITAL / prices[0]);
    const bhCash = INITIAL_CAPITAL - bhShares * prices[0];

    const startTick = Math.min(30, Math.floor(prices.length * 0.2));
    const trades = [];
    let buys = 0, sells = 0, holds = 0;

    for (let i = startTick; i < prices.length; i++) {
        const decision = algoDecide(prices.slice(0, i + 1), prices[i], weightTechnical, portfolio);

        if (decision.action === 'BUY' && decision.quantity > 0) {
            const qty = Math.min(decision.quantity, Math.floor(portfolio.cash / prices[i]));
            if (qty > 0) {
                portfolio.cash -= qty * prices[i];
                portfolio.shares += qty;
                trades.push({ action: 'BUY', price: prices[i], qty, time: data[i].time });
                buys++;
            }
        } else if (decision.action === 'SELL' && decision.quantity > 0) {
            const qty = Math.min(decision.quantity, portfolio.shares);
            if (qty > 0) {
                portfolio.cash += qty * prices[i];
                portfolio.shares -= qty;
                trades.push({ action: 'SELL', price: prices[i], qty, time: data[i].time });
                sells++;
            }
        } else {
            holds++;
        }
    }

    const finalPrice = prices[prices.length - 1];
    const algoValue = portfolio.cash + portfolio.shares * finalPrice;
    const bhValue = bhCash + bhShares * finalPrice;

    // Win rate
    let wins = 0;
    for (let i = 0; i < trades.length; i++) {
        if (trades[i].action === 'BUY') {
            const sellTrade = trades.slice(i + 1).find(t => t.action === 'SELL');
            if ((sellTrade ? sellTrade.price : finalPrice) > trades[i].price) wins++;
        }
    }
    const buyCount = trades.filter(t => t.action === 'BUY').length;

    return {
        algoRoi: ((algoValue / INITIAL_CAPITAL) - 1) * 100,
        bhRoi: ((bhValue / INITIAL_CAPITAL) - 1) * 100,
        outperformance: ((algoValue / INITIAL_CAPITAL) - 1) * 100 - ((bhValue / INITIAL_CAPITAL) - 1) * 100,
        winRate: buyCount > 0 ? (wins / buyCount) * 100 : 0,
        stats: { buys, sells, holds, total: buys + sells + holds },
        trades
    };
}

// ============== DATA FETCHING (HOURLY) ==============

async function fetchHourlyData(symbol, days) {
    // Yahoo Finance: interval=1h, max range ~60 days
    const maxDays = Math.min(days, 59);
    const now = Math.floor(Date.now() / 1000);
    const from = now - maxDays * 24 * 60 * 60;

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${from}&period2=${now}&interval=1h`;

    console.log(`📡 Fetching HOURLY data for ${symbol} (${maxDays} days)...`);

    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const json = await response.json();

    if (!json.chart?.result?.[0]?.indicators?.quote?.[0]?.close) {
        throw new Error('Failed to fetch hourly data');
    }

    const result = json.chart.result[0];
    const timestamps = result.timestamp || [];
    const closes = result.indicators.quote[0].close || [];

    // Filter market hours only (14:30-21:00 UTC for US market)
    // Decision thresholds - OPTIMIZED based on backtest
    const BUY_THRESHOLD = 0.15;
    const SELL_THRESHOLD = -0.10;
    const data = [];
    for (let i = 0; i < closes.length; i++) {
        if (closes[i] !== null) {
            const date = new Date(timestamps[i] * 1000);
            const hour = date.getUTCHours();
            // Keep only market hours (roughly 14:30 - 21:00 UTC)
            if (hour >= 14 && hour <= 21) {
                data.push({
                    price: closes[i],
                    time: date.toISOString().replace('T', ' ').slice(0, 16)
                });
            }
        }
    }

    console.log(`✅ Got ${data.length} hourly ticks (≈${Math.floor(data.length / 5)} trading days)`);
    return data;
}

// ============== MAIN ==============

async function runBacktest() {
    const symbol = process.argv[2] || 'NVDA';
    const days = parseInt(process.argv[3]) || 30;

    console.log('\n' + '='.repeat(70));
    console.log('📊 BACKTESTING WITH TICKS - Simulation réaliste (données horaires)');
    console.log('='.repeat(70));
    console.log(`Symbol: ${symbol} | Period: ${Math.min(days, 59)} days (Yahoo limit: 60 days for hourly)`);
    console.log('='.repeat(70) + '\n');

    try {
        const data = await fetchHourlyData(symbol, days);

        if (data.length < 30) {
            console.log(`❌ Not enough data points (got ${data.length}, need 30+)`);
            return;
        }

        console.log('\nRunning simulations with different weights...\n');

        const results = [];
        for (const weight of WEIGHTS_TO_TEST) {
            const result = simulate(data, weight);
            results.push({ weight, ...result });
        }

        // Sort by outperformance
        results.sort((a, b) => b.outperformance - a.outperformance);

        console.log('📈 RESULTS (sorted by outperformance)');
        console.log('-'.repeat(70));
        console.log('Weight   | Algo ROI  | B&H ROI   | Outperf.  | Win Rate | BUY/SELL/HOLD');
        console.log('-'.repeat(70));

        for (const r of results) {
            const algoRoi = r.algoRoi >= 0 ? `+${r.algoRoi.toFixed(2)}%` : `${r.algoRoi.toFixed(2)}%`;
            const bhRoi = r.bhRoi >= 0 ? `+${r.bhRoi.toFixed(2)}%` : `${r.bhRoi.toFixed(2)}%`;
            const outperf = r.outperformance >= 0 ? `+${r.outperformance.toFixed(2)}%` : `${r.outperformance.toFixed(2)}%`;
            const stats = `${r.stats.buys}/${r.stats.sells}/${r.stats.holds}`;
            const best = r === results[0] ? ' ← BEST' : '';

            console.log(`${String(r.weight + '%').padEnd(8)} | ${algoRoi.padEnd(9)} | ${bhRoi.padEnd(9)} | ${outperf.padEnd(9)} | ${(r.winRate.toFixed(0) + '%').padEnd(8)} | ${stats}${best}`);
        }

        console.log('-'.repeat(70));

        const best = results[0];
        console.log(`\n🎯 SWEET SPOT: ${best.weight}% Technique`);
        console.log(`   Outperformance: ${best.outperformance >= 0 ? '+' : ''}${best.outperformance.toFixed(2)}% vs Buy & Hold`);
        console.log(`   Win Rate: ${best.winRate.toFixed(0)}%`);
        console.log(`   Trades: ${best.stats.buys} BUY, ${best.stats.sells} SELL, ${best.stats.holds} HOLD`);

        // Show recent trades
        if (best.trades.length > 0) {
            console.log('\n📋 Derniers trades:');
            for (const trade of best.trades.slice(-5)) {
                const emoji = trade.action === 'BUY' ? '🟢' : '🔴';
                console.log(`   ${emoji} ${trade.time}: ${trade.action} ${trade.qty} @ $${trade.price.toFixed(2)}`);
            }
        }

        console.log('\n' + '='.repeat(70) + '\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

runBacktest();
