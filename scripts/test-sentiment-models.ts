import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MODELS_TO_TEST = [
    'nvidia/nemotron-nano-9b-v2:free',
    'google/gemma-3n-e4b-it:free',
    'tngtech/deepseek-r1t-chimera:free',
    'qwen/qwen3-4b:free'
];

// Vrais titres de news financières
const headlines = `NVIDIA hits new all-time high as AI demand surges
Concerns grow over chip shortage affecting NVIDIA supply
Analysts raise NVIDIA price target to $200
NVIDIA faces increased competition from AMD
Strong earnings report exceeds Wall Street expectations`;

const prompt = `Analyse le sentiment de ces titres financiers pour NVDA. Réponds uniquement en JSON strict: {"score": nombre entre -1 et 1, "reason": "résumé en 20 mots max"}

Titres:
${headlines}`;

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
                max_tokens: 150
            })
        });

        const elapsed = Date.now() - start;

        if (response.status === 404) return { model: modelId, status: '404', elapsed };
        if (response.status === 429) return { model: modelId, status: '429 RATE LIMIT', elapsed };
        if (!response.ok) return { model: modelId, status: `ERROR ${response.status}`, elapsed };

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';
        const tokens = data.usage?.total_tokens || 0;

        // Parse JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        let parsed = null;
        if (jsonMatch) {
            try { parsed = JSON.parse(jsonMatch[0]); } catch { }
        }

        return {
            model: modelId,
            status: 'OK',
            elapsed,
            tokens,
            score: parsed?.score,
            reason: parsed?.reason?.substring(0, 60) || 'PARSE ERROR',
            valid: parsed !== null && typeof parsed.score === 'number'
        };

    } catch (error: any) {
        return { model: modelId, status: `ERROR: ${error.message}`, elapsed: Date.now() - start };
    }
}

async function main() {
    console.log('🧪 Testing models for SENTIMENT ANALYSIS task\n');
    console.log('Prompt: Analyze financial headlines → JSON {score, reason}\n');
    console.log('='.repeat(80));

    const results = [];

    for (const model of MODELS_TO_TEST) {
        console.log(`\n⏳ ${model}...`);
        const result = await testModel(model);
        results.push(result);

        if (result.status === 'OK') {
            const valid = result.valid ? '✅' : '⚠️';
            console.log(`   ${valid} Score: ${result.score} | ${result.elapsed}ms | ${result.tokens} tokens`);
            console.log(`   📝 ${result.reason}`);
        } else {
            console.log(`   ❌ ${result.status}`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n🏆 RANKING (sorted by: valid JSON, speed, tokens):\n');

    const working = results.filter(r => r.status === 'OK' && r.valid);
    working.sort((a, b) => (a.elapsed || 0) - (b.elapsed || 0));

    for (let i = 0; i < working.length; i++) {
        const r = working[i];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        console.log(`${medal} ${r.model}`);
        console.log(`   Score: ${r.score} | ${r.elapsed}ms | ${r.tokens} tokens`);
        console.log(`   "${r.reason}"\n`);
    }

    if (working.length > 0) {
        console.log(`\n✅ BEST FOR SENTIMENT: ${working[0].model}`);
    }
}

main();
