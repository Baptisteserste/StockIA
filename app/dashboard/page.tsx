import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, ArrowRight, TrendingUp, Wallet, Activity, Cpu, CircleDollarSign, PlayCircle, BarChart3 } from "lucide-react";

export default async function DashboardPage() {
    // 1. Sécuriser la page : Si pas connecté, on redirige
    const { userId } = await auth();
    const userClerk = await currentUser();

    if (!userId || !userClerk) {
        redirect("/sign-in");
    }

        const user = await prisma.user.upsert({
            where: { id: userId },
            update: {},
            create: {
                id: userId,
                email: userClerk.emailAddresses[0].emailAddress,
                credits: 10,
            },
            include: {
                analyses: {
                    orderBy: { createdAt: 'desc' }
                },
                // AJOUT : On récupère les simulations pour inclure leurs coûts
                simulations: {
                    include: {
                        snapshots: {
                            include: {
                                decisions: true
                            }
                        }
                    }
                }
            }
        });

        // 3. Calcul des totaux de ressources consolidés
        const analysisTokens = user.analyses.reduce((acc, log) => acc + log.tokens, 0);
        const analysisCost = user.analyses.reduce((acc, log) => acc + log.cost, 0);

        // Calculer le coût généré par les bots dans les simulations
        let simulationTokens = 0;
        let simulationCost = 0;

        user.simulations.forEach(sim => {
            sim.snapshots.forEach(snap => {
                snap.decisions.forEach(dec => {
                    simulationTokens += (dec as any).tokens || 0;
                    simulationCost += (dec as any).cost || 0;
                });
            });
        });

        const totalTokens = analysisTokens + simulationTokens;
        const totalCost = analysisCost + simulationCost;

        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
            <div className="max-w-6xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Tableau de Bord</h1>
                        <p className="text-slate-400">Bienvenue, {user.email}</p>
                    </div>
                    <Link
                        href="/"
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Retour à l'accueil
                    </Link>
                </div>

                {/* SECTION 1 : Statistiques & Ressources */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    {/* Carte Crédits */}
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-lg flex flex-col justify-between">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-blue-500/10 rounded-lg">
                                <Wallet className="w-6 h-6 text-blue-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-200">Crédits</h3>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-white">{user.credits}</p>
                            <p className="text-xs text-slate-500 mt-1">Solde disponible</p>
                        </div>
                    </div>

                    {/* Carte Analyses */}
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-lg flex flex-col justify-between">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-purple-500/10 rounded-lg">
                                <Activity className="w-6 h-6 text-purple-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-200">Analyses</h3>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-white">{user.analyses.length}</p>
                            <p className="text-xs text-slate-500 mt-1">Total historique</p>
                        </div>
                    </div>

                    {/* Carte Tokens (IA) */}
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-lg flex flex-col justify-between">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-indigo-500/10 rounded-lg">
                                <Cpu className="w-6 h-6 text-indigo-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-200">Tokens IA</h3>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-white">{totalTokens.toLocaleString()}</p>
                            <p className="text-xs text-slate-500 mt-1">Consommation LLM</p>
                        </div>
                    </div>

                    {/* Carte Coût (USD) */}
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-lg flex flex-col justify-between">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-green-500/10 rounded-lg">
                                <CircleDollarSign className="w-6 h-6 text-green-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-200">Coût Est.</h3>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-white">${totalCost.toFixed(5)}</p>
                            <p className="text-xs text-slate-500 mt-1">Usage API estimé</p>
                        </div>
                    </div>
                </div>

                {/* SECTION 2 : Navigation & Actions */}
                <div className="mb-10">
                    <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        <PlayCircle className="w-5 h-5 text-slate-400" />
                        Actions Rapides
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Lien vers Analyse (Anciennement "Carte Action") */}
                        <Link href="/" className="group p-6 bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl transition-all flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">Nouvelle Analyse Rapide</h3>
                                <p className="text-slate-400 text-sm">Scanner le sentiment d'une action via Finnhub</p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                        </Link>

                        {/* Lien vers Simulation (NOUVEAU) */}
                        <Link href="/simulation" className="group p-6 bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 hover:border-purple-500 rounded-xl transition-all flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white mb-1 group-hover:text-purple-400 transition-colors">Simulation de Trading</h3>
                                <p className="text-slate-400 text-sm">Gérer les bots, le temps et voir les performances</p>
                            </div>
                            <BarChart3 className="w-5 h-5 text-slate-500 group-hover:text-purple-400 transition-colors" />
                        </Link>
                    </div>
                </div>

                {/* SECTION 3 : Historique */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-slate-800">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-slate-400" />
                            Historique des analyses
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-950 text-slate-400 uppercase font-medium">
                            <tr>
                                <th className="p-4">Date</th>
                                <th className="p-4">Symbole</th>
                                <th className="p-4">Résultat</th>
                                <th className="p-4">Tokens / Coût</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                            {user.analyses.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-500">
                                        Aucune analyse pour le moment.
                                    </td>
                                </tr>
                            ) : (
                                user.analyses.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4 text-slate-300">
                                            {new Date(log.createdAt).toLocaleDateString('fr-FR', {
                                                day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="p-4 font-bold text-white">{log.symbol}</td>
                                        <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            log.sentiment === 'positif' ? 'bg-green-500/20 text-green-400' :
                                log.sentiment === 'négatif' ? 'bg-red-500/20 text-red-400' :
                                    'bg-gray-500/20 text-gray-400'
                        }`}>
                          {log.sentiment.toUpperCase()}
                        </span>
                                        </td>
                                        <td className="p-4 text-slate-500">
                                            <div className="flex flex-col">
                                                <span>{log.tokens} tkns</span>
                                                <span className="text-xs opacity-50">${log.cost.toFixed(5)}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}