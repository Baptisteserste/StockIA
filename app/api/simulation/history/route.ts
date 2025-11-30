import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { SimulationConfig, Portfolio, MarketSnapshot, BotDecision } from '@prisma/client';

type SimulationWithRelations = SimulationConfig & {
  portfolios: Portfolio[];
  snapshots: (MarketSnapshot & { decisions: BotDecision[] })[];
};

export async function GET() {
  try {
    // Récupérer les simulations terminées (COMPLETED ou IDLE avec currentDay > 0)
    const simulations = await prisma.simulationConfig.findMany({
      where: {
        OR: [
          { status: 'COMPLETED' },
          { status: 'IDLE', currentDay: { gt: 0 } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
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
    }) as SimulationWithRelations[];

    // Formater les données pour le frontend
    const history = simulations.map((sim) => {
      // Prix initial pour Buy & Hold
      const initialPrice = sim.snapshots[0]?.price || 1;
      
      // Construire l'historique ROI
      const roiHistory = sim.snapshots.map((snap: MarketSnapshot, index: number) => {
        const dayData: Record<string, number> = {
          day: index + 1,
          price: snap.price
        };
        
        sim.portfolios.forEach((p: Portfolio) => {
          const value = p.cash + p.shares * snap.price;
          dayData[p.botType] = ((value / sim.startCapital) - 1) * 100;
        });

        // Buy & Hold
        dayData.BUYHOLD = ((snap.price / initialPrice) - 1) * 100;
        
        return dayData;
      });

      // Trouver le gagnant
      const winner = sim.portfolios.reduce((best: Portfolio, p: Portfolio) => 
        p.roi > best.roi ? p : best
      , sim.portfolios[0]);

      // Toutes les décisions avec leur jour
      const decisions = sim.snapshots.flatMap((snap: MarketSnapshot & { decisions: BotDecision[] }, dayIndex: number) =>
        snap.decisions.map((d: BotDecision) => ({
          day: dayIndex + 1,
          botType: d.botType,
          action: d.action,
          quantity: d.quantity,
          price: d.price,
          reason: d.reason,
          confidence: d.confidence,
          timestamp: snap.timestamp
        }))
      ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return {
        id: sim.id,
        symbol: sim.symbol,
        startCapital: sim.startCapital,
        durationDays: sim.durationDays,
        currentDay: sim.currentDay,
        status: sim.status,
        createdAt: sim.createdAt,
        updatedAt: sim.updatedAt,
        winner: winner ? {
          botType: winner.botType,
          roi: winner.roi,
          totalValue: winner.totalValue
        } : null,
        portfolios: sim.portfolios.map((p: Portfolio) => ({
          botType: p.botType,
          cash: p.cash,
          shares: p.shares,
          totalValue: p.totalValue,
          roi: p.roi
        })),
        roiHistory,
        decisions
      };
    });

    return NextResponse.json({ history });

  } catch (error: any) {
    console.error('Failed to fetch simulation history:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'historique', details: error.message },
      { status: 500 }
    );
  }
}
