import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { simulationId } = body;

    if (!simulationId) {
      return NextResponse.json(
        { error: 'Missing simulationId' },
        { status: 400 }
      );
    }

    // Mettre à jour le statut
    const simulation = await prisma.simulationConfig.update({
      where: { id: simulationId },
      data: { status: 'COMPLETED' }
    });

    return NextResponse.json({
      success: true,
      simulation
    });

  } catch (error: any) {
    console.error('Failed to stop simulation:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'arrêt de la simulation', details: error.message },
      { status: 500 }
    );
  }
}
