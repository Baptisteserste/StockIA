import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import Home from '../app/page'

// Si votre éditeur ne trouve toujours pas describe/it, ces lignes forcent la détection
import { describe, it, expect, jest } from '@jest/globals'

// 1. On simule (Mock) Clerk avec des fonctions nommées pour satisfaire ESLint
jest.mock('@clerk/nextjs', () => ({
    SignedIn: function SignedInMock({ children }: { children: React.ReactNode }) {
        return <div>{children}</div>
    },
    SignedOut: function SignedOutMock({ children }: { children: React.ReactNode }) {
        return <div>{children}</div>
    },
    UserButton: function UserButtonMock() {
        return <button>Profil User</button>
    },
    SignInButton: function SignInButtonMock() {
        return <button>Bouton Connexion</button>
    },
}));

// 2. On simule les composants de navigation Next.js
jest.mock('next/link', () => {
    return function LinkMock({ children }: { children: React.ReactNode }) {
        return <a>{children}</a>;
    };
});

describe('Page d\'accueil', () => {
    it('affiche le titre principal', () => {
        render(<Home />)

        // Vérifie la présence du texte "StockIA"
        const heading = screen.getByRole('heading', { level: 1 })
        expect(heading).toHaveTextContent('StockIA')
    })

    it('affiche le champ de recherche', () => {
        render(<Home />)

        // Vérifie qu'il y a bien un input
        const input = screen.getByPlaceholderText(/Entrez un symbole/i)
        expect(input).toBeInTheDocument()
    })

    it('affiche le bouton analyser', () => {
        render(<Home />)

        // Vérifie le bouton d'action
        const button = screen.getByRole('button', { name: /Analyser/i })
        expect(button).toBeInTheDocument()
    })
})