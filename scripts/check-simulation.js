const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const sim = await prisma.simulationConfig.findFirst({ where: { status: 'RUNNING' } });
    if (!sim) { console.log('No running simulation'); return; }

    console.log('Simulation ID:', sim.id);
    console.log('Created At:', sim.createdAt.toISOString());
    console.log('Duration Days:', sim.durationDays);

    const now = new Date();
    const diffMs = now.getTime() - sim.createdAt.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    console.log('Days since start:', diffDays.toFixed(2));
    console.log('Calculated Day:', Math.floor(diffDays) + 1);

    const totalDecisions = await prisma.botDecision.count({
        where: { snapshot: { simulationId: sim.id } }
    });
    console.log('Total Decisions:', totalDecisions);

    await prisma.$disconnect();
}
check();
