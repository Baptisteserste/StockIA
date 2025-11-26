import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  try {
    // Auth optionnelle (peut être lancé par n'importe qui)
    const { userId } = await auth();

    const body = await req.json();
    const { symbol, startCapital, cheapModelId, premiumModelId, useReddit } = body;

    // Validation
    if (!symbol || !startCapital || !cheapModelId || !premiumModelId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (startCapital < 1000) {
      return NextResponse.json(
        { error: 'Le capital doit être d\'au moins 1000$' },
        { status: 400 }
      );
    }

    // Vérifier qu'il n'y a pas déjà une simulation active
    const existing = await prisma.simulationConfig.findFirst({
      where: { status: 'RUNNING' }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Une simulation est déjà en cours' },
        { status: 409 }
      );
    }

    // Valider le symbole avec Finnhub
    const quoteRes = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`
    );

    if (!quoteRes.ok) {
      return NextResponse.json(
        { error: 'Symbole invalide ou introuvable' },
        { status: 400 }
      );
    }

    const quote = await quoteRes.json();
    if (quote.c === undefined || quote.c === 0) {
      return NextResponse.json(
        { error: 'Symbole invalide ou pas de données disponibles' },
        { status: 400 }
      );
    }

    // Créer la simulation avec les 3 portfolios
    const simulation = await prisma.simulationConfig.create({
      data: {
        symbol: symbol.toUpperCase(),
        startCapital,
        cheapModelId,
        premiumModelId,
        useReddit: useReddit || false,
        status: 'RUNNING',
        createdBy: userId || null,
        portfolios: {
          create: [
            {
              botType: 'CHEAP',
              cash: startCapital,
              shares: 0,
              totalValue: startCapital,
              roi: 0
            },
            {
              botType: 'PREMIUM',
              cash: startCapital,
              shares: 0,
              totalValue: startCapital,
              roi: 0
            },
            {
              botType: 'ALGO',
              cash: startCapital,
              shares: 0,
              totalValue: startCapital,
              roi: 0
            }
          ]
        }
      },
      include: { portfolios: true }
    });

    return NextResponse.json({
      success: true,
      simulation
    });

  } catch (error: any) {
    console.error('Failed to start simulation:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la simulation', details: error.message },
      { status: 500 }
    );
  }
}
