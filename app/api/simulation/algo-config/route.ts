import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// PATCH: Update algo bot config for current simulation
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { weightTechnical } = body;

        if (weightTechnical === undefined || weightTechnical < 0 || weightTechnical > 100) {
            return NextResponse.json(
                { error: 'weightTechnical must be between 0 and 100' },
                { status: 400 }
            );
        }

        // Find active simulation
        const simulation = await prisma.simulationConfig.findFirst({
            where: { status: 'RUNNING' }
        });

        if (!simulation) {
            return NextResponse.json(
                { error: 'No active simulation' },
                { status: 404 }
            );
        }

        // Update the weight
        const updated = await prisma.simulationConfig.update({
            where: { id: simulation.id },
            data: { algoWeightTechnical: Math.round(weightTechnical) }
        });

        return NextResponse.json({
            success: true,
            algoWeightTechnical: updated.algoWeightTechnical
        });
    } catch (error) {
        console.error('Failed to update algo config:', error);
        return NextResponse.json(
            { error: 'Failed to update algo config' },
            { status: 500 }
        );
    }
}

// GET: Get current algo config
export async function GET() {
    try {
        const simulation = await prisma.simulationConfig.findFirst({
            where: { status: 'RUNNING' },
            select: { algoWeightTechnical: true }
        });

        if (!simulation) {
            return NextResponse.json({ algoWeightTechnical: 60 }); // Default
        }

        return NextResponse.json({
            algoWeightTechnical: simulation.algoWeightTechnical
        });
    } catch (error) {
        console.error('Failed to get algo config:', error);
        return NextResponse.json(
            { error: 'Failed to get algo config' },
            { status: 500 }
        );
    }
}
