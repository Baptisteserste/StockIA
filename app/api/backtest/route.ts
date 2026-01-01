import { NextRequest, NextResponse } from 'next/server';

// ============== CONFIGURATION ==============

const INITIAL_CAPITAL = 10000;

// ============== ALGO LOGIC (replicated from backtest.js) ==============

function calculateRSI(prices: number[], period = 14): number {
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

function calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b) / period;

    for (let i = period; i < prices.length; i++) {
        ema = (prices[i] - ema) * multiplier + ema;
    }
    return ema;
}

function calculateMACD(prices: number[]) {
    if (prices.length < 26) return { macd: 0, signal: 0 };

    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macd = ema12 - ema26;

    return { macd, signal: 0 };
}

interface Portfolio {
    cash: number;
    shares: number;
}

function algoDecide(prices: number[], currentPrice: number, weightTechnical: number, portfolio: Portfolio) {
    const rsi = calculateRSI(prices);
    const { macd } = calculateMACD(prices);

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
    let sentScore = momentum * 10;
    sentScore = Math.max(-1, Math.min(1, sentScore));

    // Combined score
    const techWeight = weightTechnical / 100;
    const sentWeight = 1 - techWeight;
    const score = techScore * techWeight + sentScore * sentWeight;

    // Decision thresholds (same as algo-agent.ts)
    const BUY_THRESHOLD = 0.05;
    const SELL_THRESHOLD = 0.00;

    if (score > BUY_THRESHOLD && portfolio.cash >= currentPrice) {
        const quantity = Math.floor((portfolio.cash * 0.3) / currentPrice);
        return { action: 'BUY', quantity, score, rsi };
    }

    if (score < SELL_THRESHOLD && portfolio.shares > 0) {
        const quantity = Math.floor(portfolio.shares * 0.3);
        return { action: 'SELL', quantity: Math.max(1, quantity), score, rsi };
    }

    return { action: 'HOLD', quantity: 0, score, rsi };
}

// ============== SIMULATION ==============

interface Trade {
    day: number;
    date: string;
    action: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    value: number;
    score: number;
    rsi: number;
}

interface HistoryPoint {
    day: number;
    date: string;
    price: number;
    algoValue: number;
    algoRoi: number;
    buyHoldValue: number;
    buyHoldRoi: number;
}

function simulateAlgo(prices: number[], dates: string[], weightTechnical: number, initialCapital: number) {
    const portfolio: Portfolio = { cash: initialCapital, shares: 0 };
    const trades: Trade[] = [];
    const history: HistoryPoint[] = [];

    // Buy & Hold: buy everything on day 1
    const bhShares = Math.floor(initialCapital / prices[0]);
    const bhCash = initialCapital - bhShares * prices[0];

    // Start after minimum data for indicators (15 days for short backtests)
    const startDay = Math.min(15, Math.floor(prices.length * 0.3));
    for (let i = startDay; i < prices.length; i++) {
        const priceHistory = prices.slice(0, i + 1);
        const currentPrice = prices[i];

        const decision = algoDecide(priceHistory, currentPrice, weightTechnical, portfolio);

        if (decision.action === 'BUY' && decision.quantity > 0) {
            const qty = Math.min(decision.quantity, Math.floor(portfolio.cash / currentPrice));
            if (qty > 0) {
                portfolio.cash -= qty * currentPrice;
                portfolio.shares += qty;
                trades.push({
                    day: i,
                    date: dates[i],
                    action: 'BUY',
                    price: currentPrice,
                    quantity: qty,
                    value: portfolio.cash + portfolio.shares * currentPrice,
                    score: decision.score,
                    rsi: decision.rsi
                });
            }
        } else if (decision.action === 'SELL' && decision.quantity > 0) {
            const qty = Math.min(decision.quantity, portfolio.shares);
            if (qty > 0) {
                portfolio.cash += qty * currentPrice;
                portfolio.shares -= qty;
                trades.push({
                    day: i,
                    date: dates[i],
                    action: 'SELL',
                    price: currentPrice,
                    quantity: qty,
                    value: portfolio.cash + portfolio.shares * currentPrice,
                    score: decision.score,
                    rsi: decision.rsi
                });
            }
        }

        const algoValue = portfolio.cash + portfolio.shares * currentPrice;
        const bhValue = bhCash + bhShares * currentPrice;

        history.push({
            day: i,
            date: dates[i],
            price: currentPrice,
            algoValue,
            algoRoi: ((algoValue / initialCapital) - 1) * 100,
            buyHoldValue: bhValue,
            buyHoldRoi: ((bhValue / initialCapital) - 1) * 100
        });
    }

    // Final metrics
    const finalPrice = prices[prices.length - 1];
    const finalAlgoValue = portfolio.cash + portfolio.shares * finalPrice;
    const finalBhValue = bhCash + bhShares * finalPrice;

    // Calculate win rate
    let wins = 0;
    for (let i = 0; i < trades.length; i++) {
        if (trades[i].action === 'BUY') {
            const sellTrade = trades.slice(i + 1).find(t => t.action === 'SELL');
            const exitPrice = sellTrade ? sellTrade.price : finalPrice;
            if (exitPrice > trades[i].price) wins++;
        }
    }
    const buyTrades = trades.filter(t => t.action === 'BUY').length;
    const winRate = buyTrades > 0 ? (wins / buyTrades) * 100 : 0;

    // Max drawdown
    let maxDrawdown = 0;
    let peak = history[0]?.algoValue || initialCapital;
    for (const h of history) {
        if (h.algoValue > peak) peak = h.algoValue;
        const dd = ((peak - h.algoValue) / peak) * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
    }

    return {
        algo: {
            roi: ((finalAlgoValue / initialCapital) - 1) * 100,
            finalValue: finalAlgoValue,
            winRate,
            maxDrawdown,
            totalTrades: trades.length,
            buyTrades,
            sellTrades: trades.filter(t => t.action === 'SELL').length
        },
        buyHold: {
            roi: ((finalBhValue / initialCapital) - 1) * 100,
            finalValue: finalBhValue,
            shares: bhShares
        },
        trades,
        history,
        config: { weightTechnical, initialCapital }
    };
}

// ============== DATA FETCHING ==============

async function fetchHistoricalData(symbol: string, days: number) {
    const now = Math.floor(Date.now() / 1000);
    const from = now - days * 24 * 60 * 60;

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${from}&period2=${now}&interval=1d`;

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    const data = await response.json();

    if (!data.chart?.result?.[0]?.indicators?.quote?.[0]?.close) {
        throw new Error('Failed to fetch historical data');
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp || [];
    const closes = result.indicators.quote[0].close || [];

    // Filter out null values and pair with dates
    const validData: { price: number; date: string }[] = [];
    for (let i = 0; i < closes.length; i++) {
        if (closes[i] !== null) {
            validData.push({
                price: closes[i],
                date: new Date(timestamps[i] * 1000).toISOString().split('T')[0]
            });
        }
    }

    return validData;
}

// ============== API HANDLER ==============

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { symbol = 'NVDA', days = 180, weightTechnical = 70 } = body;

        // Fetch historical data
        const data = await fetchHistoricalData(symbol, days);

        if (data.length < 15) {
            return NextResponse.json(
                { error: `Not enough data points (got ${data.length}, need 15+)` },
                { status: 400 }
            );
        }

        const prices = data.map(d => d.price);
        const dates = data.map(d => d.date);

        // Run simulation
        const results = simulateAlgo(prices, dates, weightTechnical, INITIAL_CAPITAL);

        return NextResponse.json({
            success: true,
            symbol,
            days,
            dataPoints: data.length,
            ...results
        });

    } catch (error: any) {
        console.error('Backtest error:', error);
        return NextResponse.json(
            { error: error.message || 'Backtest failed' },
            { status: 500 }
        );
    }
}
