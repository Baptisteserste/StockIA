import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mocks
vi.mock('@/lib/prisma', () => {
  const portfolios = [
    { id: 'p1', botType: 'CHEAP', cash: 10000, shares: 0, avgBuyPrice: null, totalValue: 10000, roi: 0 },
    { id: 'p2', botType: 'PREMIUM', cash: 10000, shares: 0, avgBuyPrice: null, totalValue: 10000, roi: 0 },
    { id: 'p3', botType: 'ALGO', cash: 10000, shares: 0, avgBuyPrice: null, totalValue: 10000, roi: 0 },
  ]
  const tx = {
    marketSnapshot: {
      findFirst: vi.fn().mockResolvedValue({ id: 'snap1' })
    },
    botDecision: {
      create: vi.fn().mockResolvedValue({ id: 'd1' })
    },
    portfolio: {
      update: vi.fn().mockResolvedValue({})
    }
  }

  return {
    default: {
      marketSnapshot: {
        findFirst: vi.fn().mockResolvedValue(null)
      },
      simulationConfig: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'sim1',
          symbol: 'AAPL',
          useReddit: false,
          cheapModelId: 'cheap',
          premiumModelId: 'premium',
          startCapital: 10000,
          currentDay: 0,
          status: 'RUNNING',
          portfolios,
        }),
        update: vi.fn().mockResolvedValue({})
      },
      $transaction: vi.fn(async (fn: any) => fn(tx))
    }
  }
})

vi.mock('@/lib/simulation/data-aggregator', () => ({
  createMarketSnapshot: vi.fn().mockResolvedValue({
    simulationId: 'sim1',
    symbol: 'AAPL',
    price: 100,
    timestamp: new Date(),
    sentimentScore: 0.1,
    sentimentReason: 'Test sentiment',
    rsi: 50,
    macd: 0.5,
    redditHype: null
  })
}))

vi.mock('@/lib/simulation/agents/cheap-agent', () => ({
  decide: vi.fn().mockResolvedValue({ action: 'BUY', quantity: 1, reason: 'test', confidence: 0.9 })
}))

vi.mock('@/lib/simulation/agents/premium-agent', () => ({
  decide: vi.fn().mockResolvedValue({ action: 'BUY', quantity: 1, reason: 'test', confidence: 0.95 })
}))

vi.mock('@/lib/simulation/agents/algo-agent', () => ({
  decide: vi.fn().mockReturnValue({ action: 'BUY', quantity: 1, reason: 'test', confidence: 0.8 })
}))

// Mock global fetch for Finnhub quote validation
const fetchMock = vi.fn()
global.fetch = fetchMock as any

// Import after mocks
import { GET } from '@/app/api/cron/simulation-tick/route'

beforeEach(() => {
  fetchMock.mockReset()
  process.env.CRON_SECRET = 'testsecret'
  process.env.FINNHUB_API_KEY = 'x'
  
  // Mock Date to always be a weekday (Wednesday)
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2025-11-26T14:00:00Z')) // Wednesday
})

afterEach(() => {
  vi.useRealTimers()
})

describe('API /api/cron/simulation-tick', () => {
  it('refuse sans Bearer correct (401)', async () => {
    const req = new NextRequest('http://localhost/api/cron/simulation-tick')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('retourne success: true avec Bearer correct', async () => {
    // Mock finnhub quote response
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ c: 150 }) })

    const req = new NextRequest('http://localhost/api/cron/simulation-tick', {
      headers: new Headers({ authorization: 'Bearer testsecret' })
    })

    const res = await GET(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(['RUNNING', 'COMPLETED']).toContain(json.status)
    expect(Array.isArray(json.decisions)).toBe(true)
  })

  it('accepte aussi la clé via query param (?key=)', async () => {
    // Mock finnhub quote response
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ c: 150 }) })

    const req = new NextRequest('http://localhost/api/cron/simulation-tick?key=testsecret')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('skip le weekend', async () => {
    // Set to Sunday
    vi.setSystemTime(new Date('2025-11-30T14:00:00Z')) // Sunday
    
    const req = new NextRequest('http://localhost/api/cron/simulation-tick', {
      headers: new Headers({ authorization: 'Bearer testsecret' })
    })
    const res = await GET(req)
    const json = await res.json()
    expect(json.skipped).toBe(true)
    expect(json.reason).toBe('weekend')
  })
})
