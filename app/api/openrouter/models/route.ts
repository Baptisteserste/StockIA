import { NextResponse } from 'next/server';

export const revalidate = 86400; // Cache 24h

interface ProviderIcon {
  name: string;
  slug: string;
  iconUrl: string;
}

interface Model {
  id: string;
  name: string;
  pricing: { prompt: number; completion: number };
  context_length: number;
  providerName?: string;
  providerIcon?: string;
}

const DEFAULT_MODELS: Model[] = [
  {
    id: 'meta-llama/llama-3.2-3b-instruct',
    name: 'Llama 3.2 3B',
    pricing: { prompt: 0.00006, completion: 0.00006 },
    context_length: 131072,
    providerName: 'Meta',
    providerIcon: 'https://openrouter.ai/images/icons/Meta.png'
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B',
    pricing: { prompt: 0.00052, completion: 0.00052 },
    context_length: 131072,
    providerName: 'Meta',
    providerIcon: 'https://openrouter.ai/images/icons/Meta.png'
  },
  {
    id: 'x-ai/grok-beta',
    name: 'Grok Beta',
    pricing: { prompt: 0.0005, completion: 0.00015 },
    context_length: 131072,
    providerName: 'xAI',
    providerIcon: 'https://openrouter.ai/images/icons/xAI.png'
  }
];

const HUGGINGFACE_ICON = 'https://huggingface.co/front/assets/huggingface_logo-noborder.svg';

// Cache des providers en mémoire
let providersCache: Map<string, ProviderIcon> | null = null;
let providersCacheTime = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24h

async function fetchProviders(): Promise<Map<string, ProviderIcon>> {
  // Retourner le cache si valide
  if (providersCache && Date.now() - providersCacheTime < CACHE_DURATION) {
    return providersCache;
  }

  const map = new Map<string, ProviderIcon>();

  try {
    const res = await fetch('https://openrouter.ai/api/frontend/all-providers');
    if (!res.ok) {
      console.warn('Failed to fetch providers:', res.status);
      return map;
    }

    const json = await res.json();
    const providers = json.data || [];

    for (const provider of providers) {
      const name = provider.name;
      const slug = provider.slug;
      let iconUrl = provider.icon?.url;

      if (!name || !slug) continue;

      // Transformer les URLs relatives en absolues
      if (iconUrl && iconUrl.startsWith('/images/icons/')) {
        iconUrl = 'https://openrouter.ai' + iconUrl;
      }

      map.set(slug.toLowerCase(), {
        name,
        slug,
        iconUrl: iconUrl || HUGGINGFACE_ICON
      });
    }

    // Ajouter des fallbacks connus
    if (!map.has('huggingface')) {
      map.set('huggingface', {
        name: 'Hugging Face',
        slug: 'huggingface',
        iconUrl: HUGGINGFACE_ICON
      });
    }

    providersCache = map;
    providersCacheTime = Date.now();
    console.log(`Cached ${map.size} providers`);

  } catch (error) {
    console.error('Error fetching providers:', error);
  }

  return map;
}

// Mapping connu pour les slugs qui ne correspondent pas directement
const SLUG_ALIASES: Record<string, string> = {
  'google': 'google-vertex',
  'meta-llama': 'meta',
  'x-ai': 'xai',
  'qwen': 'alibaba',
  'nvidia': 'nim',
  'nousresearch': 'nous-research',
  '01-ai': '01-ai',
  'ibm-granite': 'ibm',
};

function getProviderFromModelId(modelId: string, providers: Map<string, ProviderIcon>): ProviderIcon | null {
  // Le slug est la première partie de l'id (ex: "openai/gpt-4" -> "openai")
  const slug = modelId.split('/')[0]?.toLowerCase();
  if (!slug) return null;

  // D'abord essayer le mapping exact
  if (providers.has(slug)) {
    return providers.get(slug)!;
  }

  // Ensuite essayer les alias
  const aliasSlug = SLUG_ALIASES[slug];
  if (aliasSlug && providers.has(aliasSlug)) {
    return providers.get(aliasSlug)!;
  }

  // Fallback: chercher un provider dont le slug contient le prefix
  for (const [providerSlug, provider] of providers) {
    if (providerSlug.includes(slug) || slug.includes(providerSlug)) {
      return provider;
    }
  }

  return null;
}

export async function GET() {
  try {
    // Fetch providers et models en parallèle
    const [providers, modelsRes] = await Promise.all([
      fetchProviders(),
      fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })
    ]);

    if (!modelsRes.ok) {
      console.warn('OpenRouter API failed, using fallback models');
      return NextResponse.json(DEFAULT_MODELS);
    }

    const data = await modelsRes.json();
    
    if (!data.data || !Array.isArray(data.data)) {
      console.warn('Invalid OpenRouter response format, using fallback');
      return NextResponse.json(DEFAULT_MODELS);
    }

    // Filtrer et mapper les modèles
    const models: Model[] = data.data
      .filter((m: any) => {
        // Exclure les modèles gratuits (marqués :free)
        if (m.id.includes(':free')) return false;
        
        // Exclure les modèles avec pricing invalide (négatif ou undefined)
        const promptPrice = parseFloat(m.pricing?.prompt);
        if (isNaN(promptPrice) || promptPrice < 0) return false;
        
        return true;
      })
      .map((m: any) => {
        const provider = getProviderFromModelId(m.id, providers);
        
        return {
          id: m.id,
          name: m.name,
          pricing: {
            prompt: parseFloat(m.pricing.prompt) || 0,
            completion: parseFloat(m.pricing.completion) || 0
          },
          context_length: m.context_length,
          providerName: provider?.name || 'Unknown',
          providerIcon: provider?.iconUrl || HUGGINGFACE_ICON
        };
      })
      .sort((a: Model, b: Model) => a.pricing.prompt - b.pricing.prompt);

    return NextResponse.json(models.length > 0 ? models : DEFAULT_MODELS);

  } catch (error) {
    console.error('Error fetching OpenRouter models:', error);
    return NextResponse.json(DEFAULT_MODELS);
  }
}
