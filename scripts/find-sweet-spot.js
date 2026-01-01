/**
 * 🔍 STRATEGY OPTIMIZER - Find the Sweet Spot
 * 
 * Teste toutes les combinaisons de durées et poids techniques
 * pour trouver la configuration optimale de l'Algo Bot
 * 
 * Usage: node scripts/find-sweet-spot.js [SYMBOL]
 * Example: node scripts/find-sweet-spot.js NVDA
 */

require('dotenv').config();

const PERIODS = [30, 90, 180, 365];
const WEIGHTS = [0, 20, 40, 50, 60, 70, 80, 100];
const INITIAL_CAPITAL = 10000;

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

    if (score > 0.05 && portfolio.cash >= currentPrice) {
        return { action: 'BUY', quantity: Math.floor((portfolio.cash * 0.3) / currentPrice) };
    }
    if (score < 0.00 && portfolio.shares > 0) {
        return { action: 'SELL', quantity: Math.max(1, Math.floor(portfolio.shares * 0.3)) };
    }
    return { action: 'HOLD', quantity: 0 };
}

function simulate(prices, weightTechnical) {
    const portfolio = { cash: INITIAL_CAPITAL, shares: 0 };
    const bhShares = Math.floor(INITIAL_CAPITAL / prices[0]);
    const bhCash = INITIAL_CAPITAL - bhShares * prices[0];

    const startDay = Math.min(15, Math.floor(prices.length * 0.3));
    let trades = 0;

    for (let i = startDay; i < prices.length; i++) {
        const decision = algoDecide(prices.slice(0, i + 1), prices[i], weightTechnical, portfolio);

        if (decision.action === 'BUY' && decision.quantity > 0) {
            const qty = Math.min(decision.quantity, Math.floor(portfolio.cash / prices[i]));
            if (qty > 0) {
                portfolio.cash -= qty * prices[i];
                portfolio.shares += qty;
                trades++;
            }
        } else if (decision.action === 'SELL' && decision.quantity > 0) {
            const qty = Math.min(decision.quantity, portfolio.shares);
            if (qty > 0) {
                portfolio.cash += qty * prices[i];
                portfolio.shares -= qty;
                trades++;
            }
        }
    }

    const finalPrice = prices[prices.length - 1];
    const algoValue = portfolio.cash + portfolio.shares * finalPrice;
    const bhValue = bhCash + bhShares * finalPrice;

    return {
        algoRoi: ((algoValue / INITIAL_CAPITAL) - 1) * 100,
        bhRoi: ((bhValue / INITIAL_CAPITAL) - 1) * 100,
        trades,
        beatsMarket: algoValue > bhValue
    };
}

// ============== DATA FETCHING ==============

async function fetchData(symbol, days) {
    const now = Math.floor(Date.now() / 1000);
    const from = now - days * 24 * 60 * 60;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${from}&period2=${now}&interval=1d`;

    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await response.json();

    if (!data.chart?.result?.[0]?.indicators?.quote?.[0]?.close) {
        return null;
    }

    return data.chart.result[0].indicators.quote[0].close.filter(p => p !== null);
}

// ============== MAIN ==============

async function findSweetSpot() {
    const symbol = process.argv[2] || 'NVDA';

    console.log('\n' + '='.repeat(80));
    console.log('🔍 STRATEGY OPTIMIZER - Finding the Sweet Spot');
    console.log('='.repeat(80));
    console.log(`Symbol: ${symbol} | Testing ${PERIODS.length} periods × ${WEIGHTS.length} weights = ${PERIODS.length * WEIGHTS.length} combinations\n`);

    const results = [];

    for (const days of PERIODS) {
        console.log(`\n📊 Testing ${days} days...`);
        const prices = await fetchData(symbol, days);

        if (!prices || prices.length < 15) {
            console.log(`   ⚠️ Not enough data (got ${prices?.length || 0} points)`);
            continue;
        }

        console.log(`   ✅ Got ${prices.length} data points`);

        for (const weight of WEIGHTS) {
            const result = simulate(prices, weight);
            results.push({
                days,
                weight,
                ...result,
                outperformance: result.algoRoi - result.bhRoi
            });
        }
    }

    // Sort by outperformance (algo vs buy&hold)
    results.sort((a, b) => b.outperformance - a.outperformance);

    console.log('\n\n' + '='.repeat(80));
    console.log('📈 RESULTS (sorted by outperformance vs Buy & Hold)');
    console.log('='.repeat(80));
    console.log('Period   | Weight | Algo ROI  | B&H ROI   | Outperf.  | Trades | Beats Market');
    console.log('-'.repeat(80));

    for (const r of results) {
        const algoRoi = r.algoRoi >= 0 ? `+${r.algoRoi.toFixed(2)}%` : `${r.algoRoi.toFixed(2)}%`;
        const bhRoi = r.bhRoi >= 0 ? `+${r.bhRoi.toFixed(2)}%` : `${r.bhRoi.toFixed(2)}%`;
        const outperf = r.outperformance >= 0 ? `+${r.outperformance.toFixed(2)}%` : `${r.outperformance.toFixed(2)}%`;
        const beats = r.beatsMarket ? '✅ YES' : '❌ NO';

        console.log(`${String(r.days).padEnd(8)} | ${String(r.weight + '%').padEnd(6)} | ${algoRoi.padEnd(9)} | ${bhRoi.padEnd(9)} | ${outperf.padEnd(9)} | ${String(r.trades).padEnd(6)} | ${beats}`);
    }

    console.log('-'.repeat(80));

    // Best configurations
    const best = results[0];
    const bestByPeriod = {};
    for (const r of results) {
        if (!bestByPeriod[r.days] || r.outperformance > bestByPeriod[r.days].outperformance) {
            bestByPeriod[r.days] = r;
        }
    }

    console.log('\n🏆 SWEET SPOTS PAR PÉRIODE:');
    console.log('-'.repeat(50));
    for (const days of PERIODS) {
        const b = bestByPeriod[days];
        if (b) {
            const emoji = b.beatsMarket ? '✅' : '⚠️';
            console.log(`   ${days} jours: ${b.weight}% technique ${emoji} (outperf: ${b.outperformance >= 0 ? '+' : ''}${b.outperformance.toFixed(2)}%)`);
        }
    }

    console.log('\n🎯 MEILLEURE CONFIG GLOBALE:');
    console.log(`   Période: ${best.days} jours`);
    console.log(`   Poids Technique: ${best.weight}%`);
    console.log(`   Outperformance: ${best.outperformance >= 0 ? '+' : ''}${best.outperformance.toFixed(2)}% vs Buy & Hold`);
    console.log('\n' + '='.repeat(80) + '\n');
}

findSweetSpot().catch(console.error);
