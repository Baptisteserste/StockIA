import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function checkAPIs() {
    console.log('🔍 Checking all API keys from .env...\n');

    const results: { api: string; status: string; details?: string }[] = [];

    // 1. OpenRouter
    console.log('Testing OpenRouter...');
    try {
        if (!process.env.OPENROUTER_API_KEY) throw new Error('Key not set');
        const res = await fetch('https://openrouter.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` }
        });
        if (res.ok) {
            const data = await res.json();
            results.push({ api: 'OPENROUTER_API_KEY', status: '✅ OK', details: `${data.data?.length} models available` });
        } else {
            results.push({ api: 'OPENROUTER_API_KEY', status: '❌ FAIL', details: `HTTP ${res.status}` });
        }
    } catch (e: any) {
        results.push({ api: 'OPENROUTER_API_KEY', status: '❌ FAIL', details: e.message });
    }

    // 2. Finnhub
    console.log('Testing Finnhub...');
    try {
        if (!process.env.FINNHUB_API_KEY) throw new Error('Key not set');
        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=NVDA&token=${process.env.FINNHUB_API_KEY}`);
        if (res.ok) {
            const data = await res.json();
            results.push({ api: 'FINNHUB_API_KEY', status: '✅ OK', details: `NVDA price: $${data.c}` });
        } else {
            results.push({ api: 'FINNHUB_API_KEY', status: '❌ FAIL', details: `HTTP ${res.status}` });
        }
    } catch (e: any) {
        results.push({ api: 'FINNHUB_API_KEY', status: '❌ FAIL', details: e.message });
    }

    // 3. Gemini
    console.log('Testing Gemini...');
    try {
        if (!process.env.GEMINI_API_KEY) throw new Error('Key not set');
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent('Reply with just "OK"');
        const text = result.response.text();
        results.push({ api: 'GEMINI_API_KEY', status: '✅ OK', details: `Response: "${text.trim()}"` });
    } catch (e: any) {
        results.push({ api: 'GEMINI_API_KEY', status: '❌ FAIL', details: e.message });
    }

    // 4. Database
    console.log('Testing Database...');
    try {
        if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        const count = await prisma.simulationConfig.count();
        await prisma.$disconnect();
        results.push({ api: 'DATABASE_URL', status: '✅ OK', details: `${count} simulations in DB` });
    } catch (e: any) {
        results.push({ api: 'DATABASE_URL', status: '❌ FAIL', details: e.message });
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESULTS:');
    console.log('='.repeat(60));

    for (const r of results) {
        console.log(`${r.status} ${r.api.padEnd(25)} ${r.details || ''}`);
    }

    const failed = results.filter(r => r.status.includes('❌'));
    if (failed.length > 0) {
        console.log('\n⚠️  Some APIs failed! Check your .env file.');
    } else {
        console.log('\n🎉 All APIs working!');
    }
}

checkAPIs();
