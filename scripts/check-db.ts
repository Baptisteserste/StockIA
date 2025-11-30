import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sim = await prisma.simulationConfig.findFirst({ 
    where: { status: 'RUNNING' },
    include: { portfolios: true }
  });
  console.log('=== Simulation Active ===');
  console.log(JSON.stringify(sim, null, 2));
  
  const decisions = await prisma.botDecision.findMany({
    orderBy: { id: 'desc' },
    take: 10
  });
  console.log('\n=== Dernières Décisions ===');
  console.log(JSON.stringify(decisions, null, 2));
  
  const snapshots = await prisma.marketSnapshot.findMany({
    orderBy: { timestamp: 'desc' },
    take: 5
  });
  console.log('\n=== Derniers Snapshots ===');
  console.log(JSON.stringify(snapshots, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
