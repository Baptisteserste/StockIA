'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, Activity, Settings } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModelCombobox } from '@/components/ui/model-combobox';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import {
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Legend,
    ReferenceLine,
    ComposedChart,
} from 'recharts';

interface Model {
    id: string;
    name: string;
    pricing: {
        prompt: number;
        completion: number;
    };
    context_length?: number;
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
    createdAt: string;
    snapshot: {
        timestamp: string;
        price: number;
    };
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

interface SimulationData {
    id: string;
    symbol: string;
    startCapital: number;
    currentDay: number;
    durationDays: number;
    status: string;
    cheapModelId?: string;
    premiumModelId?: string;
    portfolios: Portfolio[];
    roiHistory: RoiDataPoint[];
    recentDecisions: Decision[];
}

// Enhanced tooltip
const EnhancedTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0]?.payload;
    const filteredPayload = payload.filter((entry: any) =>
        entry.dataKey !== 'price'
    );

    const formatDate = (ts: string | undefined) => {
        if (!ts) return `Tick #${label}`;
        const date = new Date(ts);
        if (isNaN(date.getTime())) return `Tick #${label}`;
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

export default function SimulationV2Page() {
    const [simulation, setSimulation] = useState<SimulationData | null>(null);
    const [models, setModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<'1D' | '7D' | 'ALL'>('ALL');

    // Form state
    const [symbol, setSymbol] = useState('NVDA');
    const [capital, setCapital] = useState('10000');
    const [durationDays, setDurationDays] = useState('21');
    const [cheapModelId, setCheapModelId] = useState('');
    const [premiumModelId, setPremiumModelId] = useState('');
    const [useReddit, setUseReddit] = useState(false);
    const [formLoading, setFormLoading] = useState(false);

    // Algo Bot config
    const [weightTechnical, setWeightTechnical] = useState(60);

    // Start simulation handler
    const handleStartSimulation = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);

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
                setFormLoading(false);
                return;
            }

            setSimulation(data.simulation);
        } catch (error) {
            console.error('Failed to start simulation:', error);
            alert('Erreur lors du démarrage de la simulation');
        } finally {
            setFormLoading(false);
        }
    };

    // Stop simulation handler
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
        }
    };

    // Fetch models
    useEffect(() => {
        const fetchModels = async () => {
            try {
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
                const res = await fetch('/api/openrouter/models');
                const data = await res.json();
                if (data.models) {
                    setModels(data.models);
                    if (data.models.length > 0) {
                        setCheapModelId(data.models[0].id);
                        setPremiumModelId(data.models[Math.min(1, data.models.length - 1)].id);
                    }
                    localStorage.setItem('openrouter_models_v2', JSON.stringify({
                        data: data.models,
                        timestamp: Date.now()
                    }));
                }
            } catch (e) {
                console.error('Failed to fetch models:', e);
            }
        };
        fetchModels();
    }, []);

    // Fetch simulation data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statusRes, decisionsRes] = await Promise.all([
                    fetch('/api/simulation/status'),
                    fetch('/api/debug/decisions')
                ]);

                const statusData = await statusRes.json();
                const decisionsData = await decisionsRes.json();

                if (statusData.active && statusData.simulation) {
                    const allDecisions = (decisionsData.decisions || []).sort(
                        (a: Decision, b: Decision) => new Date(a.snapshot?.timestamp || a.createdAt).getTime() - new Date(b.snapshot?.timestamp || b.createdAt).getTime()
                    );

                    // Group decisions by snapshot timestamp
                    const decisionsByTimestamp: { [key: string]: Decision[] } = {};
                    allDecisions.forEach((d: Decision) => {
                        const ts = d.snapshot?.timestamp || d.createdAt;
                        if (!decisionsByTimestamp[ts]) decisionsByTimestamp[ts] = [];
                        decisionsByTimestamp[ts].push(d);
                    });

                    // Enrich roiHistory with trade actions (timestamp already comes from API now)
                    const enrichedHistory = statusData.simulation.roiHistory.map((point: RoiDataPoint) => {
                        // Find decisions for this snapshot timestamp
                        const pointTimestamp = point.timestamp;
                        const tickDecisions = pointTimestamp ? (decisionsByTimestamp[pointTimestamp] || []) : [];

                        return {
                            ...point,
                            // timestamp already comes from API
                            cheapAction: tickDecisions.find((d: Decision) => d.botType === 'CHEAP' && d.action !== 'HOLD')?.action || null,
                            premiumAction: tickDecisions.find((d: Decision) => d.botType === 'PREMIUM' && d.action !== 'HOLD')?.action || null,
                            algoAction: tickDecisions.find((d: Decision) => d.botType === 'ALGO' && d.action !== 'HOLD')?.action || null,
                        };
                    });

                    setSimulation({
                        ...statusData.simulation,
                        roiHistory: enrichedHistory,
                        recentDecisions: allDecisions
                    });
                }
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

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
            case 'CHEAP': return '#a855f7'; // Violet (was green, caused confusion)
            case 'PREMIUM': return '#3b82f6';
            case 'ALGO': return '#f59e0b';
            default: return '#94a3b8';
        }
    };

    const getModelIcon = (botType: string): string | null => {
        if (botType === 'ALGO') return null;
        const modelId = botType === 'CHEAP' ? simulation?.cheapModelId : simulation?.premiumModelId;
        if (!modelId) return null;
        return models.find(m => m.id === modelId)?.providerIcon || null;
    };

    const formatTimestamp = (timestamp: string | undefined) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    };

    const formatXAxis = (day: number) => {
        const point = simulation?.roiHistory.find(p => p.day === day);
        if (point?.timestamp) {
            const date = new Date(point.timestamp);
            if (!isNaN(date.getTime())) {
                return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            }
        }
        return `J${day}`;
    };

    // Filter data based on time range (relative to last data point, not current time)
    const getFilteredHistory = () => {
        if (!simulation?.roiHistory || simulation.roiHistory.length === 0) return [];
        const history = simulation.roiHistory;

        if (timeRange === 'ALL') return history;

        // Use last data point as reference, not current time
        const lastPoint = history[history.length - 1];
        const lastTimestamp = lastPoint?.timestamp ? new Date(lastPoint.timestamp).getTime() : Date.now();

        const cutoffHours = timeRange === '1D' ? 24 : 24 * 7;
        const cutoffTime = lastTimestamp - (cutoffHours * 60 * 60 * 1000);

        return history.filter(point => {
            if (!point.timestamp) return false;
            return new Date(point.timestamp).getTime() >= cutoffTime;
        });
    };

    const filteredHistory = getFilteredHistory();

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-white text-xl animate-pulse">Chargement...</div>
            </div>
        );
    }

    if (!simulation) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
                {/* Header */}
                <header className="border-b border-slate-700/50 sticky top-0 bg-slate-900/80 backdrop-blur-sm z-50">
                    <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                        <Link href="/" className="text-2xl font-bold text-white">
                            Stock<span className="text-blue-500">IA</span>
                            <span className="text-xs ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">v2</span>
                        </Link>
                    </div>
                </header>

                <main className="container mx-auto px-4 py-12">
                    <div className="max-w-2xl mx-auto">
                        <h1 className="text-3xl font-bold text-white mb-2 text-center">Nouvelle Simulation</h1>
                        <p className="text-slate-400 text-center mb-8">Configurez et lancez votre bataille d'agents IA</p>

                        <form onSubmit={handleStartSimulation} className="space-y-6">
                            {/* Symbol */}
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
                                    disabled={formLoading}
                                />
                                <div className="mt-2 flex gap-2">
                                    {['AAPL', 'TSLA', 'MSFT', 'NVDA'].map(ticker => (
                                        <button
                                            key={ticker}
                                            type="button"
                                            onClick={() => setSymbol(ticker)}
                                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg border border-slate-700 transition-colors"
                                            disabled={formLoading}
                                        >
                                            {ticker}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Model Selection */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Agent Cheap
                                    </label>
                                    <ModelCombobox
                                        models={models}
                                        value={cheapModelId}
                                        onValueChange={setCheapModelId}
                                        disabled={formLoading}
                                        placeholder="Rechercher un modèle cheap..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Agent Premium
                                    </label>
                                    <ModelCombobox
                                        models={models}
                                        value={premiumModelId}
                                        onValueChange={setPremiumModelId}
                                        disabled={formLoading}
                                        placeholder="Rechercher un modèle premium..."
                                    />
                                </div>
                            </div>

                            {/* Capital & Duration */}
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
                                        disabled={formLoading}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Durée (jours)
                                    </label>
                                    <Select value={durationDays} onValueChange={setDurationDays} disabled={formLoading}>
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

                            {/* Reddit Toggle */}
                            <div className="flex items-center gap-3">
                                <Switch
                                    checked={useReddit}
                                    onCheckedChange={setUseReddit}
                                    disabled={formLoading}
                                />
                                <span className="text-sm text-slate-300">Activer analyse Reddit</span>
                            </div>

                            <Button
                                type="submit"
                                disabled={formLoading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3"
                            >
                                {formLoading ? 'Démarrage...' : 'Démarrer la simulation'}
                            </Button>
                        </form>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <header className="border-b border-slate-700/50 sticky top-0 bg-slate-900/80 backdrop-blur-sm z-50">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <Link href="/" className="text-2xl font-bold text-white">
                        Stock<span className="text-blue-500">IA</span>
                        <span className="text-xs ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">v2</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="flex items-center gap-2 text-white">
                                <Activity className="h-4 w-4 text-blue-400" />
                                <span className="font-semibold">{simulation.symbol}</span>
                                <span className="text-slate-400">•</span>
                                <span className="text-slate-300">Jour {simulation.currentDay}/{simulation.durationDays}</span>
                            </div>
                        </div>
                        <Button
                            onClick={handleStopSimulation}
                            variant="destructive"
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Arrêter
                        </Button>
                        <Link href="/simulation" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm text-white transition-colors">
                            Version actuelle
                        </Link>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6">
                {/* Agent Cards - REDESIGNED */}
                <div className="grid grid-cols-3 gap-5 mb-6">
                    {simulation.portfolios.map((portfolio) => {
                        const icon = getModelIcon(portfolio.botType);
                        const isPositive = portfolio.roi >= 0;

                        return (
                            <Card
                                key={portfolio.botType}
                                className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm"
                            >
                                <CardContent className="p-5">
                                    {/* Header with icon and name */}
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
                                                <p className="text-slate-500 text-sm">
                                                    {portfolio.botType === 'ALGO' ? 'Algorithme' : 'IA Agent'}
                                                </p>
                                            </div>
                                        </div>
                                        {/* Algo config gear */}
                                        {portfolio.botType === 'ALGO' && (
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
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
                                    </div>

                                    {/* ROI - BIG */}
                                    <div className="mb-4">
                                        <div className={`text-4xl font-bold flex items-center gap-2 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                            {isPositive ? '+' : ''}{portfolio.roi.toFixed(2)}%
                                            {isPositive ?
                                                <TrendingUp className="h-6 w-6" /> :
                                                <TrendingDown className="h-6 w-6" />
                                            }
                                        </div>
                                    </div>

                                    {/* Position - PROMINENT */}
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

                                    {/* Stats row */}
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

                {/* Main Chart */}
                <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm mb-6">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <h3 className="font-bold text-white text-xl">Performance Comparative</h3>
                            <p className="text-slate-400 text-sm mt-1">
                                Prix actuel: <span className="text-white font-mono">${simulation.roiHistory[simulation.roiHistory.length - 1]?.price.toFixed(2)}</span>
                            </p>
                        </div>
                        <div className="flex gap-2">
                            {(['1D', '7D', 'ALL'] as const).map((range) => (
                                <Button
                                    key={range}
                                    size="sm"
                                    variant={timeRange === range ? 'default' : 'outline'}
                                    className={timeRange === range ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}
                                    onClick={() => setTimeRange(range)}
                                >
                                    {range}
                                </Button>
                            ))}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={380}>
                            <ComposedChart data={filteredHistory}>
                                {filteredHistory.map((point, index) => (
                                    <ReferenceLine key={index} x={point.day} stroke="#334155" strokeDasharray="3 3" strokeOpacity={0.3} />
                                ))}
                                <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />

                                <XAxis
                                    dataKey="day"
                                    stroke="#64748b"
                                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                                    axisLine={{ stroke: '#334155' }}
                                    tickFormatter={formatXAxis}
                                    angle={-45}
                                    textAnchor="end"
                                    height={70}
                                    interval={Math.max(0, Math.floor(filteredHistory.length / 8))}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                                    axisLine={{ stroke: '#334155' }}
                                    domain={['auto', 'auto']}
                                />

                                <Tooltip content={<EnhancedTooltip />} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} formatter={(value) => <span className="text-slate-200 font-medium">{value}</span>} />

                                {/* Lines with trade markers */}
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
                    </CardContent>
                </Card>

                {/* Decisions Log - ALL DECISIONS with scroll */}
                <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                        <h3 className="font-bold text-white text-xl">
                            Toutes les Décisions ({simulation.recentDecisions.length})
                        </h3>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                            {simulation.recentDecisions
                                .sort((a, b) => new Date(b.snapshot?.timestamp || b.createdAt).getTime() - new Date(a.snapshot?.timestamp || a.createdAt).getTime())
                                .map((decision, index) => {
                                    const icon = getModelIcon(decision.botType);
                                    const isBuy = decision.action === 'BUY';
                                    const isSell = decision.action === 'SELL';
                                    const isHold = decision.action === 'HOLD';

                                    const borderColor = isBuy ? '#22c55e' : isSell ? '#ef4444' : '#475569';
                                    const bgColor = isBuy ? 'bg-green-500/10' : isSell ? 'bg-red-500/10' : 'bg-slate-800/30';

                                    return (
                                        <div
                                            key={index}
                                            className={`p-4 rounded-xl ${bgColor}`}
                                        >
                                            {/* Header row */}
                                            <div className="flex items-start justify-between mb-2">
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
                                                        {/* ACTION with quantity and price - SAME BADGE */}
                                                        <div className="mt-1">
                                                            <span className={`px-3 py-1.5 rounded-lg text-base font-bold inline-block ${isBuy ? 'bg-green-500 text-white' :
                                                                isSell ? 'bg-red-500 text-white' :
                                                                    'bg-slate-600 text-slate-200'
                                                                }`}>
                                                                {decision.action}
                                                                {!isHold && ` ${decision.quantity.toFixed(2)} @ $${decision.price.toFixed(2)}`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    {decision.confidence && (
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full"
                                                                    style={{
                                                                        width: `${decision.confidence * 100}%`,
                                                                        backgroundColor: decision.confidence > 0.7 ? '#22c55e' : decision.confidence > 0.4 ? '#f59e0b' : '#ef4444'
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className="text-white font-bold text-sm">
                                                                {(decision.confidence * 100).toFixed(0)}%
                                                            </span>
                                                        </div>
                                                    )}
                                                    <p className="text-slate-500 text-xs">
                                                        {formatTimestamp(decision.snapshot?.timestamp || decision.createdAt)}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Reason */}
                                            {decision.reason && (
                                                <p className="text-slate-300 text-base leading-relaxed mt-3">
                                                    {decision.reason}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            {simulation.recentDecisions.length === 0 && (
                                <p className="text-slate-500 text-center py-8">Aucune décision pour le moment</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
