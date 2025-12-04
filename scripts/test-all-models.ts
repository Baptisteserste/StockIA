import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MODELS_TO_TEST = [
    'qwen/qwen3-235b-a22b:free',
    'tngtech/deepseek-r1t-chimera:free',
    'allenai/olmo-3-32b-think:free',
    'nvidia/nemotron-nano-9b-v2:free',
    'google/gemma-3n-e4b-it:free',
    'qwen/qwen3-4b:free'
];

const prompt = `Vous êtes un trader. 

Données actuelles:
- Prix: 147.32$
- RSI: 47.5
- MACD: -2.35
- Sentiment: 0.1 (Sentiment neutre sur les marchés)

Portefeuille:
- Cash: 10000$
- Actions: 0

Règles: LONG-ONLY, décidez entre BUY, SELL ou HOLD.

Répondez en JSON strict:
{"action": "BUY"|"SELL"|"HOLD", "quantity": nombre, "reason": "explication", "confidence": 0-1}`;

async function testModel(modelId: string) {
    const start = Date.now();

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: modelId,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 300
            })
        });

        const elapsed = Date.now() - start;

        if (response.status === 404) {
            return { model: modelId, status: '404 NOT FOUND', elapsed };
        }
        if (response.status === 429) {
            return { model: modelId, status: '429 RATE LIMITED', elapsed };
        }
        if (!response.ok) {
            return { model: modelId, status: `ERROR ${response.status}`, elapsed };
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const usage = data.usage;

        // Extraire le JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        let parsed = null;
        if (jsonMatch) {
            try {
                parsed = JSON.parse(jsonMatch[0]);
            } catch { }
        }

        return {
            model: modelId,
            status: 'OK',
            elapsed,
            tokens: usage?.total_tokens,
            reasoning: usage?.completion_tokens_details?.reasoning_tokens || 0,
            action: parsed?.action || 'PARSE_ERROR',
            reason: parsed?.reason?.substring(0, 80) || content.substring(0, 80),
            confidence: parsed?.confidence
        };

    } catch (error: any) {
        return { model: modelId, status: `ERROR: ${error.message}`, elapsed: Date.now() - start };
    }
}

async function main() {
    console.log('🧪 Testing all free models for intelligence...\n');
    console.log('='.repeat(80));

    const results = [];

    for (const model of MODELS_TO_TEST) {
        console.log(`\n⏳ Testing ${model}...`);
        const result = await testModel(model);
        results.push(result);

        if (result.status === 'OK') {
            console.log(`   ✅ ${result.action} | ${result.elapsed}ms | ${result.tokens} tokens`);
            console.log(`   📝 ${result.reason}...`);
            if (result.reasoning > 0) {
                console.log(`   🧠 Reasoning tokens: ${result.reasoning}`);
            }
        } else {
            console.log(`   ❌ ${result.status}`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 SUMMARY:\n');

    const working = results.filter(r => r.status === 'OK');
    working.sort((a, b) => (b.reasoning || 0) - (a.reasoning || 0)); // Sort by reasoning tokens (thinking models first)

    console.log('Working models (sorted by intelligence):');
    for (const r of working) {
        const thinking = r.reasoning > 0 ? '🧠 THINKING' : '';
        console.log(`  ${r.model.padEnd(40)} ${r.action.padEnd(6)} ${r.elapsed}ms ${thinking}`);
    }

    const failed = results.filter(r => r.status !== 'OK');
    if (failed.length > 0) {
        console.log('\nFailed models:');
        for (const r of failed) {
            console.log(`  ${r.model.padEnd(40)} ${r.status}`);
        }
    }
}

main();
