import { NextResponse } from 'next/server';

export const revalidate = 86400; // Cache 24h

const DEFAULT_MODELS = [
  {
    id: 'meta-llama/llama-3.2-3b-instruct',
    name: 'Llama 3.2 3B',
    pricing: { prompt: 0.00006, completion: 0.00006 },
    context_length: 131072
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B',
    pricing: { prompt: 0.00052, completion: 0.00052 },
    context_length: 131072
  },
  {
    id: 'x-ai/grok-beta',
    name: 'Grok Beta',
    pricing: { prompt: 0.0005, completion: 0.00015 },
    context_length: 131072
  }
];

export async function GET() {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('OpenRouter API failed, using fallback models');
      return NextResponse.json(DEFAULT_MODELS);
    }

    const data = await response.json();
    
    if (!data.data || !Array.isArray(data.data)) {
      console.warn('Invalid OpenRouter response format, using fallback');
      return NextResponse.json(DEFAULT_MODELS);
    }

    // Filtrer et mapper les modèles
    const models = data.data
      .filter((m: any) => 
        !m.id.includes('free') && 
        m.pricing?.prompt !== undefined
      )
      .map((m: any) => ({
        id: m.id,
        name: m.name,
        pricing: {
          prompt: m.pricing.prompt,
          completion: m.pricing.completion
        },
        context_length: m.context_length
      }))
      .sort((a: any, b: any) => a.pricing.prompt - b.pricing.prompt);

    return NextResponse.json(models.length > 0 ? models : DEFAULT_MODELS);

  } catch (error) {
    console.error('Error fetching OpenRouter models:', error);
    return NextResponse.json(DEFAULT_MODELS);
  }
}
