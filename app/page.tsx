'use client';

import { useState } from 'react';
import { Search, TrendingUp, TrendingDown, Minus, AlertCircle, Lock } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Link from 'next/link';

export default function Home() {
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/analyze-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.toUpperCase() })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de l\'analyse');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positif': return <TrendingUp className="text-green-500" />;
      case 'négatif': return <TrendingDown className="text-red-500" />;
      default: return <Minus className="text-gray-500" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positif': return 'bg-green-500/10 border-green-500/20';
      case 'négatif': return 'bg-red-500/10 border-red-500/20';
      default: return 'bg-gray-500/10 border-gray-500/20';
    }
  };

  return (
      <div className="flex flex-col min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">

        {/* Main Content */}
        <main className="flex-grow container mx-auto px-4 py-12">

          {/* --- ZONE PROTÉGÉE : Visible seulement si connecté --- */}
          <SignedIn>
            {/* Search Bar */}
            <div className="max-w-3xl mx-auto mb-12">
              <form onSubmit={handleAnalyze} className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                        placeholder="Entrez un symbole d'action (ex: AAPL, TSLA, MSFT)"
                        className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        disabled={loading}
                    />
                  </div>
                  <button
                      type="submit"
                      disabled={loading || !symbol}
                      className="px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
                  >
                    {loading ? 'Analyse...' : 'Analyser'}
                  </button>
                </div>
              </form>

              {/* Exemples */}
              <div className="mt-4 flex gap-2 flex-wrap">
                <span className="text-slate-400 text-sm">Exemples :</span>
                {['AAPL', 'TSLA', 'MSFT', 'NVDA'].map((ticker) => (
                    <button
                        key={ticker}
                        onClick={() => setSymbol(ticker)}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
                        disabled={loading}
                    >
                      {ticker}
                    </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
                <div className="max-w-3xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                  ❌ {error}
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Disclaimer */}
                  <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <AlertCircle className="text-amber-500 w-5 h-5 mt-0.5 flex-shrink-0" />
                    <p className="text-amber-200 text-sm">{result.disclaimer}</p>
                  </div>

                  {/* Sentiment Global */}
                  <div className={`p-6 border rounded-xl ${getSentimentColor(result.sentiment.sentiment_global)}`}>
                    <div className="flex items-center gap-3 mb-3">
                      {getSentimentIcon(result.sentiment.sentiment_global)}
                      <h2 className="text-xl font-bold text-white">
                        Sentiment Global : {result.sentiment.sentiment_global?.toUpperCase()}
                      </h2>
                    </div>
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-400">Score de confiance</span>
                        <span className="text-white font-semibold">{result.sentiment.score}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${result.sentiment.score}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-slate-300">{result.sentiment.resume}</p>
                  </div>

                  {/* Articles analysés */}
                  {result.sentiment.articles && result.sentiment.articles.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-bold text-white">Articles analysés</h3>
                        {result.sentiment.articles.map((article: any, idx: number) => (
                            <div key={idx} className="p-4 bg-slate-800 border border-slate-700 rounded-xl">
                              <div className="flex items-start gap-3">
                                <div className="mt-1">{getSentimentIcon(article.sentiment)}</div>
                                <div className="flex-1">
                                  <a
                                      href={result.sources[idx]?.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-white hover:text-blue-400 font-medium transition-colors"
                                  >
                                    {result.sources[idx]?.title}
                                  </a>
                                  <p className="text-slate-400 text-sm mt-1">{article.raison}</p>
                                  <p className="text-slate-500 text-xs mt-2">
                                    {result.sources[idx]?.source} • {new Date(result.sources[idx]?.date * 1000).toLocaleDateString('fr-FR')}
                                  </p>
                                </div>
                              </div>
                            </div>
                        ))}
                      </div>
                  )}

                  {/* Sources */}
                  <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                    <p className="text-slate-400 text-sm">
                      📰 Sources : {result.sources?.length || 0} articles analysés via Finnhub API
                    </p>
                  </div>
                </div>
            )}
          </SignedIn>

          {/* --- ZONE PUBLIQUE : Visible seulement si NON connecté --- */}
          <SignedOut>
            <div className="py-20">
              <div className="max-w-4xl mx-auto text-center mb-16">
                <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-8 tracking-tight">
                  L'IA au service de votre <span className="text-blue-500">stratégie</span>
                </h1>
                <p className="text-xl text-slate-400 mb-10 leading-relaxed">
                  Analysez instantanément le sentiment du marché et simulez vos investissements avec nos agents intelligents.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <SignInButton mode="modal">
                    <button className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/40 text-lg cursor-pointer">
                      Essayer maintenant
                    </button>
                  </SignInButton>
                  <Link href="/pricing" className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-slate-700 text-lg">
                    Voir les tarifs
                  </Link>
                </div>
              </div>

              {/* Demo Section */}
              <div className="max-w-5xl mx-auto mb-20 p-2 bg-slate-800/50 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden">
                <div className="aspect-video bg-slate-950 rounded-2xl flex items-center justify-center relative">
                   <div className="text-center">
                     <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <div className="w-0 h-0 border-y-[10px] border-y-transparent border-l-[16px] border-l-white ml-1"></div>
                     </div>
                     <p className="text-slate-500 font-medium italic">Démo interactive (Vidéo/GIF à insérer)</p>
                   </div>
                </div>
              </div>

              {/* Benefits Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-2xl">
                  <div className="text-3xl mb-4">⚡</div>
                  <h3 className="text-xl font-bold text-white mb-2">Vitesse Pure</h3>
                  <p className="text-slate-400">Synthétisez des jours d'actualités en quelques secondes seulement.</p>
                </div>
                <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-2xl">
                  <div className="text-3xl mb-4">📊</div>
                  <h3 className="text-xl font-bold text-white mb-2">Insights Clairs</h3>
                  <p className="text-slate-400">Des scores de sentiment précis basés sur des sources financières fiables.</p>
                </div>
                <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-2xl">
                  <div className="text-3xl mb-4">🧪</div>
                  <h3 className="text-xl font-bold text-white mb-2">Simulations</h3>
                  <p className="text-slate-400">Testez l'efficacité des agents IA face aux algorithmes classiques.</p>
                </div>
              </div>
            </div>
          </SignedOut>

        </main>
      </div>
  );
}