import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Récupérer la simulation active avec historique complet
    const simulation = await prisma.simulationConfig.findFirst({
      where: { status: 'RUNNING' },
      include: {
        portfolios: {
          orderBy: { botType: 'asc' }
        },
        snapshots: {
          orderBy: { timestamp: 'asc' },
          include: {
            decisions: true
          }
        }
      }
    });

    if (!simulation) {
      return NextResponse.json({ active: false });
    }

    // Construire l'historique de ROI pour le graphique
    const roiHistory = simulation.snapshots.map((snap, index) => {
      const dayData: Record<string, number> = {
        day: index + 1,
        price: snap.price
      };
      
      simulation.portfolios.forEach(p => {
        const value = p.cash + p.shares * snap.price;
        dayData[p.botType] = ((value / simulation.startCapital) - 1) * 100;
      });
      
      return dayData;
    });

    // Récupérer les décisions récentes avec raisonnement
    const recentDecisions = await prisma.botDecision.findMany({
      where: {
        snapshot: { simulationId: simulation.id }
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        snapshot: {
          select: { timestamp: true, price: true }
        }
      }
    });

    return NextResponse.json({
      active: true,
      simulation: {
        id: simulation.id,
        symbol: simulation.symbol,
        startCapital: simulation.startCapital,
        currentDay: simulation.currentDay,
        durationDays: simulation.durationDays,
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
        roiHistory,
        recentDecisions: recentDecisions.map(d => ({
          botType: d.botType,
          action: d.action,
          quantity: d.quantity,
          price: d.price,
          reason: d.reason,
          confidence: d.confidence,
          timestamp: d.snapshot.timestamp
        }))
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
