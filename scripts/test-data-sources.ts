import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testFinnhubCandles() {
    console.log('\n🕯️  Testing Finnhub Candles...');
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
        console.log('   ❌ FINNHUB_API_KEY not set');
        return;
    }

    const to = Math.floor(Date.now() / 1000);
    const from = to - 60 * 60 * 24 * 30; // 30 jours

    const res = await fetch(
        `https://finnhub.io/api/v1/stock/candle?symbol=NVDA&resolution=D&from=${from}&to=${to}&token=${apiKey}`
    );

    if (!res.ok) {
        console.log(`   ❌ HTTP ${res.status}`);
        return;
    }

    const data = await res.json();
    if (data.s === 'no_data') {
        console.log('   ❌ No data returned');
        return;
    }

    console.log(`   ✅ Got ${data.c?.length || 0} candles`);
    console.log(`   📊 Last close: $${data.c?.[data.c.length - 1]}`);
}

async function testStocktwits() {
    console.log('\n🐦 Testing Stocktwits...');

    const res = await fetch(
        'https://api.stocktwits.com/api/2/streams/symbol/NVDA.json',
        { headers: { 'User-Agent': 'StockIA v1.0' } }
    );

    if (!res.ok) {
        console.log(`   ❌ HTTP ${res.status}`);
        return;
    }

    const data = await res.json();
    const messages = data.messages || [];

    let bulls = 0, bears = 0;
    for (const msg of messages) {
        if (msg.entities?.sentiment?.basic === 'Bullish') bulls++;
        if (msg.entities?.sentiment?.basic === 'Bearish') bears++;
    }

    const total = bulls + bears;
    const bullPct = total > 0 ? Math.round((bulls / total) * 100) : 50;

    console.log(`   ✅ Got ${messages.length} messages`);
    console.log(`   📊 Bulls: ${bullPct}% | Bears: ${100 - bullPct}%`);
}

async function testFearGreed() {
    console.log('\n😱 Testing Fear & Greed Index...');

    const res = await fetch(
        'https://production.dataviz.cnn.io/index/fearandgreed/graphdata',
        { headers: { 'User-Agent': 'StockIA v1.0' } }
    );

    if (!res.ok) {
        console.log(`   ⚠️ CNN API failed, trying alternative...`);
        const altRes = await fetch('https://api.alternative.me/fng/?limit=1');
        if (altRes.ok) {
            const altData = await altRes.json();
            console.log(`   ✅ Alternative API: ${altData.data?.[0]?.value} (${altData.data?.[0]?.value_classification})`);
        } else {
            console.log('   ❌ Both APIs failed');
        }
        return;
    }

    const data = await res.json();
    console.log(`   ✅ Fear & Greed: ${Math.round(data.fear_and_greed?.score)} (${data.fear_and_greed?.rating})`);
}

async function testFinnhubNews() {
    console.log('\n📰 Testing Finnhub News...');
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
        console.log('   ❌ FINNHUB_API_KEY not set');
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const res = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=NVDA&from=${weekAgo}&to=${today}&token=${apiKey}`
    );

    if (!res.ok) {
        console.log(`   ❌ HTTP ${res.status}`);
        return;
    }

    const data = await res.json();
    console.log(`   ✅ Got ${data.length} news articles`);
    if (data.length > 0) {
        console.log(`   📰 Latest: "${data[0].headline?.substring(0, 60)}..."`);
    }
}

async function main() {
    console.log('🧪 Testing all data sources for Algo Bot\n');
    console.log('='.repeat(60));

    await testFinnhubCandles();
    await testFinnhubNews();
    await testStocktwits();
    await testFearGreed();

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Tests complete!');
}

main();
