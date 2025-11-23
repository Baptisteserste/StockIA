import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Wallet, Activity } from "lucide-react";

export default async function DashboardPage() {
    // 1. Sécuriser la page : Si pas connecté, on redirige
    const { userId } = await auth();
    const userClerk = await currentUser();

    if (!userId || !userClerk) {
        redirect("/sign-in");
    }

  // 2. Récupérer OU Créer l'utilisateur (UPSERT)
  const user = await prisma.user.upsert({
    where: { id: userId },
    // Si l'utilisateur existe déjà, on ne fait rien (update vide), on le récupère juste
    update: {},
    // Si l'utilisateur n'existe pas, on le crée
    create: {
      id: userId,
      email: userClerk.emailAddresses[0].emailAddress,
      credits: 10, // Bonus de bienvenue
    },
    include: {
      analyses: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
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

        {/* Cartes de Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Carte Crédits */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-lg">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Wallet className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-200">Crédits Restants</h3>
            </div>
            <p className="text-4xl font-bold text-white">{user.credits}</p>
            <p className="text-sm text-slate-500 mt-2">1 analyse = 1 crédit</p>
          </div>

          {/* Carte Analyses */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-lg">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Activity className="w-6 h-6 text-purple-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-200">Total Analysé</h3>
            </div>
            <p className="text-4xl font-bold text-white">{user.analyses.length}</p>
            <p className="text-sm text-slate-500 mt-2">Depuis l'inscription</p>
          </div>

          {/* Carte Action */}
          <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl shadow-lg flex flex-col justify-center items-center text-center">
            <h3 className="text-xl font-bold text-white mb-2">Nouvelle Analyse</h3>
            <p className="text-blue-100 text-sm mb-4">Analysez une nouvelle action maintenant</p>
            <Link 
              href="/"
              className="px-6 py-2 bg-white text-blue-700 font-bold rounded-lg hover:bg-blue-50 transition-colors w-full"
            >
              Lancer
            </Link>
          </div>
        </div>

        {/* Tableau Historique */}
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
                  <th className="p-4">Coût</th>
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
                      <td className="p-4 text-slate-500">{log.tokens} tokens</td>
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