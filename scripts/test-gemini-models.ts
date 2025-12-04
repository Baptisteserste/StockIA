import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const headlines = `NVIDIA hits new all-time high as AI demand surges
Concerns grow over chip shortage affecting NVIDIA supply
Analysts raise NVIDIA price target to $200
NVIDIA faces increased competition from AMD
Strong earnings report exceeds Wall Street expectations`;

const prompt = `Analyse le sentiment global de ces titres financiers pour NVDA.

Retourne un objet JSON avec:
- score: nombre entre -1 (très négatif) et 1 (très positif)
- reason: résumé en 20 mots max

Titres:
${headlines}

JSON:`;

async function testGemini(modelId: string) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: modelId });
        const start = Date.now();
        const result = await model.generateContent(prompt);
        const elapsed = Date.now() - start;
        const text = result.response.text();

        const jsonMatch = text.match(/\{[\s\S]*?\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

        return { model: modelId, elapsed, text, parsed };
    } catch (e: any) {
        return { model: modelId, error: e.message };
    }
}

async function testOpenRouter(modelId: string) {
    try {
        const start = Date.now();
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
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';

        const jsonMatch = text.match(/\{[\s\S]*?\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

        return { model: modelId, elapsed, text, parsed };
    } catch (e: any) {
        return { model: modelId, error: e.message };
    }
}

async function main() {
    console.log('📊 COMPARATIF DÉTAILLÉ - Analyse de sentiment\n');
    console.log('Headlines analysés:');
    console.log(headlines);
    console.log('\n' + '='.repeat(80));

    // Test les 3 modèles
    const results = await Promise.all([
        testGemini('gemini-2.5-flash-lite'),
        testGemini('gemini-2.0-flash'),
        testOpenRouter('nvidia/nemotron-nano-9b-v2:free')
    ]);

    for (const r of results) {
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`🤖 ${r.model}`);
        console.log(`${'─'.repeat(80)}`);

        if (r.error) {
            console.log(`❌ Error: ${r.error}`);
            continue;
        }

        console.log(`⏱️  Temps: ${r.elapsed}ms`);
        console.log(`\n📝 Réponse brute:`);
        console.log(r.text);
        console.log(`\n✅ Parsed:`);
        console.log(`   Score: ${r.parsed?.score}`);
        console.log(`   Reason: ${r.parsed?.reason}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n🏆 RÉSUMÉ:\n');

    for (const r of results) {
        if (!r.error && r.parsed) {
            console.log(`${r.model.padEnd(35)} | Score: ${r.parsed.score?.toString().padEnd(4)} | ${r.elapsed}ms`);
        }
    }
}

main();
