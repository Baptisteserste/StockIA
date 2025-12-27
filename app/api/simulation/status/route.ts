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

    // Prix initial pour calculer Buy & Hold
    const initialPrice = simulation.snapshots[0]?.price || 1;

    // Construire l'historique de ROI pour le graphique
    const roiHistory = simulation.snapshots.map((snap, index) => {
      const dayData: Record<string, any> = {
        day: index + 1,
        price: snap.price,
        timestamp: snap.timestamp.toISOString() // Add snapshot timestamp for chart X-axis
      };

      simulation.portfolios.forEach(p => {
        const value = p.cash + p.shares * snap.price;
        dayData[p.botType] = ((value / simulation.startCapital) - 1) * 100;
      });

      // Buy & Hold: si on avait tout investi au jour 1
      dayData.BUYHOLD = ((snap.price / initialPrice) - 1) * 100;

      return dayData;
    });

    // Récupérer TOUTES les décisions avec raisonnement
    const recentDecisions = await prisma.botDecision.findMany({
      where: {
        snapshot: { simulationId: simulation.id }
      },
      orderBy: { createdAt: 'desc' },
      take: 500, // Increased to show all decisions in scrollable log
      include: {
        snapshot: {
          select: { timestamp: true, price: true }
        }
      }
    });

    // Calculer le jour actuel dynamiquement (différence entre maintenant et createdAt)
    const createdAt = new Date(simulation.createdAt);
    const now = new Date();
    const diffTime = now.getTime() - createdAt.getTime();
    const calculatedDay = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 car le premier jour = jour 1

    return NextResponse.json({
      active: true,
      simulation: {
        id: simulation.id,
        symbol: simulation.symbol,
        startCapital: simulation.startCapital,
        currentDay: calculatedDay,
        durationDays: simulation.durationDays,
        status: simulation.status,
        useReddit: simulation.useReddit,
        cheapModelId: simulation.cheapModelId,
        premiumModelId: simulation.premiumModelId,
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
          timestamp: d.snapshot.timestamp,
          tokens: d.tokens,
          cost: d.cost
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
