import type { Metadata } from "next";
import { ClerkProvider, SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StockIA - Analyse de Sentiment Financier",
  description: "Analysez le sentiment des actualités financières avec l'IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="fr">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-100`}
        >
          <div className="flex flex-col min-h-screen">
            {/* --- HEADER GLOBAL (Ta structure exacte) --- */}
            <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
              <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        
                {/* Logo */}
                <Link href="/" className="text-xl font-bold text-white hover:text-blue-400 transition-colors">
                  Stock<span className="text-blue-500">IA</span>
                </Link>

                {/* Navigation Droite */}
                <div className="flex items-center gap-4">
              
                  <Link 
                    href="/"
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors text-sm font-semibold"
                  >
                    Analyse Rapide
                  </Link>

                  <Link 
                    href="/simulation"
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors text-sm font-semibold"
                  >
                    Simulation de Trading
                  </Link>

                  <SignedIn>
                    <Link 
                      href="/dashboard" 
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-all"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span className="hidden sm:inline">Dashboard</span>
                    </Link>
            
                    <div className="h-8 w-8 flex items-center justify-center">
                      <UserButton afterSignOutUrl="/" />
                    </div>
                  </SignedIn>

                  <SignedOut>
                    <SignInButton mode="modal">
                      <button className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                        Connexion
                      </button>
                    </SignInButton>
                  </SignedOut>
                </div>
              </div>
            </header>

            {/* CONTENU PRINCIPAL */}
            <main className="flex-grow">
              {children}
            </main>

            {/* --- FOOTER GLOBAL (Conformité) --- */}
            <footer className="border-t border-slate-800 bg-slate-950 py-10">
              <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-sm text-slate-500">
                  <div>
                    <h4 className="text-white font-bold mb-4">StockIA</h4>
                    <p className="leading-relaxed">
                      Plateforme expérimentale d'analyse financière assistée par intelligence artificielle.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-white font-bold mb-4">Légal & Conformité</h4>
                    <ul className="space-y-3">
                      <li><Link href="/terms" className="hover:text-blue-400 transition-colors">Conditions d'Utilisation</Link></li>
                      <li><Link href="/privacy" className="hover:text-blue-400 transition-colors">Politique de Confidentialité (RGPD)</Link></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-white font-bold mb-4">Avertissement</h4>
                    <p className="leading-relaxed italic">
                      Les analyses et simulations ne constituent pas des conseils en investissement. 
                      L'IA peut générer des erreurs. Restez maître de vos décisions financières.
                    </p>
                  </div>
                </div>
                <div className="mt-10 pt-8 border-t border-slate-900 text-center text-xs text-slate-600">
                  © 2025 StockIA — Projet conforme aux principes de transparence de l'AI Act européen.
                </div>
              </div>
            </footer>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}