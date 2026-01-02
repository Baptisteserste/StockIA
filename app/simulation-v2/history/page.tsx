'use client';

import { useState, useEffect } from 'react';
import { Trophy, ChevronDown, ChevronUp, Calendar, DollarSign, TrendingUp, TrendingDown, ArrowLeft, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';

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
    timestamp?: string;
    price: number;
    CHEAP?: number;
    PREMIUM?: number;
    ALGO?: number;
    cheapAction?: 'BUY' | 'SELL' | null;
    premiumAction?: 'BUY' | 'SELL' | null;
    algoAction?: 'BUY' | 'SELL' | null;
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
    cheapModelId?: string;
    premiumModelId?: string;
    winner: {
        botType: string;
        roi: number;
        totalValue: number;
    } | null;
    portfolios: Portfolio[];
    roiHistory: RoiDataPoint[];
    decisions: Decision[];
}

interface Model {
    id: string;
    name: string;
    providerIcon?: string;
}

// Enhanced tooltip - EXACT COPY from simulation-v2
const EnhancedTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0]?.payload;
    const filteredPayload = payload.filter((entry: any) =>
        entry.dataKey !== 'price'
    );

    const formatDate = (ts: string | undefined) => {
        if (!ts) return `Jour ${label}`;
        const date = new Date(ts);
        if (isNaN(date.getTime())) return `Jour ${label}`;
        return date.toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-4 shadow-2xl">
            <p className="text-white font-semibold mb-3 text-sm">
                📅 {formatDate(data?.timestamp)}
            </p>
            <div className="space-y-2">
                {filteredPayload.map((entry: any, index: number) => {
                    const actionKey = `${entry.dataKey.toLowerCase()}Action`;
                    const action = data[actionKey];
                    return (
                        <div key={index} className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-white font-medium">{entry.name}</span>
                                {action && (
                                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${action === 'BUY' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                                        }`}>
                                        {action}
                                    </span>
                                )}
                            </div>
                            <span className={`font-mono font-bold ${entry.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {entry.value >= 0 ? '+' : ''}{entry.value?.toFixed(2)}%
                            </span>
                        </div>
                    );
                })}
            </div>
            {data?.price && (
                <p className="text-slate-400 text-sm mt-3 pt-3 border-t border-slate-700">
                    💰 Prix: <span className="text-white font-mono">${data.price.toFixed(2)}</span>
                </p>
            )}
        </div>
    );
};

export default function HistoryV2Page() {
    const [history, setHistory] = useState<HistorySimulation[]>([]);
    const [models, setModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        fetchHistory();
        fetchModels();
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

    const fetchModels = async () => {
        try {
            const cached = localStorage.getItem('openrouter_models_v2');
            if (cached) {
                const { data } = JSON.parse(cached);
                setModels(data);
                return;
            }
            const res = await fetch('/api/openrouter/models');
            const data = await res.json();
            setModels(data.models || data || []);
        } catch (e) {
            console.error('Failed to fetch models:', e);
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

    // EXACT COLORS from simulation-v2
    const getBotColor = (type: string) => {
        switch (type) {
            case 'CHEAP': return '#a855f7'; // Violet
            case 'PREMIUM': return '#3b82f6'; // Blue
            case 'ALGO': return '#f59e0b'; // Orange
            default: return '#94a3b8';
        }
    };

    // Get model icon - EXACT from simulation-v2
    const getModelIcon = (sim: HistorySimulation, botType: string): string | null => {
        if (botType === 'ALGO') return null;
        const modelId = botType === 'CHEAP' ? sim.cheapModelId : sim.premiumModelId;
        if (!modelId) return null;
        return models.find(m => m.id === modelId)?.providerIcon || null;
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
            {/* Header - EXACT simulation-v2 style */}
            <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-xl font-bold text-white">
                            Stock<span className="text-blue-500">IA</span>
                        </Link>
                        <span className="text-slate-600">|</span>
                        <span className="text-slate-400 font-medium">Historique</span>
                    </div>
                    <Link
                        href="/simulation-v2"
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-semibold text-white transition-colors flex items-center gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Retour
                    </Link>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-white">Simulations Terminées</h1>
                    <p className="text-slate-400 text-sm">{history.length} simulation{history.length !== 1 ? 's' : ''}</p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                ) : history.length === 0 ? (
                    <Card className="bg-slate-900/80 border-slate-700/50">
                        <CardContent className="py-16 text-center">
                            <p className="text-slate-400 mb-6">Aucune simulation terminée</p>
                            <Link href="/simulation-v2">
                                <Button className="bg-blue-600 hover:bg-blue-700">Lancer une simulation</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {history.map(sim => (
                            <Card
                                key={sim.id}
                                className={`bg-slate-900/80 border-slate-700/50 backdrop-blur-sm overflow-hidden ${expandedId === sim.id ? 'ring-1 ring-blue-500/50' : ''
                                    }`}
                            >
                                {/* Header */}
                                <button onClick={() => setExpandedId(expandedId === sim.id ? null : sim.id)} className="w-full text-left">
                                    <div className="flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center border border-slate-700/50">
                                                <span className="text-lg font-bold text-white">{sim.symbol}</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${sim.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                                                        }`}>
                                                        {sim.status === 'COMPLETED' ? '✓ Terminée' : '⚠ Arrêtée'}
                                                    </span>
                                                    <span className="text-slate-500 text-sm">{sim.currentDay} / {sim.durationDays}j</span>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-slate-400">
                                                    <span>${sim.startCapital.toLocaleString()}</span>
                                                    <span>{formatDate(sim.createdAt)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {sim.winner && (
                                                <div className="flex items-center gap-3 bg-yellow-500/10 px-4 py-2 rounded-lg border border-yellow-500/20">
                                                    <Trophy className="h-5 w-5 text-yellow-500" />
                                                    <span className="text-white font-medium">{getBotName(sim.winner.botType)}</span>
                                                    <span className={`text-xl font-bold ${sim.winner.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {sim.winner.roi >= 0 ? '+' : ''}{sim.winner.roi.toFixed(2)}%
                                                    </span>
                                                </div>
                                            )}
                                            <div className={`p-2 rounded-lg ${expandedId === sim.id ? 'bg-blue-500/20' : 'bg-slate-800'}`}>
                                                {expandedId === sim.id ? <ChevronUp className="h-5 w-5 text-blue-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                                            </div>
                                        </div>
                                    </div>
                                </button>

                                {/* Expanded content - EXACT simulation-v2 components */}
                                {expandedId === sim.id && (
                                    <CardContent className="border-t border-slate-800 pt-6 space-y-6 bg-slate-950/50">
                                        {/* Agent Cards - EXACT simulation-v2 */}
                                        <div className="grid grid-cols-3 gap-5">
                                            {sim.portfolios.map(portfolio => {
                                                const icon = getModelIcon(sim, portfolio.botType);
                                                const isWinner = sim.winner?.botType === portfolio.botType;
                                                const isPositive = portfolio.roi >= 0;

                                                return (
                                                    <Card key={portfolio.botType} className={`bg-slate-900/80 border-slate-700/50 backdrop-blur-sm ${isWinner ? 'ring-2 ring-yellow-500/50' : ''}`}>
                                                        <CardContent className="p-5">
                                                            {/* Header with icon - EXACT */}
                                                            <div className="flex items-center justify-between mb-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div
                                                                        className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                                                                        style={{ backgroundColor: `${getBotColor(portfolio.botType)}20`, border: `1px solid ${getBotColor(portfolio.botType)}40` }}
                                                                    >
                                                                        {icon ? (
                                                                            <img src={icon} alt="Provider" className="w-7 h-7 rounded" />
                                                                        ) : (
                                                                            <span className="text-2xl">{portfolio.botType === 'ALGO' ? '⚙️' : '🤖'}</span>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <h3 className="font-bold text-white text-lg">{getBotName(portfolio.botType)}</h3>
                                                                        <p className="text-slate-500 text-sm">{portfolio.botType === 'ALGO' ? 'Algorithme' : 'IA Agent'}</p>
                                                                    </div>
                                                                </div>
                                                                {isWinner && <Trophy className="h-5 w-5 text-yellow-500" />}
                                                            </div>

                                                            {/* ROI - BIG */}
                                                            <div className="mb-4">
                                                                <div className={`text-4xl font-bold flex items-center gap-2 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                                                    {isPositive ? '+' : ''}{portfolio.roi.toFixed(2)}%
                                                                    {isPositive ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                                                                </div>
                                                            </div>

                                                            {/* Position */}
                                                            <div className="bg-slate-800/50 rounded-xl p-4 mb-3">
                                                                <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                                                                    <Wallet className="h-4 w-4" />
                                                                    Position
                                                                </div>
                                                                <div className="text-white">
                                                                    <span className="text-2xl font-bold">{portfolio.shares.toFixed(2)}</span>
                                                                    <span className="text-slate-400 ml-2">actions</span>
                                                                </div>
                                                            </div>

                                                            {/* Stats */}
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="bg-slate-800/30 rounded-lg p-3">
                                                                    <p className="text-slate-500 text-xs mb-1">Cash</p>
                                                                    <p className="text-white font-mono font-semibold">${portfolio.cash.toLocaleString()}</p>
                                                                </div>
                                                                <div className="bg-slate-800/30 rounded-lg p-3">
                                                                    <p className="text-slate-500 text-xs mb-1">Valeur totale</p>
                                                                    <p className="text-white font-mono font-semibold">${portfolio.totalValue.toLocaleString()}</p>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>

                                        {/* Chart - EXACT simulation-v2 (no Buy & Hold, same tooltip) */}
                                        <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
                                            <CardHeader className="pb-2">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-bold text-white text-xl">Performance Comparative</h3>
                                                    <p className="text-slate-400 text-sm">
                                                        Prix final: <span className="text-white font-mono">${sim.roiHistory.length > 0 ? sim.roiHistory[sim.roiHistory.length - 1]?.price?.toFixed(2) : 'N/A'}</span>
                                                    </p>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                {sim.roiHistory.length > 1 ? (
                                                    <ResponsiveContainer width="100%" height={380}>
                                                        <ComposedChart data={sim.roiHistory}>
                                                            <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
                                                            <XAxis
                                                                dataKey="day"
                                                                stroke="#64748b"
                                                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                                                axisLine={{ stroke: '#334155' }}
                                                                tickFormatter={(v) => `J${v}`}
                                                            />
                                                            <YAxis
                                                                stroke="#64748b"
                                                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                                                tickFormatter={(v) => `${v.toFixed(0)}%`}
                                                                axisLine={{ stroke: '#334155' }}
                                                            />
                                                            <Tooltip content={<EnhancedTooltip />} />
                                                            <Legend wrapperStyle={{ paddingTop: '20px' }} formatter={(value) => <span className="text-slate-200 font-medium">{value}</span>} />

                                                            {/* Lines with trade dots - EXACT colors */}
                                                            <Line type="monotone" dataKey="CHEAP" stroke="#a855f7" name="Agent Cheap" strokeWidth={2.5}
                                                                dot={(props: any) => {
                                                                    if (props.payload.cheapAction) {
                                                                        return <circle cx={props.cx} cy={props.cy} r={7} fill={props.payload.cheapAction === 'BUY' ? '#22c55e' : '#ef4444'} stroke="#fff" strokeWidth={2} />;
                                                                    }
                                                                    return <circle cx={props.cx} cy={props.cy} r={0} />;
                                                                }}
                                                                activeDot={{ r: 6, strokeWidth: 2 }}
                                                            />
                                                            <Line type="monotone" dataKey="PREMIUM" stroke="#3b82f6" name="Agent Premium" strokeWidth={2.5}
                                                                dot={(props: any) => {
                                                                    if (props.payload.premiumAction) {
                                                                        return <circle cx={props.cx} cy={props.cy} r={7} fill={props.payload.premiumAction === 'BUY' ? '#22c55e' : '#ef4444'} stroke="#fff" strokeWidth={2} />;
                                                                    }
                                                                    return <circle cx={props.cx} cy={props.cy} r={0} />;
                                                                }}
                                                                activeDot={{ r: 6, strokeWidth: 2 }}
                                                            />
                                                            <Line type="monotone" dataKey="ALGO" stroke="#f59e0b" name="Algo Bot" strokeWidth={2.5}
                                                                dot={(props: any) => {
                                                                    if (props.payload.algoAction) {
                                                                        return <circle cx={props.cx} cy={props.cy} r={7} fill={props.payload.algoAction === 'BUY' ? '#22c55e' : '#ef4444'} stroke="#fff" strokeWidth={2} />;
                                                                    }
                                                                    return <circle cx={props.cx} cy={props.cy} r={0} />;
                                                                }}
                                                                activeDot={{ r: 6, strokeWidth: 2 }}
                                                            />
                                                        </ComposedChart>
                                                    </ResponsiveContainer>
                                                ) : (
                                                    <div className="h-48 flex items-center justify-center text-slate-500">
                                                        Pas assez de données
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>

                                        {/* Decisions - EXACT simulation-v2 style */}
                                        <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
                                            <CardHeader className="pb-3">
                                                <h3 className="font-bold text-white text-xl">
                                                    Toutes les Décisions ({sim.decisions.filter(d => d.action !== 'HOLD').length})
                                                </h3>
                                            </CardHeader>
                                            <CardContent>
                                                <ScrollArea className="h-[400px]">
                                                    <div className="space-y-3">
                                                        {sim.decisions
                                                            .filter(d => d.action !== 'HOLD')
                                                            .sort((a, b) => b.day - a.day)
                                                            .map((decision, index) => {
                                                                const icon = getModelIcon(sim, decision.botType);
                                                                const isBuy = decision.action === 'BUY';
                                                                const isSell = decision.action === 'SELL';
                                                                const bgColor = isBuy ? 'bg-green-500/10' : isSell ? 'bg-red-500/10' : 'bg-slate-800/30';

                                                                return (
                                                                    <div key={index} className={`p-4 rounded-xl ${bgColor}`}>
                                                                        <div className="flex items-start justify-between">
                                                                            <div className="flex items-center gap-3">
                                                                                <div
                                                                                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                                                                    style={{ backgroundColor: `${getBotColor(decision.botType)}20` }}
                                                                                >
                                                                                    {icon ? (
                                                                                        <img src={icon} alt="Provider" className="w-6 h-6 rounded" />
                                                                                    ) : (
                                                                                        <span className="text-lg">{decision.botType === 'ALGO' ? '⚙️' : '🤖'}</span>
                                                                                    )}
                                                                                </div>
                                                                                <div>
                                                                                    <p className="text-white font-bold text-lg">{getBotName(decision.botType)}</p>
                                                                                    <div className="mt-1">
                                                                                        <span className={`px-3 py-1.5 rounded-lg text-base font-bold inline-block ${isBuy ? 'bg-green-500 text-white' :
                                                                                                isSell ? 'bg-red-500 text-white' :
                                                                                                    'bg-slate-600 text-slate-200'
                                                                                            }`}>
                                                                                            {decision.action} {decision.quantity.toFixed(2)} @ ${decision.price.toFixed(2)}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <p className="text-slate-400 text-sm">Jour {decision.day}</p>
                                                                                {decision.confidence && (
                                                                                    <div className="flex items-center gap-2 mt-1">
                                                                                        <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                                                            <div
                                                                                                className="h-full rounded-full"
                                                                                                style={{ width: `${decision.confidence * 100}%`, backgroundColor: getBotColor(decision.botType) }}
                                                                                            />
                                                                                        </div>
                                                                                        <span className="text-xs text-slate-400">{(decision.confidence * 100).toFixed(0)}%</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        {decision.reason && (
                                                                            <p className="text-slate-400 text-sm mt-3 pl-13">{decision.reason}</p>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
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
