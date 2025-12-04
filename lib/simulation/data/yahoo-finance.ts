/**
 * Yahoo Finance - Récupère les candles historiques (gratuit, pas de clé)
 */

export interface YahooCandle {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface YahooCandlesResult {
    candles: YahooCandle[];
    closes: number[];  // Pour les indicateurs techniques
}

/**
 * Récupère les candles depuis Yahoo Finance
 * @param symbol - Ticker (ex: NVDA)
 * @param days - Nombre de jours d'historique (défaut: 60)
 */
export async function fetchYahooCandles(symbol: string, days: number = 60): Promise<YahooCandlesResult | null> {
    try {
        const now = Math.floor(Date.now() / 1000);
        const from = now - days * 24 * 60 * 60;

        // Yahoo Finance API (non officielle mais stable)
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${from}&period2=${now}&interval=1d`;

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!res.ok) {
            console.warn(`Yahoo Finance API returned ${res.status} for ${symbol}`);
            return null;
        }

        const data = await res.json();
        const result = data.chart?.result?.[0];

        if (!result) {
            console.warn('Yahoo Finance: No data in response');
            return null;
        }

        const timestamps = result.timestamp || [];
        const quote = result.indicators?.quote?.[0];

        if (!quote) {
            console.warn('Yahoo Finance: No quote data');
            return null;
        }

        const candles: YahooCandle[] = [];
        const closes: number[] = [];

        for (let i = 0; i < timestamps.length; i++) {
            const close = quote.close?.[i];
            if (close !== null && close !== undefined) {
                candles.push({
                    timestamp: timestamps[i],
                    open: quote.open?.[i] || close,
                    high: quote.high?.[i] || close,
                    low: quote.low?.[i] || close,
                    close: close,
                    volume: quote.volume?.[i] || 0
                });
                closes.push(close);
            }
        }

        console.log(`Yahoo Finance: Got ${candles.length} candles for ${symbol}`);

        return { candles, closes };

    } catch (error) {
        console.error('Yahoo Finance fetch failed:', error);
        return null;
    }
}

/**
 * Récupère le prix actuel depuis Yahoo Finance
 */
export async function fetchYahooPrice(symbol: string): Promise<number | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!res.ok) return null;

        const data = await res.json();
        const quote = data.chart?.result?.[0]?.meta;

        return quote?.regularMarketPrice || null;

    } catch (error) {
        console.error('Yahoo Finance price fetch failed:', error);
        return null;
    }
}
