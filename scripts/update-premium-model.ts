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
        console.log(`  Current cheapModelId: ${activeSim.cheapModelId}`);

        // Update le modèle Cheap vers DeepSeek R1T Chimera (le meilleur gratuit)
        await prisma.simulationConfig.update({
            where: { id: activeSim.id },
            data: {
                cheapModelId: 'tngtech/deepseek-r1t-chimera:free'
            }
        });

        console.log('✅ Cheap model updated to: tngtech/deepseek-r1t-chimera:free');

    } catch (error) {
        console.error('❌ Update failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updatePremiumModel();
