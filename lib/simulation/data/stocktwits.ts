/**
 * Stocktwits API - Récupère le sentiment social pour un ticker
 * API gratuite, pas de clé requise
 */

interface StocktwitsData {
  bullish: number;      // % bullish (0-100)
  bearish: number;      // % bearish (0-100)
  volume: number;       // Nombre de messages
  trending: boolean;    // Est-ce que le ticker est trending
}

export async function fetchStocktwitsSentiment(symbol: string): Promise<StocktwitsData | null> {
  try {
    const res = await fetch(
      `https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json`,
      {
        headers: {
          'User-Agent': 'StockIA Trading Simulator v1.0'
        }
      }
    );

    if (!res.ok) {
      console.warn(`Stocktwits API returned ${res.status} for ${symbol}`);
      return null;
    }

    const data = await res.json();

    // Compter les sentiments dans les messages récents
    const messages = data.messages || [];
    let bullCount = 0;
    let bearCount = 0;

    for (const msg of messages) {
      if (msg.entities?.sentiment?.basic === 'Bullish') {
        bullCount++;
      } else if (msg.entities?.sentiment?.basic === 'Bearish') {
        bearCount++;
      }
    }

    const total = bullCount + bearCount;
    
    // Calculer les pourcentages
    const bullish = total > 0 ? Math.round((bullCount / total) * 100) : 50;
    const bearish = total > 0 ? Math.round((bearCount / total) * 100) : 50;

    // Vérifier si trending
    const trending = data.symbol?.is_following || false;

    return {
      bullish,
      bearish,
      volume: messages.length,
      trending
    };

  } catch (error) {
    console.error('Stocktwits fetch failed:', error);
    return null;
  }
}

/**
 * Convertit le ratio bulls/bears en score -1 à +1
 * 50% bulls = 0 (neutre)
 * 100% bulls = +1 (très bullish)
 * 0% bulls = -1 (très bearish)
 */
export function stocktwitsToScore(data: StocktwitsData | null): number {
  if (!data) return 0;
  
  // Convertir 0-100 en -1 à +1
  // 50 → 0, 100 → 1, 0 → -1
  return (data.bullish - 50) / 50;
}
