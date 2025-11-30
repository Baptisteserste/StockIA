'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Settings } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Model {
  id: string;
  name: string;
  pricing: {
    prompt: number;
    completion: number;
  };
  providerName?: string;
  providerIcon?: string;
}

interface Portfolio {
  botType: string;
  cash: number;
  shares: number;
  avgBuyPrice: number | null;
  totalValue: number;
  roi: number;
}

interface SimulationData {
  id: string;
  symbol: string;
  startCapital: number;
  currentDay: number;
  status: string;
  portfolios: Portfolio[];
}

export default function SimulationPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [simulation, setSimulation] = useState<SimulationData | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [symbol, setSymbol] = useState('NVDA');
  const [capital, setCapital] = useState('10000');
  const [cheapModelId, setCheapModelId] = useState('');
  const [premiumModelId, setPremiumModelId] = useState('');
  const [useReddit, setUseReddit] = useState(false);

  // Algo config
  const [weightTechnical, setWeightTechnical] = useState(60);

  // Fetch models au mount
  useEffect(() => {
    const cached = localStorage.getItem('openrouter_models_v1');
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
        setModels(data);
        if (data.length > 0) {
          setCheapModelId(data[0].id);
          setPremiumModelId(data[Math.min(1, data.length - 1)].id);
        }
        return;
      }
    }

    fetch('/api/openrouter/models')
      .then(r => r.json())
      .then(data => {
        setModels(data);
        if (data.length > 0) {
          setCheapModelId(data[0].id);
          setPremiumModelId(data[Math.min(1, data.length - 1)].id);
        }
        localStorage.setItem('openrouter_models_v1', JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      })
      .catch(err => console.error('Failed to fetch models:', err));
  }, []);

  // Fetch simulation status au mount et polling
  useEffect(() => {
    fetchSimulationStatus();
    const interval = setInterval(fetchSimulationStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSimulationStatus = async () => {
    try {
      const res = await fetch('/api/simulation/status');
      const data = await res.json();
      if (data.active) {
        setSimulation(data.simulation);
      }
    } catch (error) {
      console.error('Failed to fetch simulation status:', error);
    }
  };

  const handleStartSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/simulation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          startCapital: parseFloat(capital),
          cheapModelId,
          premiumModelId,
          useReddit
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Erreur lors du démarrage');
        setLoading(false);
        return;
      }

      setSimulation(data.simulation);
    } catch (error) {
      console.error('Failed to start simulation:', error);
      alert('Erreur lors du démarrage de la simulation');
    } finally {
      setLoading(false);
    }
  };

  const handleStopSimulation = async () => {
    if (!simulation) return;

    try {
      await fetch('/api/simulation/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulationId: simulation.id })
      });

      setSimulation(null);
    } catch (error) {
      console.error('Failed to stop simulation:', error);
      alert('Erreur lors de l\'arrêt');
    }
  };

  const getBotName = (type: string) => {
    switch (type) {
      case 'CHEAP': return 'Agent Cheap';
      case 'PREMIUM': return 'Agent Premium';
      case 'ALGO': return 'Algo Bot';
      default: return type;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-white">
            Stock<span className="text-blue-500">IA</span>
          </Link>
          <Link
            href="/"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors text-sm font-semibold text-white"
          >
            Retour à l'accueil
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-white mb-2">Simulation de Trading</h1>
        <p className="text-slate-400 mb-12">
          3 agents s'affrontent sur un portefeuille fictif
        </p>

        {!simulation ? (
          <form onSubmit={handleStartSimulation} className="max-w-3xl mx-auto space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Symbole de l'action
              </label>
              <Input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="NVDA, AAPL, TSLA..."
                className="w-full px-4 py-3 bg-slate-800 border-slate-700 text-white"
                disabled={loading}
              />
              <div className="mt-2 flex gap-2">
                {['AAPL', 'TSLA', 'MSFT', 'NVDA'].map(ticker => (
                  <button
                    key={ticker}
                    type="button"
                    onClick={() => setSymbol(ticker)}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg border border-slate-700 transition-colors"
                    disabled={loading}
                  >
                    {ticker}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Agent Cheap
                </label>
                <Select value={cheapModelId} onValueChange={setCheapModelId} disabled={loading}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          {m.providerIcon && (
                            <img 
                              src={m.providerIcon} 
                              alt={m.providerName || ''} 
                              className="w-4 h-4 rounded-sm object-contain"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                          <span>{m.name}</span>
                          <span className="text-slate-400 text-xs">
                            ${(m.pricing.prompt * 1000000).toFixed(2)}/1M
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Agent Premium
                </label>
                <Select value={premiumModelId} onValueChange={setPremiumModelId} disabled={loading}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          {m.providerIcon && (
                            <img 
                              src={m.providerIcon} 
                              alt={m.providerName || ''} 
                              className="w-4 h-4 rounded-sm object-contain"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                          <span>{m.name}</span>
                          <span className="text-slate-400 text-xs">
                            ${(m.pricing.prompt * 1000000).toFixed(2)}/1M
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Capital initial ($)
              </label>
              <Input
                type="number"
                min="1000"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                placeholder="10000"
                className="bg-slate-800 border-slate-700 text-white"
                disabled={loading}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={useReddit}
                onCheckedChange={setUseReddit}
                disabled={loading}
              />
              <span className="text-sm text-slate-300">Activer analyse Reddit</span>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {loading ? 'Démarrage...' : 'Démarrer la simulation'}
            </Button>
          </form>
        ) : (
          <div className="space-y-6">
            {/* Header Dashboard */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Simulation {simulation.symbol}
                </h2>
                <p className="text-slate-400">Jour {simulation.currentDay} / 21</p>
              </div>
              <Button
                onClick={handleStopSimulation}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700"
              >
                Arrêter
              </Button>
            </div>

            {/* Cartes Agents */}
            <div className="grid grid-cols-3 gap-6">
              {simulation.portfolios.map(portfolio => (
                <Card key={portfolio.botType} className="bg-slate-900 border-slate-800">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <h3 className="font-semibold text-white">{getBotName(portfolio.botType)}</h3>
                    {portfolio.botType === 'ALGO' && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 bg-slate-800 border-slate-700">
                          <div className="space-y-4">
                            <h4 className="font-medium text-white">Configuration</h4>
                            <div className="space-y-2">
                              <label className="text-sm text-slate-300">
                                Balance Technique / Sentiment: {weightTechnical}% / {100 - weightTechnical}%
                              </label>
                              <Slider
                                value={[weightTechnical]}
                                onValueChange={(v) => setWeightTechnical(v[0])}
                                max={100}
                                step={10}
                              />
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-bold ${portfolio.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {portfolio.roi >= 0 && '+'}{portfolio.roi.toFixed(2)}%
                    </div>
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Cash</span>
                        <span className="text-white">
                          {portfolio.cash.toLocaleString('fr-FR', { style: 'currency', currency: 'USD' })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Actions</span>
                        <span className="text-white">{portfolio.shares.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Valeur totale</span>
                        <span className="text-white">
                          {portfolio.totalValue.toLocaleString('fr-FR', { style: 'currency', currency: 'USD' })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Graphique (placeholder) */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <h3 className="font-semibold text-white">Performance comparative</h3>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-slate-500">
                  Graphique disponible après quelques jours de simulation
                </div>
              </CardContent>
            </Card>

            {/* Logs */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <h3 className="font-semibold text-white">Journal d'activité</h3>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96 bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <div className="font-mono text-xs text-slate-400 space-y-1">
                    <div>En attente du prochain tick...</div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 mt-20 py-8">
        <div className="container mx-auto px-4 text-center text-slate-500 text-sm">
          <p>© 2025 StockIA - Simulation de trading</p>
          <p className="mt-2">
            ⚠️ Simulation à but éducatif uniquement
          </p>
        </div>
      </footer>
    </div>
  );
}
