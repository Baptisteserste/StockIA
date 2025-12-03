import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Charger .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function updatePremiumModel() {
    console.log('🔄 Updating Premium model in active simulation...');

    try {
        // Trouver la simulation active
        const activeSim = await prisma.simulationConfig.findFirst({
            where: { status: 'RUNNING' },
            orderBy: { createdAt: 'desc' }
        });

        if (!activeSim) {
            console.log('❌ No active simulation found.');
            return;
        }

        console.log(`Found simulation ${activeSim.id} (${activeSim.symbol})`);
        console.log(`  Current premiumModelId: ${activeSim.premiumModelId}`);

        // Update le modèle
        await prisma.simulationConfig.update({
            where: { id: activeSim.id },
            data: {
                premiumModelId: 'google/gemini-2.5-flash'
            }
        });

        console.log('✅ Premium model updated to: google/gemini-2.5-flash');

    } catch (error) {
        console.error('❌ Update failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updatePremiumModel();
