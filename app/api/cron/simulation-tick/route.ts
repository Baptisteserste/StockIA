import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createMarketSnapshot } from '@/lib/simulation/data-aggregator';
import * as cheapAgent from '@/lib/simulation/agents/cheap-agent';
import * as premiumAgent from '@/lib/simulation/agents/premium-agent';
import * as algoAgent from '@/lib/simulation/agents/algo-agent';

export async function GET(req: NextRequest) {
  // Auth - Support multiple methods
  const authHeader = req.headers.get('authorization');
  const headerKey = req.headers.get('x-cron-key');
  const url = new URL(req.url);
  const queryKey = url.searchParams.get('key');

  const bearerOk = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const headerKeyOk = headerKey === process.env.CRON_SECRET;
  const queryKeyOk = queryKey === process.env.CRON_SECRET;

  if (!bearerOk && !headerKeyOk && !queryKeyOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Guard weekday (lundi=1 à vendredi=5)
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) {
    return NextResponse.json({ skipped: true, reason: 'weekend' });
  }

  // Idempotence check
  const rounded = new Date(now);
  rounded.setMinutes(0, 0, 0);
  
  const existing = await prisma.marketSnapshot.findFirst({
    where: { timestamp: rounded }
  });
  
  if (existing) {
    return NextResponse.json({ skipped: true, reason: 'already_processed' });
  }

  try {
    // Fetch simulation active
    const config = await prisma.simulationConfig.findFirst({
      where: { status: 'RUNNING' },
      include: { portfolios: true }
    });

    if (!config) {
      return NextResponse.json({ message: 'No active simulation' });
    }

    // Valider le symbole
    const quoteTest = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${config.symbol}&token=${process.env.FINNHUB_API_KEY}`
    );
    
    if (!quoteTest.ok) {
      return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
    }
    
    const quote = await quoteTest.json();
    if (quote.c === undefined) {
      return NextResponse.json({ error: 'No data for symbol' }, { status: 400 });
    }

    // Créer snapshot de marché
    const snapshot = await createMarketSnapshot(
      config.id,
      config.symbol,
      config.useReddit
    );

    // Trouver les portfolios
    const cheapPortfolio = config.portfolios.find(p => p.botType === 'CHEAP');
    const premiumPortfolio = config.portfolios.find(p => p.botType === 'PREMIUM');
    const algoPortfolio = config.portfolios.find(p => p.botType === 'ALGO');

    if (!cheapPortfolio || !premiumPortfolio || !algoPortfolio) {
      return NextResponse.json({ error: 'Portfolios not initialized' }, { status: 500 });
    }

    // Exécuter les agents en parallèle
    const [cheapResult, premiumResult, algoResult] = await Promise.all([
      cheapAgent.decide(
        { ...snapshot, simulationId: config.id },
        cheapPortfolio,
        config.cheapModelId
      ),
      premiumAgent.decide(
        { ...snapshot, simulationId: config.id },
        premiumPortfolio,
        config.premiumModelId
      ),
      Promise.resolve(algoAgent.decide(
        snapshot,
        algoPortfolio,
        { weightTechnical: 60, weightSentiment: 40 }
      ))
    ]);

    // Préparer les décisions
    const decisions = [
      { botType: 'CHEAP', ...cheapResult, portfolio: cheapPortfolio },
      { botType: 'PREMIUM', ...premiumResult, portfolio: premiumPortfolio },
      { botType: 'ALGO', ...algoResult, portfolio: algoPortfolio }
    ];

    // Exécuter en transaction
    await prisma.$transaction(async (tx) => {
      for (const decision of decisions) {
        const { action, quantity, portfolio } = decision;

        // Validation
        if (action === 'BUY' && quantity * snapshot.price > portfolio.cash) {
          console.warn(`${decision.botType}: BUY order skipped (insufficient funds)`);
          continue;
        }
        if (action === 'SELL' && (quantity > portfolio.shares || portfolio.shares === 0)) {
          console.warn(`${decision.botType}: SELL order skipped (insufficient shares)`);
          continue;
        }

        // Récupérer le snapshot créé
        const dbSnapshot = await tx.marketSnapshot.findFirst({
          where: {
            simulationId: config.id,
            symbol: config.symbol
          },
          orderBy: { timestamp: 'desc' }
        });

        if (!dbSnapshot) {
          throw new Error('Snapshot not found in database');
        }

        // Insérer la décision
        await tx.botDecision.create({
          data: {
            snapshotId: dbSnapshot.id,
            botType: decision.botType as 'CHEAP' | 'PREMIUM' | 'ALGO',
            action,
            quantity,
            price: snapshot.price,
            reason: decision.reason,
            confidence: decision.confidence
          }
        });

        // Calculer nouveau portfolio
        const newShares = action === 'BUY' 
          ? portfolio.shares + quantity 
          : portfolio.shares - quantity;
        
        const newCash = action === 'BUY'
          ? portfolio.cash - (quantity * snapshot.price)
          : portfolio.cash + (quantity * snapshot.price);

        const newAvgPrice = action === 'BUY' && newShares > 0
          ? ((portfolio.avgBuyPrice || 0) * portfolio.shares + snapshot.price * quantity) / newShares
          : portfolio.avgBuyPrice;

        const newTotalValue = newCash + (newShares * snapshot.price);
        const newRoi = ((newTotalValue / config.startCapital) - 1) * 100;

        // Mettre à jour le portfolio
        await tx.portfolio.update({
          where: { id: portfolio.id },
          data: {
            cash: newCash,
            shares: newShares,
            avgBuyPrice: newAvgPrice,
            totalValue: newTotalValue,
            roi: newRoi
          }
        });
      }
    });

    // Incrémenter le jour
    const newDay = config.currentDay + 1;
    const maxDays = config.durationDays || 21;
    const newStatus = newDay >= maxDays ? 'COMPLETED' : 'RUNNING';

    await prisma.simulationConfig.update({
      where: { id: config.id },
      data: { 
        currentDay: newDay,
        status: newStatus as 'IDLE' | 'RUNNING' | 'COMPLETED'
      }
    });

    return NextResponse.json({
      success: true,
      day: newDay,
      status: newStatus,
      decisions: decisions.map(d => ({
        botType: d.botType,
        action: d.action,
        quantity: d.quantity,
        reason: d.reason
      }))
    });

  } catch (error: any) {
    console.error('Cron tick failed:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
