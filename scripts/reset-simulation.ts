import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Charger .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function resetSimulation() {
    console.log('🔄 Resetting active simulation portfolios...');

    try {
        // Trouver la dernière simulation (peu importe le statut)
        const activeSim = await prisma.simulationConfig.findFirst({
            orderBy: { createdAt: 'desc' },
            include: { portfolios: true }
        });

        if (!activeSim) {
            console.log('❌ No simulation found.');
            return;
        }

        console.log(`Found simulation ${activeSim.id} (${activeSim.symbol}) - Status: ${activeSim.status}`);

        // Réactiver la simulation si nécessaire
        if (activeSim.status === 'COMPLETED' || activeSim.currentDay > 0) {
            await prisma.simulationConfig.update({
                where: { id: activeSim.id },
                data: {
                    status: 'RUNNING',
                    currentDay: 0
                }
            });
            console.log('🔄 Reactivated simulation (Status: RUNNING, Day: 0)');
        }

        // Reset des portfolios
        for (const portfolio of activeSim.portfolios) {
            await prisma.portfolio.update({
                where: { id: portfolio.id },
                data: {
                    cash: activeSim.startCapital,
                    shares: 0,
                    totalValue: activeSim.startCapital,
                    roi: 0,
                    avgBuyPrice: null
                }
            });
            console.log(`✅ Reset portfolio for ${portfolio.botType}: ${activeSim.startCapital}$`);
        }

        console.log('✨ Simulation portfolios reset successfully!');

    } catch (error) {
        console.error('❌ Reset failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

resetSimulation();
