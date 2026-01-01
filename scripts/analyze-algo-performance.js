/**
 * Algo Bot Performance Analyzer
 * 
 * Analyse si les décisions BUY de l'algo étaient correctes
 * en comparant le prix d'achat avec le prix actuel/futur
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzePerformance() {
    console.log('\n🔍 ALGO BOT PERFORMANCE ANALYSIS');
    console.log('='.repeat(60));

    // Récupérer tous les BUY de l'algo avec leur snapshot
    const buyDecisions = await prisma.botDecision.findMany({
        where: {
            botType: 'ALGO',
            action: 'BUY'
        },
        orderBy: { createdAt: 'asc' },
        include: {
            snapshot: {
                select: { timestamp: true, price: true, symbol: true }
            }
        }
    });

    if (buyDecisions.length === 0) {
        console.log('\n❌ Aucune décision BUY trouvée pour l\'algo bot');
        await prisma.$disconnect();
        return;
    }

    console.log(`\n📊 ${buyDecisions.length} décisions BUY trouvées\n`);

    // Pour chaque BUY, trouver le prix le plus récent disponible
    let wins = 0;
    let losses = 0;
    let totalPnL = 0;

    console.log('Date              | Prix Achat | Prix +tard | P&L      | Status');
    console.log('-'.repeat(65));

    for (const decision of buyDecisions) {
        const buyPrice = decision.price;
        const buyDate = decision.snapshot?.timestamp || decision.createdAt;
        const symbol = decision.snapshot?.symbol || 'UNKNOWN';

        // Trouver le snapshot le plus récent après cet achat
        const laterSnapshot = await prisma.marketSnapshot.findFirst({
            where: {
                symbol: symbol,
                timestamp: { gt: buyDate }
            },
            orderBy: { timestamp: 'desc' }
        });

        let laterPrice = buyPrice;
        let daysLater = 0;

        if (laterSnapshot) {
            laterPrice = laterSnapshot.price;
            daysLater = Math.round((new Date(laterSnapshot.timestamp).getTime() - new Date(buyDate).getTime()) / (1000 * 60 * 60 * 24));
        }

        const pnlPercent = ((laterPrice - buyPrice) / buyPrice) * 100;
        const isWin = pnlPercent > 0;

        if (isWin) wins++;
        else losses++;
        totalPnL += pnlPercent;

        const dateStr = new Date(buyDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const status = isWin ? '✅ WIN' : '❌ LOSS';
        const pnlStr = pnlPercent >= 0 ? `+${pnlPercent.toFixed(2)}%` : `${pnlPercent.toFixed(2)}%`;

        console.log(`${dateStr.padEnd(17)} | $${buyPrice.toFixed(2).padEnd(9)} | $${laterPrice.toFixed(2).padEnd(9)} | ${pnlStr.padEnd(8)} | ${status}`);
    }

    console.log('-'.repeat(65));

    const winRate = (wins / (wins + losses) * 100).toFixed(1);
    const avgPnL = (totalPnL / buyDecisions.length).toFixed(2);

    console.log('\n📈 RÉSUMÉ');
    console.log('='.repeat(40));
    console.log(`  Trades gagnants:  ${wins} ✅`);
    console.log(`  Trades perdants:  ${losses} ❌`);
    console.log(`  Win Rate:         ${winRate}%`);
    console.log(`  P&L Moyen:        ${avgPnL}%`);
    console.log('='.repeat(40));

    if (parseFloat(winRate) >= 60) {
        console.log('\n🎯 L\'algo a un bon hit rate (>60%)');
    } else if (parseFloat(winRate) >= 50) {
        console.log('\n⚖️ L\'algo est à 50/50, peut être amélioré');
    } else {
        console.log('\n⚠️ L\'algo a besoin d\'ajustements (win rate <50%)');
    }

    await prisma.$disconnect();
}

analyzePerformance().catch(console.error);
