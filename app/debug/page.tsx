'use client';

import { useEffect, useState } from 'react';

interface DebugDecision {
    id: string;
    botType: string;
    action: string;
    quantity: number;
    price: number;
    reason: string;
    confidence: number | null;
    debugData: any;
    createdAt: string;
    snapshot: {
        timestamp: string;
        price: number;
        rsi: number | null;
        macd: number | null;
        sentimentScore: number;
    };
}

export default function DebugPage() {
    const [decisions, setDecisions] = useState<DebugDecision[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDecision, setSelectedDecision] = useState<DebugDecision | null>(null);
    const [filter, setFilter] = useState<string>('ALL');

    useEffect(() => {
        fetchDecisions();
    }, []);

    const fetchDecisions = async () => {
        try {
            const res = await fetch('/api/debug/decisions');
            const data = await res.json();
            setDecisions(data.decisions || []);
        } catch (error) {
            console.error('Failed to fetch decisions:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredDecisions = filter === 'ALL'
        ? decisions
        : decisions.filter(d => d.botType === filter);

    const getBotColor = (botType: string) => {
        switch (botType) {
            case 'CHEAP': return 'text-yellow-400';
            case 'PREMIUM': return 'text-purple-400';
            case 'ALGO': return 'text-cyan-400';
            default: return 'text-gray-400';
        }
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'BUY': return 'bg-green-500';
            case 'SELL': return 'bg-red-500';
            case 'HOLD': return 'bg-gray-500';
            default: return 'bg-gray-500';
        }
    };

    const hasError = (decision: DebugDecision) => {
        return decision.debugData?.error || decision.reason.includes('Erreur');
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">🔍 Debug Console</h1>

                {/* Filters */}
                <div className="flex gap-4 mb-6">
                    {['ALL', 'CHEAP', 'PREMIUM', 'ALGO'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg transition-colors ${filter === f
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                    <button
                        onClick={fetchDecisions}
                        className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 ml-auto"
                    >
                        🔄 Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-10">Loading...</div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Decisions List */}
                        <div className="bg-slate-800 rounded-xl p-4 max-h-[80vh] overflow-y-auto">
                            <h2 className="text-xl font-semibold mb-4">Decisions ({filteredDecisions.length})</h2>

                            {filteredDecisions.map(decision => (
                                <div
                                    key={decision.id}
                                    onClick={() => setSelectedDecision(decision)}
                                    className={`p-3 mb-2 rounded-lg cursor-pointer transition-colors ${selectedDecision?.id === decision.id
                                            ? 'bg-blue-900 border border-blue-500'
                                            : 'bg-slate-700 hover:bg-slate-600'
                                        } ${hasError(decision) ? 'border-l-4 border-l-red-500' : ''}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`font-bold ${getBotColor(decision.botType)}`}>
                                            {decision.botType}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-xs ${getActionColor(decision.action)}`}>
                                            {decision.action}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-400">
                                        {new Date(decision.createdAt).toLocaleString('fr-FR')}
                                    </div>
                                    <div className="text-sm text-gray-300 truncate">
                                        {decision.reason}
                                    </div>
                                    {hasError(decision) && (
                                        <div className="text-xs text-red-400 mt-1">⚠️ Error</div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Detail Panel */}
                        <div className="bg-slate-800 rounded-xl p-4 max-h-[80vh] overflow-y-auto">
                            <h2 className="text-xl font-semibold mb-4">Debug Details</h2>

                            {selectedDecision ? (
                                <div className="space-y-4">
                                    {/* Basic Info */}
                                    <div className="bg-slate-700 rounded-lg p-3">
                                        <h3 className="font-semibold text-blue-400 mb-2">Decision Info</h3>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>Bot: <span className={getBotColor(selectedDecision.botType)}>{selectedDecision.botType}</span></div>
                                            <div>Action: {selectedDecision.action}</div>
                                            <div>Quantity: {selectedDecision.quantity}</div>
                                            <div>Price: ${selectedDecision.price.toFixed(2)}</div>
                                            <div>Confidence: {((selectedDecision.confidence || 0) * 100).toFixed(0)}%</div>
                                        </div>
                                    </div>

                                    {/* Reason */}
                                    <div className="bg-slate-700 rounded-lg p-3">
                                        <h3 className="font-semibold text-green-400 mb-2">Reason</h3>
                                        <p className="text-sm whitespace-pre-wrap">{selectedDecision.reason}</p>
                                    </div>

                                    {/* Market Data */}
                                    <div className="bg-slate-700 rounded-lg p-3">
                                        <h3 className="font-semibold text-yellow-400 mb-2">Market Snapshot</h3>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>Price: ${selectedDecision.snapshot?.price?.toFixed(2)}</div>
                                            <div>RSI: {selectedDecision.snapshot?.rsi?.toFixed(2) || 'N/A'}</div>
                                            <div>MACD: {selectedDecision.snapshot?.macd?.toFixed(2) || 'N/A'}</div>
                                            <div>Sentiment: {selectedDecision.snapshot?.sentimentScore?.toFixed(2)}</div>
                                        </div>
                                    </div>

                                    {/* Debug Data */}
                                    {selectedDecision.debugData && (
                                        <div className="bg-slate-700 rounded-lg p-3">
                                            <h3 className="font-semibold text-purple-400 mb-2">🔧 Debug Data</h3>

                                            {selectedDecision.debugData.error && (
                                                <div className="bg-red-900/50 border border-red-500 rounded p-2 mb-2">
                                                    <span className="text-red-400 font-bold">Error:</span>
                                                    <p className="text-sm">{selectedDecision.debugData.error}</p>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                                                <div>Model: <span className="text-cyan-400">{selectedDecision.debugData.model}</span></div>
                                                <div>Finish: {selectedDecision.debugData.finishReason || 'N/A'}</div>
                                                <div>Prompt Tokens: {selectedDecision.debugData.promptTokens || 'N/A'}</div>
                                                <div>Completion Tokens: {selectedDecision.debugData.completionTokens || 'N/A'}</div>
                                                <div>Total Tokens: {selectedDecision.debugData.totalTokens || 'N/A'}</div>
                                                <div>Cost: ${selectedDecision.debugData.cost?.toFixed(6) || 'N/A'}</div>
                                            </div>

                                            {selectedDecision.debugData.rawResponse && (
                                                <div className="mt-2">
                                                    <h4 className="text-sm font-semibold text-gray-400 mb-1">Raw Response:</h4>
                                                    <pre className="bg-slate-900 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                                                        {selectedDecision.debugData.rawResponse}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Full JSON */}
                                    <div className="bg-slate-700 rounded-lg p-3">
                                        <h3 className="font-semibold text-gray-400 mb-2">📋 Full JSON</h3>
                                        <pre className="bg-slate-900 p-2 rounded text-xs overflow-x-auto max-h-60">
                                            {JSON.stringify(selectedDecision, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-gray-400 text-center py-10">
                                    Select a decision to view details
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
