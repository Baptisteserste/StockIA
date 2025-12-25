import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-300 p-8 md:p-20">
            <div className="max-w-3xl mx-auto">
                <Link href="/" className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-400 mb-8 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Retour
                </Link>

                <h1 className="text-4xl font-bold text-white mb-8">Politique de Confidentialité</h1>

                <section className="space-y-6">
                    <div>
                        <h2 className="text-xl font-semibold text-white mb-3">1. Collecte des données</h2>
                        <p>Nous collectons votre adresse e-mail via Clerk pour la création de votre compte et le suivi de vos crédits. Vos historiques d'analyses et de simulations sont conservés pour vous permettre de consulter vos performances passées.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-semibold text-white mb-3">2. Utilisation de l'IA (AI Act)</h2>
                        <p>StockIA utilise des modèles de langage (LLM) tiers via OpenRouter. Aucune donnée personnelle identifiable n'est envoyée aux modèles d'IA, seuls les symboles boursiers et les actualités publiques sont analysés.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-semibold text-white mb-3">3. Vos Droits (RGPD)</h2>
                        <p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Vous pouvez exercer ces droits en nous contactant ou via votre tableau de bord.</p>
                    </div>

                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-sm italic">Note : Ce projet est une démonstration technique. Vos données ne sont jamais revendues à des tiers.</p>
                    </div>
                </section>
            </div>
        </div>
    );
}