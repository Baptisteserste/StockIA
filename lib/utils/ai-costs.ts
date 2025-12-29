export const AI_MODELS_PRICING = {
    "mistralai/mistral-7b-instruct": 0.00013,
    "default": 0.0002
};

export function calculateAICost(modelId: string, tokens: number): number {
    const rate = AI_MODELS_PRICING[modelId as keyof typeof AI_MODELS_PRICING] || AI_MODELS_PRICING.default;
    return (tokens / 1000) * rate;
}