import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MODELS_TO_TEST = [
    'tngtech/deepseek-r1t-chimera:free',
    'tngtech/deepseek-r1t2-chimera:free',
    'allenai/olmo-3-32b-think:free',
    'nvidia/nemotron-nano-9b-v2:free'
];

const prompt = `Vous êtes un trader. 

Données: Prix 147.32$, RSI 47.5, MACD -2.35, Sentiment 0.1
Portefeuille: 10000$ cash, 0 actions

Répondez en JSON strict:
{"action": "BUY"|"SELL"|"HOLD", "quantity": nombre, "reason": "explication", "confidence": 0-1}`;

async function testModel(modelId: string) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${modelId}`);
    console.log('='.repeat(80));

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
                max_tokens: 2000
            })
        });

        console.log(`Status: ${response.status}`);

        if (!response.ok) {
            console.log(`Error: ${response.statusText}`);
            return;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        console.log(`\nRAW RESPONSE (${content.length} chars):`);
        console.log('---');
        console.log(content);
        console.log('---');

        console.log('\nUsage:', JSON.stringify(data.usage, null, 2));

    } catch (error: any) {
        console.log(`Error: ${error.message}`);
    }
}

async function main() {
    for (const model of MODELS_TO_TEST) {
        await testModel(model);
    }
}

main();
