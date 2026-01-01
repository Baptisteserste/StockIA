import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        // Get active simulation first
        const activeSimulation = await prisma.simulationConfig.findFirst({
            where: { status: 'RUNNING' }
        });

        if (!activeSimulation) {
            return NextResponse.json({ decisions: [] });
        }

        // Récupérer les décisions de la simulation ACTIVE uniquement
        const decisions = await prisma.botDecision.findMany({
            where: {
                snapshot: {
                    simulationId: activeSimulation.id
                }
            },
            take: 500,
            orderBy: { createdAt: 'desc' },
            include: {
                snapshot: {
                    select: {
                        timestamp: true,
                        price: true,
                        rsi: true,
                        macd: true,
                        sentimentScore: true,
                        sentimentReason: true
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
