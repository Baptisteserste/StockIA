import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  try {
    // Auth OBLIGATOIRE
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Vous devez être connecté pour arrêter une simulation' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { simulationId } = body;

    if (!simulationId) {
      return NextResponse.json(
        { error: 'Missing simulationId' },
        { status: 400 }
      );
    }

    // Vérifier que la simulation existe et appartient à l'utilisateur
    const simulation = await prisma.simulationConfig.findUnique({
      where: { id: simulationId }
    });

    if (!simulation) {
      return NextResponse.json(
        { error: 'Simulation introuvable' },
        { status: 404 }
      );
    }

    // Vérifier que l'utilisateur est le créateur OU que la simulation n'a pas de créateur (legacy)
    if (simulation.createdBy && simulation.createdBy !== userId) {
      return NextResponse.json(
        { error: 'Vous n\'êtes pas autorisé à arrêter cette simulation' },
        { status: 403 }
      );
    }

    // Mettre à jour le statut
    const updated = await prisma.simulationConfig.update({
      where: { id: simulationId },
      data: { status: 'COMPLETED' }
    });

    return NextResponse.json({
      success: true,
      simulation: updated
    });

  } catch (error: any) {
    console.error('Failed to stop simulation:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'arrêt de la simulation', details: error.message },
      { status: 500 }
    );
  }
}
