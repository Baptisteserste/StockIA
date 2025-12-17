import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Les 3 Nemotron gratuits à comparer
const MODELS_TO_TEST = [
    'nvidia/nemotron-3-nano-30b-a3b:free',        // 30B params
    'nvidia/nemotron-nano-12b-v2-vl:free',        // 12B params (vision)
    'nvidia/nemotron-nano-9b-v2:free',            // 9B params
];

const prompt = `Vous êtes un trader. 

Données actuelles:
- Prix: $142.50
- RSI: 35 (bas, proche oversold)
- MACD: -1.2 (négatif mais en amélioration)
- Sentiment: 0.7 (très positif, news favorables)

Votre portefeuille:
- Cash: 10000$
- Actions: 0

Règles:
- LONG-ONLY: Ne vendez que si vous possédez des actions
- Décidez entre BUY, SELL ou HOLD

Répondez en JSON strict:
{"action": "BUY"|"SELL"|"HOLD", "quantity": nombre, "reason": "explication courte", "confidence": 0-1}`;

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
                max_tokens: 500
            })
        });

        const elapsed = Date.now() - start;

        if (response.status === 404) return { model: modelId, status: '404 NOT FOUND', elapsed };
        if (response.status === 429) return { model: modelId, status: '429 RATE LIMIT', elapsed };
        if (!response.ok) return { model: modelId, status: `ERROR ${response.status}`, elapsed };

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';
        const tokens = data.usage?.total_tokens || 0;

        // Parse JSON
        const jsonMatch = text.match(/\{[\s\S]*?\}/);
        let parsed = null;
        if (jsonMatch) {
            try { parsed = JSON.parse(jsonMatch[0]); } catch { }
        }

        return {
            model: modelId,
            status: 'OK',
            elapsed,
            tokens,
            action: parsed?.action || 'PARSE_ERROR',
            quantity: parsed?.quantity,
            reason: parsed?.reason?.substring(0, 80) || text.substring(0, 80),
            valid: parsed !== null && ['BUY', 'SELL', 'HOLD'].includes(parsed.action)
        };
    } catch (error: any) {
        return { model: modelId, status: `ERROR: ${error.message.substring(0, 50)}`, elapsed: Date.now() - start };
    }
}

async function main() {
    console.log('🧪 Testing FREE models for trading decisions\n');
    console.log('='.repeat(80));

    const results = [];

    for (const model of MODELS_TO_TEST) {
        console.log(`\n⏳ ${model}...`);
        const result = await testModel(model);
        results.push(result);

        if (result.status === 'OK') {
            const valid = result.valid ? '✅' : '⚠️';
            console.log(`   ${valid} ${result.action} ${result.quantity || 0} | ${result.elapsed}ms | ${result.tokens} tok`);
            console.log(`   📝 ${result.reason}`);
        } else {
            console.log(`   ❌ ${result.status}`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n🏆 RANKING (valid JSON, speed):\n');

    const working = results.filter(r => r.status === 'OK' && r.valid);
    working.sort((a, b) => (a.elapsed || 0) - (b.elapsed || 0));

    for (let i = 0; i < working.length; i++) {
        const r = working[i];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        console.log(`${medal} ${r.action.padEnd(4)} ${String(r.quantity).padEnd(4)} | ${(r.elapsed + 'ms').padEnd(8)} | ${r.model}`);
    }

    console.log('\n📌 RECOMMENDATION:');
    if (working.length > 0) {
        console.log(`   CHEAP:   ${working[0].model} (fastest)`);
        console.log(`   PREMIUM: google/gemini-2.5-flash ou anthropic/claude-3.5-sonnet`);
    }
}

main();
