import prisma from '@/lib/prisma';

export async function getBotContext(
  simulationId: string,
  botType: 'CHEAP' | 'PREMIUM' | 'ALGO',
  limit = 3
): Promise<string> {
  try {
    const decisions = await prisma.botDecision.findMany({
      where: {
        snapshot: { simulationId },
        botType
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { snapshot: true }
    });

    if (decisions.length === 0) {
      return "Première décision de trading.";
    }

    return decisions.reverse().map((d, i) => 
      `${i + 1}. ${d.action} ${d.quantity} actions à ${d.price}$ - ${d.reason}`
    ).join('\n');
  } catch (error) {
    console.error('Error fetching bot context:', error);
    return "Historique indisponible.";
  }
}
