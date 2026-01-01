'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, Activity, Target, BarChart3, Clock, Loader2 } from 'lucide-react';

interface Trade {
    day: number;
    date: string;
    action: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    value: number;
    score: number;
    rsi: number;
}

interface HistoryPoint {
    day: number;
    date: string;
    price: number;
    algoValue: number;
    algoRoi: number;
    buyHoldValue: number;
    buyHoldRoi: number;
}

interface BacktestResult {
    success: boolean;
    symbol: string;
    days: number;
    dataPoints: number;
    algo: {
        roi: number;
        finalValue: number;
        winRate: number;
        maxDrawdown: number;
        totalTrades: number;
        buyTrades: number;
        sellTrades: number;
    };
    buyHold: {
        roi: number;
        finalValue: number;
        shares: number;
    };
    trades: Trade[];
    history: HistoryPoint[];
    config: {
        weightTechnical: number;
        initialCapital: number;
    };
}

export default function BacktestPage() {
    const [symbol, setSymbol] = useState('NVDA');
    const [days, setDays] = useState('180');
    const [weightTechnical, setWeightTechnical] = useState(70);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<BacktestResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const runBacktest = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/backtest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: symbol.toUpperCase(),
                    days: parseInt(days),
                    weightTechnical
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Backtest failed');
            }

            setResults(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const algoBeatsMarket = results && results.algo.roi > results.buyHold.roi;

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-8">
            <div className="container mx-auto px-4">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <BarChart3 className="h-8 w-8 text-blue-500" />
                        Backtesting Engine
                    </h1>
                    <p className="text-slate-400 mt-2">
                        Testez la stratégie Algo Bot sur des données historiques
                    </p>
                </div>

                {/* Config Form */}
                <Card className="bg-slate-900/80 border-slate-700 mb-6">
                    <CardHeader>
                        <CardTitle className="text-white">Configuration</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-4 gap-6">
                            <div>
                                <label className="text-sm text-slate-400 mb-2 block">Symbole</label>
                                <Input
                                    value={symbol}
                                    onChange={(e) => setSymbol(e.target.value)}
                                    placeholder="NVDA"
                                    className="bg-slate-800 border-slate-600 text-white"
                                />
                            </div>

                            <div>
                                <label className="text-sm text-slate-400 mb-2 block">Période</label>
                                <Select value={days} onValueChange={setDays}>
                                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="30">30 jours</SelectItem>
                                        <SelectItem value="90">90 jours</SelectItem>
                                        <SelectItem value="180">6 mois</SelectItem>
                                        <SelectItem value="365">1 an</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="text-sm text-slate-400 mb-2 block">
                                    Poids Technique: {weightTechnical}%
                                </label>
                                <Slider
                                    value={[weightTechnical]}
                                    onValueChange={(v) => setWeightTechnical(v[0])}
                                    max={100}
                                    step={10}
                                    className="mt-3"
                                />
                            </div>

                            <div className="flex items-end">
                                <Button
                                    onClick={runBacktest}
                                    disabled={loading}
                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Simulation...
                                        </>
                                    ) : (
                                        <>
                                            <Activity className="h-4 w-4 mr-2" />
                                            Lancer Backtest
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {error && (
                    <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {results && (
                    <>
                        {/* Results Summary */}
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <Card className={`${algoBeatsMarket ? 'bg-green-900/30 border-green-500/50' : 'bg-slate-900/80 border-slate-700'}`}>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-slate-400 text-sm">Algo ROI</p>
                                            <p className={`text-2xl font-bold ${results.algo.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {results.algo.roi >= 0 ? '+' : ''}{results.algo.roi.toFixed(2)}%
                                            </p>
                                        </div>
                                        {results.algo.roi >= 0 ? <TrendingUp className="h-8 w-8 text-green-500" /> : <TrendingDown className="h-8 w-8 text-red-500" />}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-900/80 border-slate-700">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-slate-400 text-sm">Buy & Hold ROI</p>
                                            <p className={`text-2xl font-bold ${results.buyHold.roi >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                                {results.buyHold.roi >= 0 ? '+' : ''}{results.buyHold.roi.toFixed(2)}%
                                            </p>
                                        </div>
                                        <Target className="h-8 w-8 text-blue-500" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-900/80 border-slate-700">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-slate-400 text-sm">Win Rate</p>
                                            <p className="text-2xl font-bold text-white">
                                                {results.algo.winRate.toFixed(0)}%
                                            </p>
                                        </div>
                                        <Activity className="h-8 w-8 text-purple-500" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-900/80 border-slate-700">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-slate-400 text-sm">Max Drawdown</p>
                                            <p className="text-2xl font-bold text-orange-400">
                                                -{results.algo.maxDrawdown.toFixed(2)}%
                                            </p>
                                        </div>
                                        <TrendingDown className="h-8 w-8 text-orange-500" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Verdict */}
                        <Card className={`mb-6 ${algoBeatsMarket ? 'bg-green-900/20 border-green-500/50' : 'bg-orange-900/20 border-orange-500/50'}`}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-4">
                                    {algoBeatsMarket ? (
                                        <>
                                            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                                                <TrendingUp className="h-6 w-6 text-green-500" />
                                            </div>
                                            <div>
                                                <p className="text-green-400 font-bold text-lg">
                                                    🎯 L&apos;Algo bat le marché de +{(results.algo.roi - results.buyHold.roi).toFixed(2)}%
                                                </p>
                                                <p className="text-slate-400">
                                                    Avec {results.algo.totalTrades} trades et un drawdown max de -{results.algo.maxDrawdown.toFixed(2)}% (vs -{(results.buyHold.roi < 0 ? Math.abs(results.buyHold.roi) : 0).toFixed(2)}% pour B&H)
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                                                <Target className="h-6 w-6 text-orange-500" />
                                            </div>
                                            <div>
                                                <p className="text-orange-400 font-bold text-lg">
                                                    Buy & Hold gagne de +{(results.buyHold.roi - results.algo.roi).toFixed(2)}%
                                                </p>
                                                <p className="text-slate-400">
                                                    Mais l&apos;Algo a un drawdown de -{results.algo.maxDrawdown.toFixed(2)}% vs marché haussier
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Chart */}
                        <Card className="bg-slate-900/80 border-slate-700 mb-6">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5" />
                                    Performance Comparative - {results.symbol} ({results.dataPoints} jours)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={results.history}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis
                                                dataKey="date"
                                                stroke="#94a3b8"
                                                tick={{ fontSize: 12 }}
                                                tickFormatter={(v) => v.slice(5)} // MM-DD
                                            />
                                            <YAxis
                                                stroke="#94a3b8"
                                                tick={{ fontSize: 12 }}
                                                tickFormatter={(v) => `${v.toFixed(0)}%`}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#1e293b',
                                                    border: '1px solid #475569',
                                                    borderRadius: '8px'
                                                }}
                                                formatter={(value: number, name: string) => [
                                                    `${value.toFixed(2)}%`,
                                                    name === 'algoRoi' ? 'Algo Bot' : 'Buy & Hold'
                                                ]}
                                            />
                                            <Legend />
                                            <ReferenceLine y={0} stroke="#475569" />
                                            <Line
                                                type="monotone"
                                                dataKey="algoRoi"
                                                stroke="#22c55e"
                                                strokeWidth={2}
                                                dot={false}
                                                name="Algo Bot"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="buyHoldRoi"
                                                stroke="#3b82f6"
                                                strokeWidth={2}
                                                dot={false}
                                                name="Buy & Hold"
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Trades List */}
                        <Card className="bg-slate-900/80 border-slate-700">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Clock className="h-5 w-5" />
                                    Historique des Trades ({results.trades.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="max-h-[300px] overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="text-slate-400 border-b border-slate-700">
                                            <tr>
                                                <th className="text-left py-2">Date</th>
                                                <th className="text-left py-2">Action</th>
                                                <th className="text-right py-2">Prix</th>
                                                <th className="text-right py-2">Quantité</th>
                                                <th className="text-right py-2">Score</th>
                                                <th className="text-right py-2">RSI</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.trades.map((trade, i) => (
                                                <tr key={i} className="border-b border-slate-800">
                                                    <td className="py-2 text-slate-300">{trade.date}</td>
                                                    <td className="py-2">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${trade.action === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                                            }`}>
                                                            {trade.action}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 text-right text-white font-mono">${trade.price.toFixed(2)}</td>
                                                    <td className="py-2 text-right text-slate-300">{trade.quantity}</td>
                                                    <td className="py-2 text-right text-slate-300">{trade.score.toFixed(2)}</td>
                                                    <td className="py-2 text-right text-slate-300">{trade.rsi.toFixed(0)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}
