import * as cheapAgent from '../lib/simulation/agents/cheap-agent';
import dotenv from 'dotenv';
import path from 'path';

// Charger .env pour utiliser ta clé OpenRouter locale
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Script de test pour diagnostiquer les réponses de l'Agent Cheap
 * N'utilise PAS la DB, juste des données mockées
 */

async function testCheapAgent() {
    console.log('🧪 Testing Cheap Agent (ISOLATED - No DB writes)');
    console.log('='.repeat(60));

    // Vérifier que la clé OpenRouter est chargée
    if (!process.env.OPENROUTER_API_KEY) {
        console.error('❌ OPENROUTER_API_KEY not found in .env file!');
        console.error('   Make sure your .env file exists and contains OPENROUTER_API_KEY');
        return;
    }
    console.log('✅ OpenRouter API Key loaded from .env');

    // Mock market snapshot (données réalistes)
    const mockSnapshot = {
        price: 147.32,
        rsi: 47.5,
        macd: -2.35,
        sentimentScore: 0.1,
        sentimentReason: 'Sentiment neutre sur les marchés'
    };

    // Mock portfolio (10k$ initial, pas encore acheté)
    const mockPortfolio = {
        cash: 10000,
        shares: 0
    };

    // Model ID - Qwen3 235B (le plus intelligent gratuit)
    const modelId = 'qwen/qwen3-235b-a22b:free';

    console.log('\n📊 Market Data:');
    console.log(JSON.stringify(mockSnapshot, null, 2));
    console.log('\n💰 Portfolio:');
    console.log(JSON.stringify(mockPortfolio, null, 2));
    console.log('\n🤖 Calling Cheap Agent...\n');

    try {
        const decision = await cheapAgent.decide(mockSnapshot, mockPortfolio, modelId);

        console.log('\n✅ Decision received:');
        console.log(JSON.stringify(decision, null, 2));

        // Vérifier si la raison est tronquée
        if (decision.reason.length < 20 || decision.reason.endsWith('de')) {
            console.log('\n⚠️  WARNING: Reason seems truncated!');
            console.log(`   Length: ${decision.reason.length} characters`);
        } else {
            console.log('\n✅ Reason looks complete');
            console.log(`   Length: ${decision.reason.length} characters`);
        }

    } catch (error) {
        console.error('\n❌ Error:', error);
    }
}

testCheapAgent();
