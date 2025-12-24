const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const sim = await prisma.simulationConfig.findFirst({
        where: { status: 'RUNNING' },
        orderBy: { createdAt: 'desc' }
    });
    console.log('Active Simulation:', JSON.stringify(sim, null, 2));

    // Get all simulations
    const allSims = await prisma.simulationConfig.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    console.log('\nRecent Simulations:', JSON.stringify(allSims, null, 2));
}

main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
        console.error(e);
        prisma.$disconnect();
    });
