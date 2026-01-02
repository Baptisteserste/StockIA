import { NextRequest, NextResponse } from 'next/server';

// Fetch current stock price from Yahoo Finance
export async function GET(req: NextRequest) {
    const symbol = req.nextUrl.searchParams.get('symbol') || 'NVDA';

    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            next: { revalidate: 60 } // Cache for 60 seconds
        });

        const data = await response.json();

        if (!data.chart?.result?.[0]) {
            return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 });
        }

        const result = data.chart.result[0];
        const meta = result.meta;

        // Get the most recent price
        const quotes = result.indicators?.quote?.[0];
        const closes = quotes?.close || [];
        const lastValidClose = closes.filter((c: number | null) => c !== null).pop();

        const currentPrice = meta.regularMarketPrice || lastValidClose || meta.previousClose;

        return NextResponse.json({
            symbol: meta.symbol,
            price: currentPrice,
            previousClose: meta.previousClose,
            change: currentPrice - meta.previousClose,
            changePercent: ((currentPrice - meta.previousClose) / meta.previousClose) * 100,
            marketState: meta.marketState, // 'REGULAR', 'PRE', 'POST', 'CLOSED'
            timestamp: new Date().toISOString()
        });

    } catch (error: unknown) {
        console.error('Error fetching price:', error);
        return NextResponse.json(
            { error: 'Failed to fetch price' },
            { status: 500 }
        );
    }
}
