'use client';

import { useState, useEffect } from 'react';
import { Trophy, ChevronDown, ChevronUp, Calendar, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceDot } from 'recharts';

interface Portfolio {
  botType: string;
  cash: number;
  shares: number;
  totalValue: number;
  roi: number;
}

interface Decision {
  day: number;
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

interface HistorySimulation {
  id: string;
  symbol: string;
  startCapital: number;
  durationDays: number;
  currentDay: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  winner: {
    botType: string;
    roi: number;
    totalValue: number;
  } | null;
  portfolios: Portfolio[];
  roiHistory: RoiDataPoint[];
  decisions: Decision[];
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistorySimulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/simulation/history');
      const data = await res.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
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

  const getBotColor = (type: string) => {
    switch (type) {
      case 'CHEAP': return '#22c55e';
      case 'PREMIUM': return '#3b82f6';
      case 'ALGO': return '#f59e0b';
      default: return '#94a3b8';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Générer les points d'annotation pour le graphique
  const getAnnotations = (sim: HistorySimulation) => {
    return sim.decisions
      .filter(d => d.action !== 'HOLD')
      .map(d => ({
        day: d.day,
        botType: d.botType,
        action: d.action,
        roi: sim.roiHistory.find(r => r.day === d.day)?.[d.botType as keyof RoiDataPoint] as number || 0
      }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-white">
            Stock<span className="text-blue-500">IA</span>
          </Link>
          <div className="flex gap-3">
            <Link
              href="/simulation"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors text-sm font-semibold text-white"
            >
              Nouvelle simulation
            </Link>
            <Link
              href="/"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors text-sm font-semibold text-white"
            >
              Accueil
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-white mb-2">Historique des Simulations</h1>
        <p className="text-slate-400 mb-12">
          Consultez les résultats de vos simulations passées
        </p>

        {loading ? (
          <div className="text-center text-slate-400 py-12">Chargement...</div>
        ) : history.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-12 text-center">
              <p className="text-slate-400 mb-4">Aucune simulation terminée</p>
              <Link href="/simulation">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Lancer une simulation
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {history.map(sim => (
              <Card key={sim.id} className="bg-slate-900 border-slate-800 overflow-hidden">
                {/* Header cliquable */}
                <button
                  onClick={() => setExpandedId(expandedId === sim.id ? null : sim.id)}
                  className="w-full text-left"
                >
                  <CardHeader className="flex flex-row items-center justify-between py-4 hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold text-white">{sim.symbol}</div>
                      <Badge variant="outline" className="border-slate-600 text-slate-300">
                        {sim.currentDay} jours
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={sim.status === 'COMPLETED' ? 'border-green-600 text-green-400' : 'border-yellow-600 text-yellow-400'}
                      >
                        {sim.status === 'COMPLETED' ? 'Terminée' : 'Arrêtée'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      {/* Gagnant */}
                      {sim.winner && (
                        <div className="flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-yellow-500" />
                          <span className="text-white font-semibold">{getBotName(sim.winner.botType)}</span>
                          <span className={`font-bold ${sim.winner.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {sim.winner.roi >= 0 && '+'}{sim.winner.roi.toFixed(2)}%
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <Calendar className="h-4 w-4" />
                        {formatDate(sim.createdAt)}
                      </div>
                      
                      {expandedId === sim.id ? (
                        <ChevronUp className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                  </CardHeader>
                </button>

                {/* Contenu expandable */}
                {expandedId === sim.id && (
                  <CardContent className="border-t border-slate-800 pt-6 space-y-6">
                    {/* Résumé des agents */}
                    <div className="grid grid-cols-3 gap-4">
                      {sim.portfolios.map(portfolio => (
                        <div
                          key={portfolio.botType}
                          className={`p-4 rounded-xl bg-slate-800/50 ${
                            sim.winner?.botType === portfolio.botType ? 'ring-2 ring-yellow-500' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {sim.winner?.botType === portfolio.botType && (
                              <Trophy className="h-4 w-4 text-yellow-500" />
                            )}
                            <span className="font-semibold text-white">{getBotName(portfolio.botType)}</span>
                          </div>
                          <div className={`text-2xl font-bold ${portfolio.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {portfolio.roi >= 0 && '+'}{portfolio.roi.toFixed(2)}%
                          </div>
                          <div className="text-sm text-slate-400 mt-1">
                            {portfolio.totalValue.toLocaleString('fr-FR', { style: 'currency', currency: 'USD' })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Graphique avec annotations */}
                    <div className="bg-slate-800/30 rounded-xl p-4">
                      <h4 className="text-white font-semibold mb-4">Performance</h4>
                      {sim.roiHistory.length > 1 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={sim.roiHistory}>
                            <XAxis dataKey="day" stroke="#64748b" />
                            <YAxis stroke="#64748b" tickFormatter={(v) => `${v.toFixed(0)}%`} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                              labelStyle={{ color: '#fff' }}
                              formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="CHEAP" stroke="#22c55e" name="Agent Cheap" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="PREMIUM" stroke="#3b82f6" name="Agent Premium" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="ALGO" stroke="#f59e0b" name="Algo Bot" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="BUYHOLD" stroke="#94a3b8" name="Buy & Hold" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            
                            {/* Annotations BUY/SELL */}
                            {getAnnotations(sim).map((ann, i) => (
                              <ReferenceDot
                                key={i}
                                x={ann.day}
                                y={ann.roi}
                                r={6}
                                fill={ann.action === 'BUY' ? '#22c55e' : '#ef4444'}
                                stroke={getBotColor(ann.botType)}
                                strokeWidth={2}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-48 flex items-center justify-center text-slate-500">
                          Pas assez de données
                        </div>
                      )}
                    </div>

                    {/* Historique des décisions */}
                    <div className="bg-slate-800/30 rounded-xl p-4">
                      <h4 className="text-white font-semibold mb-4">Décisions ({sim.decisions.filter(d => d.action !== 'HOLD').length})</h4>
                      <ScrollArea className="h-48">
                        <div className="space-y-2">
                          {sim.decisions.filter(d => d.action !== 'HOLD').slice(0, 20).map((d, i) => (
                            <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-slate-700/50 last:border-0">
                              <div className="flex items-center gap-3">
                                <span className="text-slate-500">J{d.day}</span>
                                <span className={`font-medium ${
                                  d.botType === 'CHEAP' ? 'text-green-400' :
                                  d.botType === 'PREMIUM' ? 'text-blue-400' : 'text-amber-400'
                                }`}>
                                  {getBotName(d.botType)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge className={
                                  d.action === 'BUY' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                                }>
                                  {d.action === 'BUY' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                                  {d.action}
                                </Badge>
                                <span className="text-slate-400">
                                  {d.quantity.toFixed(2)} @ ${d.price.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ))}
                          {sim.decisions.filter(d => d.action !== 'HOLD').length === 0 && (
                            <div className="text-slate-500 text-center py-4">Aucune transaction</div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>

                    {/* Info supplémentaire */}
                    <div className="flex items-center gap-6 text-sm text-slate-400">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Capital initial: {sim.startCapital.toLocaleString('fr-FR', { style: 'currency', currency: 'USD' })}
                      </div>
                      <div>
                        Durée prévue: {sim.durationDays} jours
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 mt-20 py-8">
        <div className="container mx-auto px-4 text-center text-slate-500 text-sm">
          <p>© 2025 StockIA - Simulation de trading</p>
        </div>
      </footer>
    </div>
  );
}
