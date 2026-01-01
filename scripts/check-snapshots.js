const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const sim = await prisma.simulationConfig.findFirst({ where: { status: 'RUNNING' } });
    if (!sim) { console.log('No running simulation'); return; }

    console.log('Simulation ID:', sim.id);

    const snapshots = await prisma.marketSnapshot.findMany({
        where: { simulationId: sim.id },
        orderBy: { timestamp: 'desc' },
        take: 10,
        select: { id: true, timestamp: true, price: true }
    });

    console.log('\nLast 10 snapshots:');
    snapshots.forEach(s => console.log(s.timestamp.toISOString(), '- price: $' + s.price.toFixed(2)));

    console.log('\nTotal snapshots:', await prisma.marketSnapshot.count({ where: { simulationId: sim.id } }));

    await prisma.$disconnect();
}
check();
