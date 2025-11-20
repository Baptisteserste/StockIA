import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
    dir: './',
})

const config: Config = {
    coverageProvider: 'v8',
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',


        'crypto.mjs$': '<rootDir>/__mocks__/clerkCrypto.js',
    },
    transformIgnorePatterns: [
        'node_modules/(?!.*@clerk)'
    ],
}

export default createJestConfig(config)