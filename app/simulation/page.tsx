'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Settings, Trophy } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

interface Decision {
  botType: string;
  action: string;
  quantity: number;
  price: number;
  reason: string;
  confidence: number | null;
  timestamp: string;
}

interface RoiDataPoint {
  day: number;
  price: number;
  CHEAP?: number;
  PREMIUM?: number;
  ALGO?: number;
  BUYHOLD?: number;
}

interface SimulationData {
  id: string;
  symbol: string;
  startCapital: number;
  currentDay: number;
  durationDays: number;
  status: string;
  portfolios: Portfolio[];
  roiHistory: RoiDataPoint[];
  recentDecisions: Decision[];
}

export default function SimulationPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [simulation, setSimulation] = useState<SimulationData | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [symbol, setSymbol] = useState('NVDA');
  const [capital, setCapital] = useState('10000');
  const [durationDays, setDurationDays] = useState('21');
  const [cheapModelId, setCheapModelId] = useState('');
  const [premiumModelId, setPremiumModelId] = useState('');
  const [useReddit, setUseReddit] = useState(false);

  // Algo config
  const [weightTechnical, setWeightTechnical] = useState(60);

  // Fetch models au mount
  useEffect(() => {
    const cached = localStorage.getItem('openrouter_models_v2');
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
        localStorage.setItem('openrouter_models_v2', JSON.stringify({
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
          durationDays: parseInt(durationDays),
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

  const getLeader = () => {
    if (!simulation?.portfolios.length) return null;
    return simulation.portfolios.reduce((best, p) => 
      p.roi > best.roi ? p : best
    );
  };

  const leader = simulation ? getLeader() : null;

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

            <div className="grid grid-cols-2 gap-4">
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

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Durée (jours)
                </label>
                <Select value={durationDays} onValueChange={setDurationDays} disabled={loading}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 jours</SelectItem>
                    <SelectItem value="14">14 jours</SelectItem>
                    <SelectItem value="21">21 jours</SelectItem>
                    <SelectItem value="30">30 jours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                <p className="text-slate-400">Jour {simulation.currentDay} / {simulation.durationDays || 21}</p>
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
                <Card key={portfolio.botType} className={`bg-slate-900 border-slate-800 ${leader?.botType === portfolio.botType ? 'ring-2 ring-yellow-500' : ''}`}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      {leader?.botType === portfolio.botType && (
                        <Trophy className="h-5 w-5 text-yellow-500" />
                      )}
                      <h3 className="font-semibold text-white">{getBotName(portfolio.botType)}</h3>
                    </div>
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

            {/* Graphique Performance */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <h3 className="font-semibold text-white">Performance comparative</h3>
              </CardHeader>
              <CardContent>
                {simulation.roiHistory && simulation.roiHistory.length > 1 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={simulation.roiHistory}>
                      <XAxis dataKey="day" stroke="#64748b" />
                      <YAxis stroke="#64748b" tickFormatter={(v) => `${v.toFixed(1)}%`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '10px' }}
                      />
                      <Line type="monotone" dataKey="CHEAP" stroke="#22c55e" name="Agent Cheap" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="PREMIUM" stroke="#3b82f6" name="Agent Premium" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="ALGO" stroke="#f59e0b" name="Algo Bot" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="BUYHOLD" stroke="#94a3b8" name="Buy & Hold" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-500">
                    Graphique disponible après le premier tick
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Journal d'activité avec raisonnement */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <h3 className="font-semibold text-white">Journal d'activité</h3>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96 bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <div className="space-y-4">
                    {simulation.recentDecisions && simulation.recentDecisions.length > 0 ? (
                      simulation.recentDecisions.map((d, i) => (
                        <div key={i} className="border-b border-slate-800 pb-3 last:border-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-semibold ${
                              d.botType === 'CHEAP' ? 'text-green-400' : 
                              d.botType === 'PREMIUM' ? 'text-blue-400' : 'text-amber-400'
                            }`}>
                              {getBotName(d.botType)}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              d.action === 'BUY' ? 'bg-green-900 text-green-300' :
                              d.action === 'SELL' ? 'bg-red-900 text-red-300' : 'bg-slate-700 text-slate-300'
                            }`}>
                              {d.action} {d.quantity > 0 && `${d.quantity.toFixed(2)} @ $${d.price.toFixed(2)}`}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400">{d.reason}</p>
                          {d.confidence && (
                            <div className="mt-1 flex items-center gap-2">
                              <div className="h-1 flex-1 bg-slate-700 rounded">
                                <div 
                                  className="h-1 bg-blue-500 rounded" 
                                  style={{ width: `${d.confidence * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500">{(d.confidence * 100).toFixed(0)}%</span>
                            </div>
                          )}
                          <p className="text-xs text-slate-600 mt-1">
                            {new Date(d.timestamp).toLocaleString('fr-FR')}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-500 text-sm">En attente du prochain tick...</div>
                    )}
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
