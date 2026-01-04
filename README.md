# AI-Driven Stock Trend Analyzer (MVP)

> **Projet Académique - Développement SGBD & IA (2025)**
> Une application Next.js exploitant l'Intelligence Artificielle pour analyser le sentiment de marché et simuler des stratégies de trading.

![Status](https://img.shields.io/badge/Status-Beta-blue)
![Tech](https://img.shields.io/badge/Stack-Next.js_14-black)
![AI](https://img.shields.io/badge/AI-OpenRouter-purple)

## À propos

Ce projet est un **Minimum Viable Product (MVP)** démontrant l'intégration de modèles de langage (LLMs) dans une architecture web moderne. L'objectif est de fournir une analyse financière simplifiée en temps réel et de simuler des compétitions de trading entre différents agents IA.

## Parcours Utilisateur & Fonctionnalités

Le flux de l'application est structuré en quatre grandes étapes clés :

### 1. Inscription & Onboarding
* **Auth Unifiée :** Connexion sécurisée via Clerk (Google/Email).
* **Système de Crédits :** Initialisation automatique d'un solde de bienvenue de **10 crédits** pour tester l'application immédiatement.

### 2. Phase d'Analyse (Scan)
* **Scan de marché :** L'utilisateur interroge un ticker (ex: `TSLA`).
* **Traitement IA :** Le backend récupère les actualités, les injecte dans le modèle IA, et retourne un **score de sentiment** avec justification.
* **Coût :** Débit automatique de 1 crédit par analyse.

### 3. Phase de Simulation (L'Arène)
* **Configuration :** Définition du capital virtuel, de la durée et du poids de l'algorithme.
* **Agents Autonomes :** Lancement de portefeuilles concurrents (Cheap vs Premium) qui exécutent des transactions basées sur leur propre logique.

### 4. Supervision (Dashboard)
* **Tour de Contrôle :** Vue synthétique des performances et ROI global.
* **Logs Transparents :** Accès au détail de chaque décision pour comprendre la logique d'achat/vente de l'IA.
* **Monitoring :** Suivi de la consommation de tokens.

---

## Modèle Économique (Projection)

Bien que l'accès soit actuellement libre pour la phase de test (Bêta), l'architecture est conçue pour la rentabilité.

**Calcul de la Marge (Rentabilité)**
La rentabilité du modèle économique visé sera assurée par le contrôle strict des coûts unitaires, **tel qu'actuellement modélisé dans le fichier `ai-costs.ts`** :

* **Coûts unitaires :** Le coût moyen par 1000 tokens est fixé et monitoré par le système (ex: 0.0002$).
* **Analyse de marge :** Les données techniques confirment qu'un **futur abonnement** à 14.99€ **couvrirait** largement la consommation moyenne d'un utilisateur, même avec l'usage des agents Premium, tant que l'usage reste dans les limites du "Fair Use" technique imposé par les quotas API.

---

## Commandes de Développement & Debug

Cette section détaille les outils internes pour tester les agents IA sans passer par l'interface utilisateur.

### Scripts Personnalisés
```bash
npm run dev               # Lancer le serveur de développement
npm run export:debug      # Export dernier tick en JSON
npm run export:debug 3    # Export les 3 derniers ticks
npm run test:premium      # Test agent Premium isolé
npm run test:cheap        # Test agent Cheap isolé
npm run reset:sim         # Reset simulation active
