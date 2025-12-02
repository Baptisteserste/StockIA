import dotenv from 'dotenv';
import path from 'path';

// Charger .env (et non .env.local qui n'existe pas ici)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function triggerLocalTick() {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error('❌ CRON_SECRET not found in .env.local');
        process.exit(1);
    }

    const url = 'http://localhost:3000/api/cron/simulation-tick?force=true';
    console.log(`🚀 Triggering local simulation tick on ${url}...`);

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${cronSecret}`
            }
        });

        const status = response.status;
        const text = await response.text();

        console.log(`📡 Status: ${status}`);

        try {
            const json = JSON.parse(text);
            console.log('📦 Response:', JSON.stringify(json, null, 2));

            if (json.success) {
                console.log('✅ Tick executed successfully!');
            } else if (json.skipped) {
                console.log(`⚠️ Tick skipped: ${json.reason}`);
            } else {
                console.error('❌ Tick failed:', json.error);
            }
        } catch (e) {
            console.log('📄 Body:', text);
        }

    } catch (error) {
        console.error('❌ Failed to call API:', error);
    }
}

triggerLocalTick();
