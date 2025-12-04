/**
 * Utilitaire pour récupérer les modèles gratuits disponibles sur OpenRouter
 * et fournir un fallback automatique en cas de 404
 */

interface OpenRouterModel {
    id: string;
    name: string;
    pricing: {
        prompt: string;
        completion: string;
    };
    context_length: number;
}

// Liste de fallback en dur (modèles gratuits triés par intelligence)
const FALLBACK_FREE_MODELS = [
    'qwen/qwen3-235b-a22b:free',           // 235B - le plus gros
    'tngtech/deepseek-r1t-chimera:free',   // Reasoning/thinking
    'allenai/olmo-3-32b-think:free',       // 32B thinking
    'nvidia/nemotron-nano-9b-v2:free',     // 9B Nvidia
    'google/gemma-3n-e4b-it:free',         // 4B Google
    'qwen/qwen3-4b:free',                  // 4B Qwen
    'amazon/nova-2-lite-v1:free'           // Amazon Nova
];

/**
 * Récupère la liste des modèles gratuits depuis OpenRouter
 */
export async function getFreeModels(): Promise<string[]> {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
            }
        });

        if (!response.ok) {
            console.warn('Failed to fetch OpenRouter models, using fallback list');
            return FALLBACK_FREE_MODELS;
        }

        const data = await response.json();
        const freeModels = data.data
            .filter((m: OpenRouterModel) =>
                m.pricing.prompt === '0' && m.pricing.completion === '0'
            )
            .map((m: OpenRouterModel) => m.id);

        return freeModels.length > 0 ? freeModels : FALLBACK_FREE_MODELS;
    } catch (error) {
        console.warn('Error fetching models:', error);
        return FALLBACK_FREE_MODELS;
    }
}

/**
 * Vérifie si un modèle est disponible (pas 404)
 */
export async function isModelAvailable(modelId: string): Promise<boolean> {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: modelId,
                messages: [{ role: 'user', content: 'test' }],
                max_tokens: 1
            })
        });

        // 404 = modèle n'existe pas, on retourne false
        if (response.status === 404) {
            return false;
        }

        // 429 = rate limit mais modèle existe
        // 200 = OK
        return true;
    } catch {
        return false;
    }
}

/**
 * Trouve un modèle gratuit disponible comme fallback
 */
export async function findAvailableFreeModel(excludeModel?: string): Promise<string | null> {
    const freeModels = await getFreeModels();

    for (const model of freeModels) {
        if (model === excludeModel) continue;

        const available = await isModelAvailable(model);
        if (available) {
            console.log(`Found available free model: ${model}`);
            return model;
        }
    }

    console.error('No free models available!');
    return null;
}

/**
 * Wrapper pour appeler un modèle avec fallback automatique
 */
export async function callWithFallback(
    modelId: string,
    messages: { role: string; content: string }[],
    options: { max_tokens?: number; temperature?: number } = {}
): Promise<{ content: string; model: string; error?: string }> {

    const makeRequest = async (model: string) => {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                messages,
                max_tokens: options.max_tokens || 200,
                temperature: options.temperature || 0.7
            })
        });

        return { response, model };
    };

    // Premier essai avec le modèle demandé
    let { response, model } = await makeRequest(modelId);

    // Si 404, on cherche un fallback
    if (response.status === 404) {
        console.warn(`Model ${modelId} not found (404), looking for fallback...`);

        const fallbackModel = await findAvailableFreeModel(modelId);
        if (fallbackModel) {
            ({ response, model } = await makeRequest(fallbackModel));
        } else {
            return { content: '', model: modelId, error: 'No models available' };
        }
    }

    if (!response.ok) {
        return { content: '', model, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return { content, model };
}
