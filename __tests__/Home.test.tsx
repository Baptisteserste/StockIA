import { render, screen } from '@testing-library/react'
import Home from '../app/page'
import { describe, it, expect, vi } from 'vitest' // On importe depuis 'vitest'

// On remplace 'jest.mock' par 'vi.mock'
vi.mock('@clerk/nextjs', () => ({
    SignedIn: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SignedOut: ({ children }: { children: React.ReactNode }) => null,
    UserButton: () => <button>UserButton</button>,
    SignInButton: () => <button>SignInButton</button>,
}));

vi.mock('next/link', () => {
    return {
        __esModule: true,
        default: ({ children }: { children: React.ReactNode }) => <a>{children}</a>
    };
});

describe('Page d\'accueil', () => {
    it('affiche le titre principal', () => {
        render(<Home />)
        const heading = screen.getByRole('heading', { level: 1 })
        expect(heading).toHaveTextContent('StockIA')
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