import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Charger .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function exportDebugData() {
    const tickCount = parseInt(process.argv[2]) || 1; // Par défaut 1 tick

    console.log(`📥 Exporting last ${tickCount} tick(s) debug data...`);

    try {
        // Récupérer la simulation active
        const sim = await prisma.simulationConfig.findFirst({
            where: { status: 'RUNNING' },
            orderBy: { createdAt: 'desc' }
        });

        if (!sim) {
            console.log('❌ No active simulation found');
            return;
        }

        console.log(`Found simulation: ${sim.symbol} (Day ${sim.currentDay}/${sim.durationDays})`);

        // Récupérer les derniers snapshots avec décisions
        const snapshots = await prisma.marketSnapshot.findMany({
            where: { simulationId: sim.id },
            take: tickCount,
            orderBy: { timestamp: 'desc' },
            include: {
                decisions: {
                    include: {
                        snapshot: false // On a déjà le snapshot parent
                    }
                }
            }
        });

        // Formater les données
        const exportData = {
            exportedAt: new Date().toISOString(),
            simulation: {
                id: sim.id,
                symbol: sim.symbol,
                day: sim.currentDay,
                cheapModelId: sim.cheapModelId,
                premiumModelId: sim.premiumModelId
            },
            ticks: snapshots.map(snap => ({
                timestamp: snap.timestamp,
                market: {
                    price: snap.price,
                    rsi: snap.rsi,
                    macd: snap.macd,
                    sentimentScore: snap.sentimentScore,
                    sentimentReason: snap.sentimentReason,
                    stocktwitsBulls: snap.stocktwitsBulls,
                    stocktwitsBears: snap.stocktwitsBears,
                    fearGreedIndex: snap.fearGreedIndex,
                    fearGreedLabel: snap.fearGreedLabel
                },
                decisions: snap.decisions.map((d: any) => ({
                    botType: d.botType,
                    action: d.action,
                    quantity: d.quantity,
                    price: d.price,
                    reason: d.reason,
                    confidence: d.confidence,
                    debugData: d.debugData
                }))
            }))
        };

        // Sauvegarder en JSON
        const filename = `debug-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const filepath = path.join(process.cwd(), filename);

        fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));

        console.log(`\n✅ Exported to: ${filename}`);
        console.log(`\n📋 Quick summary:`);

        for (const tick of exportData.ticks) {
            console.log(`\n  📅 ${new Date(tick.timestamp).toLocaleString('fr-FR')}`);
            console.log(`  💰 Price: $${tick.market.price}`);
            for (const d of tick.decisions) {
                const debug = d.debugData as any;
                const hasError = debug?.error ? '❌' : '✅';
                console.log(`    ${hasError} ${d.botType}: ${d.action} (${d.reason.substring(0, 50)}...)`);
            }
        }

        // Afficher aussi en console pour copier-coller rapide
        console.log('\n' + '='.repeat(60));
        console.log('📋 Raw JSON (for copy-paste):');
        console.log('='.repeat(60));
        console.log(JSON.stringify(exportData, null, 2));

    } catch (error) {
        console.error('❌ Export failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

exportDebugData();
