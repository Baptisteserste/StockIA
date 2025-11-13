import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { symbol } = await request.json();

        if (!symbol) {
            return NextResponse.json({ error: 'Symbole requis' }, { status: 400 });
        }

        // Vérifier que les variables d'environnement sont présentes
        if (!process.env.FINNHUB_API_KEY) {
            return NextResponse.json({
                error: 'Configuration manquante : FINNHUB_API_KEY'
            }, { status: 500 });
        }

        if (!process.env.OPENROUTER_API_KEY) {
            return NextResponse.json({
                error: 'Configuration manquante : OPENROUTER_API_KEY'
            }, { status: 500 });
        }

        // 1. Récupérer les news de l'action via Finnhub
        const newsResponse = await fetch(
            `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${getDateDaysAgo(7)}&to=${getTodayDate()}&token=${process.env.FINNHUB_API_KEY}`
        );

        if (!newsResponse.ok) {
            return NextResponse.json({
                error: 'Impossible de récupérer les actualités pour ce symbole'
            }, { status: 404 });
        }

        const news = await newsResponse.json();

        if (!news || news.length === 0) {
            return NextResponse.json({
                error: 'Aucune actualité trouvée pour ce symbole'
            }, { status: 404 });
        }

        // Limiter à 5 articles pour économiser les tokens
        const limitedNews = news.slice(0, 5);

        // 2. Analyser le sentiment avec OpenRouter (modèle léger)
        const sentimentAnalysis = await analyzeSentimentWithAI(limitedNews);

        // 3. TODO: Enregistrer l'appel dans la DB pour le monitoring
        console.log(`[AI Usage] Symbol: ${symbol}, Tokens: ${sentimentAnalysis.tokensUsed}, Cost: $${sentimentAnalysis.cost.toFixed(6)}`);

        // 4. Retourner les résultats
        return NextResponse.json({
            symbol,
            news: limitedNews,
            sentiment: sentimentAnalysis.sentiment,
            sources: sentimentAnalysis.sources,
            disclaimer: "⚠️ Cette analyse est basée uniquement sur le sentiment des actualités. Elle ne constitue en aucun cas un conseil financier ou d'investissement."
        });

    } catch (error: any) {
        console.error('Erreur analyse:', error);
        return NextResponse.json({
            error: error.message || 'Erreur lors de l\'analyse'
        }, { status: 500 });
    }
}

async function analyzeSentimentWithAI(news: any[]) {
    const OpenAI = require('openai');

    const openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
    });

    const newsTexts = news.map((article, idx) =>
        `[${idx + 1}] ${article.headline} - ${article.summary?.substring(0, 200) || 'Pas de résumé disponible'}`
    ).join('\n\n');

    const prompt = `Analyse le sentiment de ces articles financiers. Réponds uniquement en JSON strict sans markdown :

${newsTexts}

Format de réponse attendu :
{
  "sentiment_global": "positif|négatif|neutre",
  "score": 0-100,
  "articles": [
    {"id": 1, "sentiment": "positif|négatif|neutre", "raison": "courte explication"}
  ],
  "resume": "résumé en 2 phrases max"
}`;

    // Utiliser Mistral 7B Instruct (le moins cher)
    const completion = await openai.chat.completions.create({
        model: "mistralai/mistral-7b-instruct", // ~0.00013$/1k tokens input, ~0.00013$/1k tokens output
        messages: [
            {
                role: "system",
                content: "Tu es un assistant d'analyse de sentiment financier. Tu réponds uniquement en JSON valide, sans balises markdown ni backticks."
            },
            {
                role: "user",
                content: prompt
            }
        ],
        temperature: 0.3, // Bas pour plus de cohérence
        max_tokens: 500, // Limité pour économiser
    });

    const response = completion.choices[0].message.content || '{}';

    // Parser la réponse JSON
    let sentimentData;
    try {
        // Nettoyer les éventuels backticks markdown
        const cleanedResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        sentimentData = JSON.parse(cleanedResponse);
    } catch (e) {
        console.error('Erreur parsing JSON:', e);
        console.error('Réponse brute:', response);
        // Fallback si parsing échoue
        sentimentData = {
            sentiment_global: "neutre",
            score: 50,
            articles: news.map((_, idx) => ({
                id: idx + 1,
                sentiment: "neutre",
                raison: "Analyse impossible"
            })),
            resume: "L'analyse du sentiment n'a pas pu être effectuée correctement."
        };
    }

    // Calculer le coût (Mistral 7B : ~0.00013$/1k tokens)
    const tokensUsed = completion.usage?.total_tokens || 0;
    const costPerToken = 0.00013 / 1000; // Prix par token
    const cost = tokensUsed * costPerToken;

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