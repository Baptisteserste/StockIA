import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { auth, currentUser } from "@clerk/nextjs/server"; // Import Clerk
import prisma from "@/lib/prisma"; // Import Prisma

interface NewsArticle {
    headline: string;
    summary?: string;
    url: string;
    source: string;
    datetime: number;
}

export async function POST(request: NextRequest) {
    try {
        // 1. AUTHENTIFICATION : On vérifie qui appelle l'API
        const { userId } = await auth();
        
        if (!userId) {
            return NextResponse.json({ error: 'Non autorisé. Veuillez vous connecter.' }, { status: 401 });
        }

        // 2. GESTION UTILISATEUR & CRÉDITS
        let user = await prisma.user.findUnique({ where: { id: userId } });

        // Si l'utilisateur n'existe pas encore en DB (première analyse directe), on le crée
        if (!user) {
            const clerkUser = await currentUser();
            const email = clerkUser?.emailAddresses[0]?.emailAddress || "unknown@email.com";
            
            user = await prisma.user.create({
                data: {
                    id: userId,
                    email: email,
                    credits: 10 // Bonus de bienvenue
                }
            });
        }

        // Vérification du solde
        if (user.credits <= 0) {
            return NextResponse.json({ error: 'Crédits insuffisants. Veuillez recharger votre compte.' }, { status: 403 });
        }

        // --- FIN GESTION AUTH ---

        const body = await request.json();
        const symbol = body.symbol;

        if (!symbol) {
            return NextResponse.json({ error: 'Symbole requis' }, { status: 400 });
        }

        if (!process.env.FINNHUB_API_KEY || !process.env.OPENROUTER_API_KEY) {
            return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 500 });
        }

        // 3. Récupération News
        const newsResponse = await fetch(
            `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${getDateDaysAgo(7)}&to=${getTodayDate()}&token=${process.env.FINNHUB_API_KEY}`
        );

        if (!newsResponse.ok) throw new Error('Erreur Finnhub');
        
        const news = (await newsResponse.json()) as NewsArticle[];
        if (!news || news.length === 0) return NextResponse.json({ error: 'Aucune actualité trouvée' }, { status: 404 });

        const limitedNews = news.slice(0, 5);

        // 4. Analyse IA
        const sentimentAnalysis = await analyzeSentimentWithAI(limitedNews);

        // 5. SAUVEGARDE EN BASE DE DONNÉES (Transaction)
        // On déduit 1 crédit ET on enregistre le log en même temps
        await prisma.$transaction([
            // Décrémenter les crédits
            prisma.user.update({
                where: { id: userId },
                data: { credits: { decrement: 1 } }
            }),
            // Créer le log
            prisma.analysisLog.create({
                data: {
                    userId: userId,
                    symbol: symbol,
                    sentiment: sentimentAnalysis.sentiment.sentiment_global || 'neutre',
                    tokens: sentimentAnalysis.tokensUsed,
                    cost: sentimentAnalysis.cost
                }
            })
        ]);

        console.log(`[Succès] Analyse ${symbol} pour ${userId}. Coût: ${sentimentAnalysis.cost}$`);

        return NextResponse.json({
            symbol,
            news: limitedNews,
            sentiment: sentimentAnalysis.sentiment,
            sources: sentimentAnalysis.sources,
            disclaimer: "⚠️ Cette analyse est basée uniquement sur le sentiment des actualités."
        });

    } catch (error: unknown) {
        console.error('Erreur analyse:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

async function analyzeSentimentWithAI(news: NewsArticle[]) {
    const openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
    });

    const newsTexts = news.map((article, idx) =>
        `[${idx + 1}] ${article.headline} - ${article.summary?.substring(0, 200) || 'Pas de résumé'}`
    ).join('\n\n');

    const prompt = `Analyse le sentiment de ces articles financiers. Réponds uniquement en JSON strict :
    ${newsTexts}
    Format : {"sentiment_global": "positif|négatif|neutre", "score": 0-100, "articles": [{"id": 1, "sentiment": "...", "raison": "..."}], "resume": "..."}`;

    const completion = await openai.chat.completions.create({
        model: "mistralai/mistral-7b-instruct",
        messages: [
            { role: "system", content: "Réponds uniquement en JSON valide." },
            { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
    });

    const response = completion.choices[0].message.content || '{}';
    let sentimentData;
    
    try {
        const cleanedResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        sentimentData = JSON.parse(cleanedResponse);
    } catch (e) {
        sentimentData = { sentiment_global: "neutre", score: 50, articles: [], resume: "Erreur parsing" };
    }

    const tokensUsed = completion.usage?.total_tokens || 0;
    const cost = tokensUsed * (0.00013 / 1000);

    return {
        sentiment: sentimentData,
        tokensUsed,
        cost,
        sources: news.map(article => ({
            title: article.headline,
            url: article.url,
            source: article.source,
            date: article.datetime
        }))
    };
}

function getDateDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
}

function getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
}