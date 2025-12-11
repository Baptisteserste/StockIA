import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import Home from '../app/page'; // Adaptez le chemin si nécessaire
import { ClerkProvider } from '@clerk/nextjs';

// Mock partiel de @clerk/nextjs avec importOriginal
vi.mock('@clerk/nextjs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@clerk/nextjs')>();
    return {
        ...actual,
        SignedIn: ({ children }: { children: React.ReactNode }) => <div data-testid="signed-in">{children}</div>, // Rend le contenu pour simuler connecté
        SignedOut: ({ children }: { children: React.ReactNode }) => null, // Masque pour simuler connecté
        SignInButton: ({ children }: { children: React.ReactNode }) => <button>{children}</button>, // Mock basique pour éviter l'erreur
        useAuth: () => ({ userId: 'mock-user-id' }), // Simule un utilisateur connecté
        ClerkProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    };
});

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