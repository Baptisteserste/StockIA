import { render, screen } from '@testing-library/react'
import Home from '../app/page'
import { describe, it, expect, vi } from 'vitest' // <-- Import depuis Vitest

// Note : Clerk est déjà mocké globalement dans vitest.setup.ts

// On mock juste le Link spécifiquement ici si besoin
vi.mock('next/link', () => {
    return {
        __esModule: true,
        default: ({ children }: { children: React.ReactNode }) => <a>{children}</a>
    };
});

describe('Page d\'accueil', () => {
    it('affiche le titre principal', () => {
        render(<Home />)
        // On utilise une regex flexible pour trouver le texte même s'il est coupé par des spans
        const heading = screen.getByRole('heading', { level: 1 })
        expect(heading).toHaveTextContent(/StockIA/i)
    })

    it('affiche le champ de recherche', () => {
        render(<Home />)
        const input = screen.getByPlaceholderText(/Entrez un symbole/i)
        expect(input).toBeInTheDocument()
    })

    it('affiche le bouton analyser', () => {
        render(<Home />)
        const button = screen.getByRole('button', { name: /Analyser/i })
        expect(button).toBeInTheDocument()
    })
})