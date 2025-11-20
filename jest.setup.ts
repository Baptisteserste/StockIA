import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

global.TextEncoder = TextEncoder
// @ts-expect-error - Nécessaire car les signatures TS ne matchent pas exactement pour JSDOM
global.TextDecoder = TextDecoder

// Mock complet de Crypto pour Clerk
if (typeof global.crypto === 'undefined') {
    Object.defineProperty(global, 'crypto', {
        value: {
            subtle: {
                // .buffer est important ici pour satisfaire TypeScript (ArrayBuffer)
                digest: () => Promise.resolve(new Uint8Array(32).buffer),
            },
            getRandomValues: (arr: Uint8Array) => {
                // Simulation simple de nombres aléatoires
                for (let i = 0; i < arr.length; i++) {
                    arr[i] = Math.floor(Math.random() * 256);
                }
                return arr;
            }
        }
    });
}