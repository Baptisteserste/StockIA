import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-300 p-8 md:p-20">
            <div className="max-w-3xl mx-auto">
                <Link href="/" className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-400 mb-8 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Retour
                </Link>

                <h1 className="text-4xl font-bold text-white mb-8">Conditions d'Utilisation</h1>

                <section className="space-y-6">
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200">
                        <h2 className="font-bold mb-2">AVERTISSEMENT DE RISQUE</h2>
                        <p className="text-sm leading-relaxed">
                            Le trading comporte des risques importants de perte en capital. Les informations fournies par l'IA StockIA sont à titre indicatif et pédagogique uniquement.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-semibold text-white mb-3">1. Absence de Conseil Financier</h2>
                        <p>StockIA n'est pas un conseiller financier agréé. Toute décision d'investissement prise sur la base des scores de sentiment ou des bots de simulation est sous votre entière responsabilité.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-semibold text-white mb-3">2. Limitations de l'IA</h2>
                        <p>L'intelligence artificielle peut produire des "hallucinations" ou des analyses erronées basées sur des données incomplètes. Nous ne garantissons pas l'exactitude des résultats.</p>
                    </div>
                </section>
            </div>
        </div>
    );
}