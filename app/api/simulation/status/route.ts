import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Récupérer la simulation active
    const simulation = await prisma.simulationConfig.findFirst({
      where: { status: 'RUNNING' },
      include: {
        portfolios: {
          orderBy: { botType: 'asc' }
        },
        snapshots: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          include: {
            decisions: {
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    });

    if (!simulation) {
      return NextResponse.json({ active: false });
    }

    // Formater la réponse
    return NextResponse.json({
      active: true,
      simulation: {
        id: simulation.id,
        symbol: simulation.symbol,
        startCapital: simulation.startCapital,
        currentDay: simulation.currentDay,
        status: simulation.status,
        useReddit: simulation.useReddit,
        portfolios: simulation.portfolios.map(p => ({
          botType: p.botType,
          cash: p.cash,
          shares: p.shares,
          avgBuyPrice: p.avgBuyPrice,
          totalValue: p.totalValue,
          roi: p.roi
        })),
        latestSnapshot: simulation.snapshots[0] || null
      }
    });

  } catch (error: any) {
    console.error('Failed to fetch simulation status:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du statut', details: error.message },
      { status: 500 }
    );
  }
}
