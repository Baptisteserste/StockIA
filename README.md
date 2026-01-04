# StockIA

Plateforme d'analyse financiere assistee par IA avec simulation de trading.

**Production** : https://nextjs-navy-ten-24.vercel.app/

## Stack technique

- Next.js 16 (App Router)
- React 19
- Prisma + PostgreSQL (Neon)
- Clerk (authentification)
- OpenRouter (agents IA)
- Google AI Studio (sentiment)

## Installation

```bash
git clone https://github.com/Baptisteserste/StockIA.git
cd StockIA
npm install
```

## Configuration

Creer un fichier `.env` a la racine avec :

```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
OPENROUTER_API_KEY=sk-or-...
GEMINI_API_KEY=AI...
FINNHUB_API_KEY=...
CRON_SECRET=...
```

## Lancement

```bash
npm run dev
```

Ouvrir http://localhost:3000

## Scripts utiles

```bash
npm run dev          # Serveur de dev
npm run build        # Build production
npm run test         # Tests unitaires
npm run reset:sim    # Reset simulation active
npm run export:debug # Export debug en JSON
```

## Structure du projet

```
app/
  page.tsx              # Analyse de sentiment
  dashboard/            # Tableau de bord utilisateur
  simulation-v2/        # Interface simulation
  pricing/              # Offres tarifaires
  privacy/              # Politique de confidentialite
  terms/                # Conditions d'utilisation
  api/
    simulation/         # Routes API simulation
    cron/               # Endpoint CRON
    analyze-stock/      # Analyse sentiment

lib/
  simulation/
    agents/             # CHEAP, PREMIUM, ALGO
    data-aggregator.ts  # Collecte donnees marche

prisma/
  schema.prisma         # Schema base de donnees
```

## Deploiement

L'application est deployee automatiquement sur Vercel a chaque push sur `main`.

Les simulations sont executees 5 fois par jour via GitHub Actions (lundi-vendredi).
