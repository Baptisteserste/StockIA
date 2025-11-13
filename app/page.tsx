'use client';

import { useState } from 'react';
import { Search, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { UserButton, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";

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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white">
            Stock<span className="text-blue-500">IA</span>
          </h1>
          <p className="text-slate-400 text-sm">Analyse de sentiment financier par IA</p>
        </div>
          <div>
              <SignedIn>
                  <UserButton afterSignOutUrl="/" />
              </SignedIn>
              <SignedOut>
                  <SignInButton mode="modal">
                      <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors">
                          Connexion
                      </button>
                  </SignInButton>
              </SignedOut>
          </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
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
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 mt-20 py-8">
        <div className="container mx-auto px-4 text-center text-slate-500 text-sm">
          <p>© 2025 StockIA - Analyse de sentiment financier</p>
          <p className="mt-2">
            ⚠️ Cette application ne fournit pas de conseils financiers ou d'investissement.
          </p>
        </div>
      </footer>
    </div>
  );
}
