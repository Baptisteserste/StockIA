'use client';

import { Trash2 } from "lucide-react";

export default function DangerZone() {
    const handleDelete = async () => {
        if (confirm("Êtes-vous sûr de vouloir supprimer définitivement toutes vos données ? Cette action est irréversible.")) {
            const res = await fetch('/api/user/delete-data', { method: 'DELETE' });
            if (res.ok) {
                alert("Données supprimées. Vous allez être redirigé.");
                window.location.href = "/";
            } else {
                alert("Une erreur est survenue lors de la suppression.");
            }
        }
    };

    return (
        <div className="mt-16 p-6 border border-red-900/30 bg-red-950/10 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
                <Trash2 className="w-5 h-5 text-red-500" />
                <h2 className="text-xl font-semibold text-white">Zone de Danger</h2>
            </div>
            <p className="text-slate-400 text-sm mb-6">
                Conformément au RGPD, vous pouvez supprimer définitivement toutes vos données collectées sur StockIA (historiques d'analyses, simulations et solde de crédits). Cette action est irréversible.
            </p>
            <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/50 rounded-lg transition-all text-sm font-semibold cursor-pointer"
            >
                Supprimer mon compte et mes données
            </button>
        </div>
    );
}