import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface NewsArticle {
    headline: string;
    summary?: string;
    url: string;
    source: string;
    datetime: number;
}

export async function POST(request: NextRequest) {
    try {
        // On type le corps de la requête pour éviter 'any'
        const body = await request.json();
        const symbol = body.symbol;

        if (!symbol) {
            return NextResponse.json({ error: 'Symbole requis' }, { status: 400 });
        }

        if (!process.env.FINNHUB_API_KEY) {
            return NextResponse.json({ error: 'Configuration manquante : FINNHUB_API_KEY' }, { status: 500 });
        }

        if (!process.env.OPENROUTER_API_KEY) {
            return NextResponse.json({ error: 'Configuration manquante : OPENROUTER_API_KEY' }, { status: 500 });
        }

        // 1. Récupérer les news
        const newsResponse = await fetch(
            `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${getDateDaysAgo(7)}&to=${getTodayDate()}&token=${process.env.FINNHUB_API_KEY}`
        );

        if (!newsResponse.ok) {
            return NextResponse.json({ error: 'Impossible de récupérer les actualités' }, { status: 404 });
        }

        // ICI : On force le type pour dire à TS "T'inquiète, c'est bien un tableau d'articles"
        const news = (await newsResponse.json()) as NewsArticle[];

        if (!news || news.length === 0) {
            return NextResponse.json({ error: 'Aucune actualité trouvée' }, { status: 404 });
        }

        const limitedNews = news.slice(0, 5);

        // 2. Analyser
        const sentimentAnalysis = await analyzeSentimentWithAI(limitedNews);

        console.log(`[AI Usage] Symbol: ${symbol}, Tokens: ${sentimentAnalysis.tokensUsed}, Cost: $${sentimentAnalysis.cost.toFixed(6)}`);

        return NextResponse.json({
            symbol,
            news: limitedNews,
            sentiment: sentimentAnalysis.sentiment,
            sources: sentimentAnalysis.sources,
            disclaimer: "⚠️ Cette analyse est basée uniquement sur le sentiment des actualités."
        });

    } catch (error: unknown) {
        // Gestion d'erreur typée proprement
        console.error('Erreur analyse:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue lors de l\'analyse';

        return NextResponse.json({
            error: errorMessage
        }, { status: 500 });
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