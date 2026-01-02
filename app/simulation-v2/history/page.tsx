'use client';

import { useState, useEffect } from 'react';
import { Trophy, ChevronDown, ChevronUp, Calendar, DollarSign, TrendingUp, TrendingDown, BarChart3, Clock, Activity, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, ReferenceLine } from 'recharts';

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

export default function HistoryV2Page() {
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
            case 'CHEAP': return 'text-green-400';
            case 'PREMIUM': return 'text-blue-400';
            case 'ALGO': return 'text-amber-400';
            default: return 'text-slate-400';
        }
    };

    const getModelIcon = (type: string) => {
        switch (type) {
            case 'CHEAP': return '💚';
            case 'PREMIUM': return '💎';
            case 'ALGO': return '⚙️';
            default: return '🤖';
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
            {/* Header - Exact simulation-v2 style */}
            <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link href="/" className="text-xl font-bold text-white flex items-center gap-2">
                            Stock<span className="text-blue-500">IA</span>
                        </Link>
                        <div className="h-6 w-px bg-slate-700"></div>
                        <div className="flex items-center gap-2 text-slate-400">
                            <BarChart3 className="h-4 w-4" />
                            <span className="font-medium">Historique</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/simulation-v2"
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-semibold text-white transition-colors flex items-center gap-2"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Retour
                        </Link>
                        <Link
                            href="/"
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition-colors"
                        >
                            Accueil
                        </Link>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6">
                {/* Stats Header */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
                        <CardContent className="p-4">
                            <div className="text-slate-400 text-sm mb-1">Simulations</div>
                            <div className="text-2xl font-bold text-white">{history.length}</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
                        <CardContent className="p-4">
                            <div className="text-slate-400 text-sm mb-1">Terminées</div>
                            <div className="text-2xl font-bold text-green-400">
                                {history.filter(s => s.status === 'COMPLETED').length}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
                        <CardContent className="p-4">
                            <div className="text-slate-400 text-sm mb-1">Algo Bot Wins</div>
                            <div className="text-2xl font-bold text-amber-400">
                                {history.filter(s => s.winner?.botType === 'ALGO').length}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
                        <CardContent className="p-4">
                            <div className="text-slate-400 text-sm mb-1">Meilleur ROI</div>
                            <div className="text-2xl font-bold text-blue-400">
                                {history.length > 0
                                    ? `+${Math.max(...history.map(s => s.winner?.roi || 0)).toFixed(1)}%`
                                    : 'N/A'
                                }
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                ) : history.length === 0 ? (
                    <Card className="bg-slate-900/80 border-slate-700/50">
                        <CardContent className="py-16 text-center">
                            <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-400 mb-6">Aucune simulation terminée</p>
                            <Link href="/simulation-v2">
                                <Button className="bg-blue-600 hover:bg-blue-700">
                                    Lancer votre première simulation
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {history.map(sim => (
                            <Card
                                key={sim.id}
                                className={`bg-slate-900/80 border-slate-700/50 backdrop-blur-sm overflow-hidden transition-all duration-200 ${expandedId === sim.id ? 'ring-1 ring-blue-500/50' : 'hover:border-slate-600'
                                    }`}
                            >
                                {/* Header cliquable */}
                                <button
                                    onClick={() => setExpandedId(expandedId === sim.id ? null : sim.id)}
                                    className="w-full text-left"
                                >
                                    <div className="flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors">
                                        <div className="flex items-center gap-4">
                                            {/* Symbol Badge */}
                                            <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center border border-slate-700/50">
                                                <span className="text-lg font-bold text-white">{sim.symbol}</span>
                                            </div>

                                            {/* Info */}
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <Badge
                                                        variant="outline"
                                                        className={`${sim.status === 'COMPLETED'
                                                                ? 'border-green-500/50 text-green-400 bg-green-500/10'
                                                                : 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10'
                                                            }`}
                                                    >
                                                        {sim.status === 'COMPLETED' ? '✓ Terminée' : '⚠ Arrêtée'}
                                                    </Badge>
                                                    <span className="text-slate-500 text-sm">{sim.currentDay} / {sim.durationDays} jours</span>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        <DollarSign className="h-3.5 w-3.5" />
                                                        {sim.startCapital.toLocaleString()}$
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        {formatDate(sim.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {/* Winner */}
                                            {sim.winner && (
                                                <div className="flex items-center gap-3 bg-yellow-500/10 px-4 py-2 rounded-lg border border-yellow-500/20">
                                                    <Trophy className="h-5 w-5 text-yellow-500" />
                                                    <div className="text-right">
                                                        <div className="text-xs text-slate-400">Gagnant</div>
                                                        <div className="font-semibold text-white text-sm">{getBotName(sim.winner.botType)}</div>
                                                    </div>
                                                    <div className={`text-xl font-bold ${sim.winner.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {sim.winner.roi >= 0 ? '+' : ''}{sim.winner.roi.toFixed(2)}%
                                                    </div>
                                                </div>
                                            )}

                                            {/* Chevron */}
                                            <div className={`p-2 rounded-lg transition-colors ${expandedId === sim.id ? 'bg-blue-500/20' : 'bg-slate-800'}`}>
                                                {expandedId === sim.id ? (
                                                    <ChevronUp className="h-5 w-5 text-blue-400" />
                                                ) : (
                                                    <ChevronDown className="h-5 w-5 text-slate-400" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </button>

                                {/* Contenu expandable */}
                                {expandedId === sim.id && (
                                    <CardContent className="border-t border-slate-800 pt-5 space-y-5 bg-slate-950/50 px-5 pb-5">
                                        {/* Agent Cards - Style simulation-v2 */}
                                        <div className="grid grid-cols-3 gap-4">
                                            {sim.portfolios.map(portfolio => (
                                                <Card
                                                    key={portfolio.botType}
                                                    className={`bg-slate-900/80 border-slate-700/50 backdrop-blur-sm ${sim.winner?.botType === portfolio.botType
                                                            ? 'ring-2 ring-yellow-500/50'
                                                            : ''
                                                        }`}
                                                >
                                                    <CardContent className="p-4">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xl">{getModelIcon(portfolio.botType)}</span>
                                                                <div>
                                                                    <span className={`font-semibold text-sm ${getBotColor(portfolio.botType)}`}>
                                                                        {getBotName(portfolio.botType)}
                                                                    </span>
                                                                    {sim.winner?.botType === portfolio.botType && (
                                                                        <Trophy className="h-3 w-3 text-yellow-500 inline ml-2" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className={`text-2xl font-bold mb-2 ${portfolio.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {portfolio.roi >= 0 ? '+' : ''}{portfolio.roi.toFixed(2)}%
                                                        </div>

                                                        <div className="text-xs text-slate-400 space-y-1">
                                                            <div className="flex justify-between">
                                                                <span>Valeur finale</span>
                                                                <span className="text-white font-mono">${portfolio.totalValue.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Cash</span>
                                                                <span className="text-white font-mono">${portfolio.cash.toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>

                                        {/* Performance Chart */}
                                        <Card className="bg-slate-900/80 border-slate-700/50">
                                            <CardContent className="p-4">
                                                <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                                                    <Activity className="h-4 w-4 text-blue-500" />
                                                    Performance Comparative
                                                </h4>
                                                {sim.roiHistory.length > 1 ? (
                                                    <ResponsiveContainer width="100%" height={250}>
                                                        <LineChart data={sim.roiHistory}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                            <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11 }} />
                                                            <YAxis stroke="#64748b" tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 11 }} />
                                                            <Tooltip
                                                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                                                                labelStyle={{ color: '#fff' }}
                                                                formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
                                                            />
                                                            <Legend />
                                                            <ReferenceLine y={0} stroke="#475569" />
                                                            <Line type="monotone" dataKey="CHEAP" stroke="#22c55e" name="Agent Cheap" strokeWidth={2} dot={false} />
                                                            <Line type="monotone" dataKey="PREMIUM" stroke="#3b82f6" name="Agent Premium" strokeWidth={2} dot={false} />
                                                            <Line type="monotone" dataKey="ALGO" stroke="#f59e0b" name="Algo Bot" strokeWidth={2} dot={false} />
                                                            <Line type="monotone" dataKey="BUYHOLD" stroke="#94a3b8" name="Buy & Hold" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                ) : (
                                                    <div className="h-48 flex items-center justify-center text-slate-500">
                                                        Pas assez de données pour afficher le graphique
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>

                                        {/* Decisions Log */}
                                        <Card className="bg-slate-900/80 border-slate-700/50">
                                            <CardContent className="p-4">
                                                <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-purple-500" />
                                                    Décisions ({sim.decisions.filter(d => d.action !== 'HOLD').length})
                                                </h4>
                                                <ScrollArea className="h-48">
                                                    <div className="space-y-2">
                                                        {sim.decisions.filter(d => d.action !== 'HOLD').slice(0, 30).map((d, i) => (
                                                            <div
                                                                key={i}
                                                                className="flex items-center justify-between text-sm py-2 px-3 bg-slate-800/50 rounded-lg"
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    <span className="text-slate-500 font-mono text-xs">J{d.day}</span>
                                                                    <span className={`font-medium ${getBotColor(d.botType)}`}>
                                                                        {getBotName(d.botType)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <Badge className={`text-xs ${d.action === 'BUY'
                                                                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                                                            : 'bg-red-500/20 text-red-400 border-red-500/30'
                                                                        }`}>
                                                                        {d.action === 'BUY' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                                                                        {d.action}
                                                                    </Badge>
                                                                    <span className="text-slate-300 font-mono text-xs">
                                                                        {d.quantity.toFixed(2)} @ ${d.price.toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {sim.decisions.filter(d => d.action !== 'HOLD').length === 0 && (
                                                            <div className="text-slate-500 text-center py-8">Aucune transaction</div>
                                                        )}
                                                    </div>
                                                </ScrollArea>
                                            </CardContent>
                                        </Card>
                                    </CardContent>
                                )}
                            </Card>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
