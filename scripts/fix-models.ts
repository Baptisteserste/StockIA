import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Mettre à jour la simulation active avec des modèles qui fonctionnent
  const result = await prisma.simulationConfig.updateMany({
    where: { status: 'RUNNING' },
    data: {
      // Modèles gratuits qui retournent du JSON proprement
      cheapModelId: 'x-ai/grok-4.1-fast:free',       // Gratuit, rapide, bon pour JSON
      premiumModelId: 'allenai/olmo-3-7b-instruct'   // Très bon marché, instruit
    }
  });
  
  console.log(`✅ ${result.count} simulation(s) mise(s) à jour`);
  console.log('Nouveaux modèles:');
  console.log('  - Cheap: x-ai/grok-4.1-fast:free');
  console.log('  - Premium: allenai/olmo-3-7b-instruct');
  
  // Vérifier
  const sim = await prisma.simulationConfig.findFirst({
    where: { status: 'RUNNING' }
  });
  
  if (sim) {
    console.log('\nSimulation active:', sim.id);
    console.log('  Symbol:', sim.symbol);
    console.log('  Cheap Model:', sim.cheapModelId);
    console.log('  Premium Model:', sim.premiumModelId);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
