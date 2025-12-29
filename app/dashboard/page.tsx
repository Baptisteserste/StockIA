import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import DangerZone from "@/components/DangerZone";
import {
    ArrowRight,
    TrendingUp,
    Wallet,
    Activity,
    Cpu,
    CircleDollarSign,
    PlayCircle,
    BarChart3,
    Calendar
} from "lucide-react";

/**
 * Logique de calcul consolidée (Analyses + Simulations)
 */
function calculateTotalResources(user: any) {
    const analysisTokens = user.analyses.reduce((acc: number, log: any) => acc + log.tokens, 0);
    const analysisCost = user.analyses.reduce((acc: number, log: any) => acc + log.cost, 0);

    let simulationTokens = 0;
    let simulationCost = 0;

    user.simulations.forEach((sim: any) => {
        sim.snapshots.forEach((snap: any) => {
            snap.decisions.forEach((dec: any) => {
                simulationTokens += dec.tokens || 0;
                simulationCost += dec.cost || 0;
            });
        });
    });

    return {
        totalTokens: analysisTokens + simulationTokens,
        totalCost: analysisCost + simulationCost
    };
}

export default async function DashboardPage() {
    // 1. Vérification Auth
    const { userId } = await auth();
    const userClerk = await currentUser();

    if (!userId || !userClerk) {
        redirect("/sign-in");
    }

    // 2. Récupération des données consolidées
    const user = await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
            id: userId,
            email: userClerk.emailAddresses[0].emailAddress,
            credits: 10,
        },
        include: {
            analyses: { orderBy: { createdAt: 'desc' } },
            simulations: {
                include: {
                    snapshots: {
                        include: { decisions: true }
                    }
                }
            }
        }
    });

    const { totalTokens, totalCost } = calculateTotalResources(user);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Tableau de Bord</h1>
                        <p className="text-slate-400 flex items-center gap-2 mt-1">
                            <Calendar className="w-4 h-4" />
                            Session de {user.email}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <span className="text-sm text-slate-400">Solde :</span>
                            <span className="ml-2 font-bold text-blue-400">{user.credits} crédits</span>
                        </div>
                    </div>
                </div>

                {/* Stat Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    <StatCard
                        title="Crédits"
                        value={user.credits}
                        sub="Analyses disponibles"
                        icon={<Wallet className="text-blue-500" />}
                    />
                    <StatCard
                        title="Analyses"
                        value={user.analyses.length}
                        sub="Total historique"
                        icon={<Activity className="text-purple-500" />}
                    />
                    <StatCard
                        title="Tokens IA"
                        value={totalTokens.toLocaleString()}
                        sub="Consommation totale"
                        icon={<Cpu className="text-indigo-500" />}
                    />
                    <StatCard
                        title="Coût Est."
                        value={`$${totalCost.toFixed(4)}`}
                        sub="Usage API réel"
                        icon={<CircleDollarSign className="text-green-500" />}
                    />
                </div>

                {/* Quick Actions */}
                <div className="mb-12">
                    <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                        <PlayCircle className="w-5 h-5 text-slate-400" />
                        Actions Rapides
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ActionLink
                            href="/"
                            title="Nouvelle Analyse"
                            desc="Scanner le sentiment d'une action en temps réel"
                            icon={<ArrowRight />}
                            color="blue"
                        />
                        <ActionLink
                            href="/simulation"
                            title="Simulation Trading"
                            desc="Gérer vos bots et voir les performances IA"
                            icon={<BarChart3 />}
                            color="purple"
                        />
                    </div>
                </div>

                {/* Historique Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-12">
                    <div className="p-6 border-b border-slate-800">
                        <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
                            <TrendingUp className="w-5 h-5 text-slate-400" />
                            Dernières Analyses
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-950 text-slate-400 uppercase font-medium">
                            <tr>
                                <th className="p-4">Date</th>
                                <th className="p-4">Symbole</th>
                                <th className="p-4">Sentiment</th>
                                <th className="p-4 text-right">Tokens / Coût</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                            {user.analyses.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-slate-500 italic">
                                        Aucune analyse enregistrée pour le moment.
                                    </td>
                                </tr>
                            ) : (
                                user.analyses.slice(0, 10).map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-800/50 transition-colors group">
                                        <td className="p-4 text-slate-400 text-xs">
                                            {new Date(log.createdAt).toLocaleDateString('fr-FR', {
                                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="p-4 font-bold text-white">{log.symbol}</td>
                                        <td className="p-4">
                                            <SentimentBadge sentiment={log.sentiment} />
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex flex-col">
                                                <span className="text-slate-300 font-mono">{log.tokens} tk</span>
                                                <span className="text-[10px] text-slate-500">${log.cost.toFixed(5)}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Compliance Section */}
                <DangerZone />

            </div>
        </div>
    );
}

// ============== COMPOSANTS AUXILIAIRES ==============

function StatCard({ title, value, sub, icon }: { title: string, value: string | number, sub: string, icon: React.ReactNode }) {
    return (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-sm hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">{icon}</div>
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">{title}</h3>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{value}</p>
            <p className="text-xs text-slate-500">{sub}</p>
        </div>
    );
}

function ActionLink({ href, title, desc, icon, color }: { href: string, title: string, desc: string, icon: React.ReactNode, color: 'blue' | 'purple' }) {
    const colorClasses = color === 'blue' ? 'hover:border-blue-500 group-hover:text-blue-400' : 'hover:border-purple-500 group-hover:text-purple-400';
    return (
        <Link href={href} className={`group p-6 bg-slate-900 border border-slate-800 rounded-xl transition-all ${colorClasses} flex items-center justify-between`}>
            <div>
                <h3 className="text-lg font-bold text-white mb-1 transition-colors group-hover:text-inherit">{title}</h3>
                <p className="text-slate-400 text-sm">{desc}</p>
            </div>
            <div className="p-2 text-slate-500 transition-colors group-hover:text-inherit">{icon}</div>
        </Link>
    );
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
    const isPos = sentiment.toLowerCase() === 'positif';
    const isNeg = sentiment.toLowerCase() === 'négatif';
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            isPos ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                isNeg ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                    'bg-slate-500/10 text-slate-400 border border-slate-500/20'
        }`}>
            {sentiment}
        </span>
    );
}