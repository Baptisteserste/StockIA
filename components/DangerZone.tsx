'use client';

import { Trash2, ShieldAlert } from "lucide-react";

export default function DangerZone() {
    const handleDelete = async () => {
        const check = confirm(
            "🛑 ACTION IRRÉVERSIBLE\n\n" +
            "Cela supprimera votre historique, vos simulations et vos crédits.\n" +
            "Voulez-vous vraiment continuer ?"
        );

        if (check) {
            const res = await fetch('/api/user/delete-data', { method: 'DELETE' });
            if (res.ok) {
                alert("Données effacées. À bientôt !");
                window.location.href = "/";
            }
        }
    };

    return (
        <div className="mt-16 p-8 border border-red-900/20 bg-red-950/10 rounded-3xl">
            <div className="flex items-center gap-3 mb-6">
                <ShieldAlert className="w-6 h-6 text-red-500" />
                <h2 className="text-xl font-bold text-white">Confidentialité & RGPD</h2>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="max-w-2xl text-slate-400 text-sm leading-relaxed">
                    Vous disposez d'un droit d'accès et d'effacement de vos données personnelles.
                    En cliquant sur le bouton, vous déclenchez la suppression immédiate de l'intégralité de votre profil
                    et de vos activités stockées dans notre base de données.
                </div>
                <button
                    onClick={handleDelete}
                    className="px-6 py-3 bg-red-600/10 border border-red-600/30 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all text-sm font-bold cursor-pointer"
                >
                    Supprimer mon compte et mes données
                </button>
            </div>
        </div>
    );
}