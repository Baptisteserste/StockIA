import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
    // Chemin vers votre app Next.js pour charger next.config.js et .env
    dir: './',
})

// Add any custom config to be passed to Jest
const config: Config = {
    coverageProvider: 'v8',
    testEnvironment: 'jsdom',
    // Ajoute des matchers comme .toBeInTheDocument()
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleNameMapper: {
        // Gérer les alias de chemin (@/...)
        '^@/(.*)$': '<rootDir>/$1',
    }
}

export default createJestConfig(config)