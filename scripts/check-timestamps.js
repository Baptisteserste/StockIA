const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
    const sims = await prisma.simulationConfig.findMany({
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'asc' },
        include: { snapshots: { orderBy: { timestamp: 'asc' } } }
    });

    for (const sim of sims) {
        console.log('\n=== Simulation:', sim.symbol, sim.createdAt.toISOString(), '===');
        console.log('Snapshots:', sim.snapshots.length);
        if (sim.snapshots.length > 0) {
            console.log('First:', sim.snapshots[0].timestamp.toISOString());
            console.log('Last:', sim.snapshots[sim.snapshots.length - 1].timestamp.toISOString());
            console.log('All timestamps:');
            sim.snapshots.forEach((s, i) => {
                console.log(`  ${i + 1}: ${s.timestamp.toISOString()}`);
            });
        }
    }
    await prisma.$disconnect();
}
checkData();
