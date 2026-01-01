import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        // Récupérer les 100 dernières décisions avec leur snapshot (DEBUG - toutes simulations)
        const decisions = await prisma.botDecision.findMany({
            take: 100,
            orderBy: { createdAt: 'desc' },
            include: {
                snapshot: {
                    select: {
                        timestamp: true,
                        price: true,
                        rsi: true,
                        macd: true,
                        sentimentScore: true,
                        sentimentReason: true,
                        simulationId: true
                    }
                }
            }
        });

        return NextResponse.json({ decisions });
    } catch (error) {
        console.error('Debug API error:', error);
        return NextResponse.json({ error: 'Failed to fetch decisions' }, { status: 500 });
    }
}
