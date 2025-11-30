/**
 * Fear & Greed Index - CNN Money
 * Sentiment global du marché (0-100)
 * 0-25: Extreme Fear
 * 25-45: Fear
 * 45-55: Neutral
 * 55-75: Greed
 * 75-100: Extreme Greed
 */

interface FearGreedData {
  value: number;        // 0-100
  label: string;        // "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
  timestamp: Date;
}

export async function fetchFearGreedIndex(): Promise<FearGreedData | null> {
  try {
    // CNN Fear & Greed API (non officielle mais stable)
    const res = await fetch(
      'https://production.dataviz.cnn.io/index/fearandgreed/graphdata',
      {
        headers: {
          'User-Agent': 'StockIA Trading Simulator v1.0'
        }
      }
    );

    if (!res.ok) {
      // Fallback: Alternative API
      return await fetchFearGreedAlternative();
    }

    const data = await res.json();
    
    // CNN retourne un objet avec fear_and_greed
    const fng = data.fear_and_greed;
    
    if (!fng || typeof fng.score !== 'number') {
      return await fetchFearGreedAlternative();
    }

    return {
      value: Math.round(fng.score),
      label: getLabelFromValue(fng.score),
      timestamp: new Date()
    };

  } catch (error) {
    console.error('CNN Fear & Greed fetch failed:', error);
    return await fetchFearGreedAlternative();
  }
}

/**
 * API alternative pour Fear & Greed (alternative.me - crypto focused mais similaire)
 */
async function fetchFearGreedAlternative(): Promise<FearGreedData | null> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1');
    
    if (!res.ok) {
      console.warn('Alternative Fear & Greed API failed');
      return null;
    }

    const data = await res.json();
    const fng = data.data?.[0];

    if (!fng) return null;

    const value = parseInt(fng.value, 10);

    return {
      value,
      label: fng.value_classification || getLabelFromValue(value),
      timestamp: new Date(parseInt(fng.timestamp, 10) * 1000)
    };

  } catch (error) {
    console.error('Alternative Fear & Greed fetch failed:', error);
    return null;
  }
}

function getLabelFromValue(value: number): string {
  if (value <= 25) return 'Extreme Fear';
  if (value <= 45) return 'Fear';
  if (value <= 55) return 'Neutral';
  if (value <= 75) return 'Greed';
  return 'Extreme Greed';
}

/**
 * Convertit Fear & Greed (0-100) en score -1 à +1
 * 0 (Extreme Fear) → -1
 * 50 (Neutral) → 0
 * 100 (Extreme Greed) → +1
 * 
 * Note: On peut inverser le signal pour être contrarian
 * (acheter quand les autres ont peur)
 */
export function fearGreedToScore(data: FearGreedData | null, contrarian: boolean = false): number {
  if (!data) return 0;
  
  // Convertir 0-100 en -1 à +1
  let score = (data.value - 50) / 50;
  
  // Mode contrarian: inverser le signal
  // "Be fearful when others are greedy, be greedy when others are fearful"
  if (contrarian) {
    score = -score;
  }
  
  return score;
}
