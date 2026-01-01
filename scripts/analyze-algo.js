const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyze() {
    const algoDecisions = await prisma.botDecision.findMany({
        where: { botType: 'ALGO' },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    const stats = {
        BUY: algoDecisions.filter(d => d.action === 'BUY').length,
        SELL: algoDecisions.filter(d => d.action === 'SELL').length,
        HOLD: algoDecisions.filter(d => d.action === 'HOLD').length
    };

    console.log('\n=== ALGO BOT STATS (dernières 50 décisions) ===');
    console.log('BUY:', stats.BUY, '| SELL:', stats.SELL, '| HOLD:', stats.HOLD);

    console.log('\nDernières décisions:');
    algoDecisions.slice(0, 15).forEach(d => {
        console.log(`  ${d.action.padEnd(4)} ${String(d.quantity).padEnd(6)} @ $${d.price?.toFixed(2)} - ${d.reason?.substring(0, 55)}`);
    });

    // Analyze portfolio state
    const portfolios = await prisma.portfolio.findMany({
        where: { botType: 'ALGO' },
        orderBy: { updatedAt: 'desc' },
        take: 5
    });

    console.log('\n=== ALGO PORTFOLIOS (dernières simulations) ===');
    portfolios.forEach(p => {
        const cashPercent = (p.cash / (p.cash + p.shares * 100) * 100).toFixed(0);
        console.log(`  Cash: $${p.cash.toFixed(0)} (${cashPercent}%) | Shares: ${p.shares.toFixed(2)} | ROI: ${p.roi.toFixed(2)}%`);
    });

    await prisma.$disconnect();
}
analyze();
