import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prompt = `Vous êtes un trader. 

Données actuelles:
- Prix: $142.50
- RSI: 35 (bas, proche oversold)
- MACD: -1.2 (négatif mais en amélioration)
- Sentiment: 0.7 (très positif)

Votre portefeuille: Cash: 10000$, Actions: 0

Répondez en JSON strict:
{"action": "BUY"|"SELL"|"HOLD", "quantity": nombre, "reason": "explication", "confidence": 0-1}`;

async function getAllFreeModels(): Promise<string[]> {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` }
    });
    const data = await res.json();

    // Filtrer les modèles gratuits (prompt = "0")
    const freeModels = data.data
        .filter((m: any) => m.pricing?.prompt === "0")
        .map((m: any) => m.id);

    return freeModels;
}

async function testModel(modelId: string): Promise<any> {
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
                max_tokens: 300
            })
        });

        const elapsed = Date.now() - start;

        if (response.status === 404) return { model: modelId, status: '404', elapsed };
        if (response.status === 429) return { model: modelId, status: '429', elapsed };
        if (!response.ok) return { model: modelId, status: `ERR${response.status}`, elapsed };

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';
        const tokens = data.usage?.total_tokens || 0;

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
            action: parsed?.action || 'PARSE_ERR',
            quantity: parsed?.quantity || 0,
            valid: parsed !== null && ['BUY', 'SELL', 'HOLD'].includes(parsed.action)
        };
    } catch (error: any) {
        return { model: modelId, status: 'ERROR', elapsed: Date.now() - start };
    }
}

async function main() {
    console.log('🔍 Fetching ALL free models from OpenRouter...\n');

    const freeModels = await getAllFreeModels();
    console.log(`Found ${freeModels.length} free models:\n`);
    freeModels.forEach(m => console.log(`  - ${m}`));

    console.log('\n' + '='.repeat(80));
    console.log('🧪 TESTING ALL FREE MODELS...\n');

    const results = [];

    for (let i = 0; i < freeModels.length; i++) {
        const model = freeModels[i];
        process.stdout.write(`[${i + 1}/${freeModels.length}] ${model.substring(0, 45).padEnd(45)}... `);

        const result = await testModel(model);
        results.push(result);

        if (result.valid) {
            console.log(`✅ ${result.action} ${result.quantity} (${result.elapsed}ms)`);
        } else if (result.status === '429') {
            console.log('⏳ Rate limited');
        } else if (result.status === '404') {
            console.log('❌ Not found');
        } else {
            console.log(`⚠️ ${result.status}`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n🏆 TOP 10 BEST FREE MODELS (valid JSON, fastest):\n');

    const working = results.filter(r => r.valid);
    working.sort((a, b) => a.elapsed - b.elapsed);

    console.log('Rank | Model'.padEnd(55) + '| Time    | Action');
    console.log('-'.repeat(80));

    for (let i = 0; i < Math.min(10, working.length); i++) {
        const r = working[i];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const modelShort = r.model.length > 45 ? r.model.substring(0, 42) + '...' : r.model;
        console.log(`${medal.padEnd(4)} ${modelShort.padEnd(48)} | ${(r.elapsed + 'ms').padEnd(7)} | ${r.action} ${r.quantity}`);
    }

    console.log('\n📌 Working models:', working.length, '/', freeModels.length);
}

main();
