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
  const force = url.searchParams.get('force') === 'true';

  const bearerOk = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const headerKeyOk = headerKey === process.env.CRON_SECRET;
  const queryKeyOk = queryKey === process.env.CRON_SECRET;

  if (!bearerOk && !headerKeyOk && !queryKeyOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Guard weekday (lundi=1 à vendredi=5)
  const now = new Date();
  const day = now.getDay();
  if (!force && (day === 0 || day === 6)) {
    return NextResponse.json({ skipped: true, reason: 'weekend' });
  }

  // Guard US market holidays (NYSE/NASDAQ)
  const usHolidays2025_2026 = [
    // 2025
    '2025-01-01', // New Year's Day
    '2025-01-20', // MLK Day
    '2025-02-17', // Presidents' Day
    '2025-04-18', // Good Friday
    '2025-05-26', // Memorial Day
    '2025-06-19', // Juneteenth
    '2025-07-04', // Independence Day
    '2025-09-01', // Labor Day
    '2025-11-27', // Thanksgiving
    '2025-12-25', // Christmas
    // 2026
    '2026-01-01', // New Year's Day
    '2026-01-19', // MLK Day
    '2026-02-16', // Presidents' Day
    '2026-04-03', // Good Friday
    '2026-05-25', // Memorial Day
    '2026-06-19', // Juneteenth
    '2026-07-03', // Independence Day (observed)
    '2026-09-07', // Labor Day
    '2026-11-26', // Thanksgiving
    '2026-12-25', // Christmas
  ];

  const todayStr = now.toISOString().split('T')[0];
  if (!force && usHolidays2025_2026.includes(todayStr)) {
    return NextResponse.json({ skipped: true, reason: `holiday: ${todayStr}` });
  }

  // Idempotence check
  const rounded = new Date(now);
  rounded.setMinutes(0, 0, 0);

  const existing = await prisma.marketSnapshot.findFirst({
    where: { timestamp: rounded }
  });

  if (!force && existing) {
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
        `algo-${config.id}`, // Agent ID unique par simulation pour le state
        config.algoWeightTechnical, // Poids technique depuis DB (0-100)
        config.currentDay,   // Jour actuel de la simulation
        config.durationDays  // Durée totale de la simulation
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

      for (const decision of decisions) {
        const { action, quantity, portfolio } = decision;

        // Vérifier si l'action peut être exécutée
        let actualAction = action;
        let actualQuantity = quantity;
        let actualReason = decision.reason;
        let skipped = false;

        if (action === 'BUY' && quantity * snapshot.price > portfolio.cash) {
          console.warn(`${decision.botType}: BUY order skipped (insufficient funds)`);
          actualAction = 'HOLD';
          actualQuantity = 0;
          actualReason = `BUY demandé mais fonds insuffisants (${quantity} @ $${snapshot.price.toFixed(2)} > $${portfolio.cash.toFixed(2)} cash)`;
          skipped = true;
        }
        if (action === 'SELL' && (quantity > portfolio.shares || portfolio.shares === 0)) {
          console.warn(`${decision.botType}: SELL order skipped (insufficient shares)`);
          actualAction = 'HOLD';
          actualQuantity = 0;
          actualReason = `SELL demandé mais actions insuffisantes (${quantity} demandé, ${portfolio.shares} disponibles)`;
          skipped = true;
        }

        // TOUJOURS insérer la décision (même si skipped)
        await tx.botDecision.create({
          data: {
            snapshotId: dbSnapshot.id,
            botType: decision.botType as 'CHEAP' | 'PREMIUM' | 'ALGO',
            action: actualAction,
            quantity: actualQuantity,
            price: snapshot.price,
            reason: actualReason,
            confidence: decision.confidence,
            tokens: (decision as any).tokens || 0,
            cost: (decision as any).cost || 0,
            debugData: decision.debugData ? JSON.parse(JSON.stringify(decision.debugData)) : undefined
          }
        });

        // Si skipped ou HOLD, ne pas mettre à jour le portfolio
        if (skipped || actualAction === 'HOLD') {
          continue;
        }

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
