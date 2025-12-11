import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import Home from '../app/page'; // Adaptez le chemin si nécessaire
import { ClerkProvider } from '@clerk/nextjs';

// Mock des hooks Clerk pour les tests (simule un état non connecté par défaut)
vi.mock('@clerk/nextjs', () => ({
    SignedIn: ({ children }: { children: React.ReactNode }) => <div data-testid="signed-in">{children}</div>,
    SignedOut: ({ children }: { children: React.ReactNode }) => <div data-testid="signed-out">{children}</div>,
    useAuth: () => ({ userId: null }), // Simule non connecté
    ClerkProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('Page d\'accueil', () => {
    it('affiche les exemples d\'actions', () => {
        render(
            <ClerkProvider>
                <Home />
            </ClerkProvider>
        );
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('TSLA')).toBeInTheDocument();
        expect(screen.getByText('MSFT')).toBeInTheDocument();
        expect(screen.getByText('NVDA')).toBeInTheDocument();
    });

    it('affiche le champ de recherche', () => {
        render(
            <ClerkProvider>
                <Home />
            </ClerkProvider>
        );
        expect(screen.getByPlaceholderText('Entrez un symbole d\'action (ex: AAPL, TSLA, MSFT)')).toBeInTheDocument();
    });

    it('affiche le bouton analyser', () => {
        render(
            <ClerkProvider>
                <Home />
            </ClerkProvider>
        );
        expect(screen.getByRole('button', { name: /Analyser/ })).toBeInTheDocument();
    });
});