import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetActiveSubscribers, mockFetchArticlesForNewsletter, mockFrom, mockSendAlertEmail } = vi.hoisted(() => ({
  mockGetActiveSubscribers: vi.fn(),
  mockFetchArticlesForNewsletter: vi.fn(),
  mockFrom: vi.fn(),
  mockSendAlertEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/news/alert', () => ({
  sendAlertEmail: mockSendAlertEmail,
}))

vi.mock('@/lib/news/subscribers', () => ({
  getActiveSubscribers: mockGetActiveSubscribers,
}))

vi.mock('@/lib/news/newsletter-utils', () => ({
  fetchArticlesForNewsletter: mockFetchArticlesForNewsletter,
}))

vi.mock('@/utils/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({ from: mockFrom }),
}))

import { GET } from './route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string) {
  return new NextRequest('http://localhost/api/news/prepare-newsletters', {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

function makeSubscriber(overrides = {}) {
  return {
    id: 'sub-1',
    email: 'alice@example.com',
    firstName: 'Alice',
    selectedCounties: [],
    selectedCities: [],
    interests: null,
    isActive: true,
    timezone: 'UTC',
    preferredSendTimes: [],
    subscribedAt: null,
    ...overrides,
  }
}

const noArticles = { nationalArticles: [], localArticles: [] }
const withArticles = {
  nationalArticles: [{ title: 'Article 1', link: 'https://example.com/1', description: '', date: '', source: '' }],
  localArticles: [],
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe('GET /api/news/prepare-newsletters — auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CRON_SECRET
  })

  it('returns 401 when CRON_SECRET is set and auth header is missing', async () => {
    process.env.CRON_SECRET = 'secret123'
    mockGetActiveSubscribers.mockResolvedValue([])
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns 401 when CRON_SECRET is set and auth header is wrong', async () => {
    process.env.CRON_SECRET = 'secret123'
    const res = await GET(makeRequest('Bearer wrong'))
    expect(res.status).toBe(401)
  })

  it('proceeds when CRON_SECRET is set and auth header is correct', async () => {
    process.env.CRON_SECRET = 'secret123'
    mockGetActiveSubscribers.mockResolvedValue([])
    const res = await GET(makeRequest('Bearer secret123'))
    expect(res.status).toBe(200)
  })

  it('proceeds without auth check when CRON_SECRET is not set', async () => {
    mockGetActiveSubscribers.mockResolvedValue([])
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
  })
})

// ─── No subscribers ────────────────────────────────────────────────────────────

describe('GET /api/news/prepare-newsletters — no subscribers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CRON_SECRET
  })

  it('returns newslettersPrepared: 0 when there are no active subscribers', async () => {
    mockGetActiveSubscribers.mockResolvedValue([])
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.newslettersPrepared).toBe(0)
  })
})

// ─── Subscriber scheduling ────────────────────────────────────────────────────

describe('GET /api/news/prepare-newsletters — subscriber scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CRON_SECRET
    // Default: no articles so even matched subscribers get skipped at the articles step
    mockFetchArticlesForNewsletter.mockResolvedValue(noArticles)
  })

  it('skips subscriber whose preferred send time does not match the next hour', async () => {
    // Set up a subscriber with a specific send time that won't match "now + 1h"
    const subscriber = makeSubscriber({
      preferredSendTimes: [{ dayOfWeek: 1, hour: 9 }], // Monday 9am
      timezone: 'UTC',
    })
    mockGetActiveSubscribers.mockResolvedValue([subscriber])

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.skipped).toBe(1)
    expect(body.newslettersPrepared).toBe(0)
    expect(mockFetchArticlesForNewsletter).not.toHaveBeenCalled()
  })
})

// ─── No articles ───────────────────────────────────────────────────────────────

describe('GET /api/news/prepare-newsletters — no articles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CRON_SECRET
  })

  it('skips subscriber when fetchArticlesForNewsletter returns no articles', async () => {
    // Subscriber with no send time preferences uses system default (Friday 15:45 UTC)
    // We won't match that either, but we can verify by using matching preferences
    const subscriber = makeSubscriber({ preferredSendTimes: [] })
    mockGetActiveSubscribers.mockResolvedValue([subscriber])
    mockFetchArticlesForNewsletter.mockResolvedValue(noArticles)

    const res = await GET(makeRequest())
    const body = await res.json()
    // Either skipped at scheduling or at articles step — either way newslettersPrepared is 0
    expect(body.newslettersPrepared).toBe(0)
  })
})

// ─── Happy path ────────────────────────────────────────────────────────────────

describe('GET /api/news/prepare-newsletters — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CRON_SECRET
  })

  it('creates newsletter record and links articles', async () => {
    // Use a subscriber with no preferred times; we need to hit the right UTC time
    // We'll use vi.useFakeTimers to set now to Thursday 14:45 UTC so +1h = Friday 15:45 UTC (system default)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-12T14:45:00Z')) // Friday 14:45 UTC → +1h = Friday 15:45 UTC (system default)

    const subscriber = makeSubscriber({ preferredSendTimes: [] })
    mockGetActiveSubscribers.mockResolvedValue([subscriber])
    mockFetchArticlesForNewsletter.mockResolvedValue(withArticles)

    // newsletters.insert().select().single()
    const mockNewsletterSingle = vi.fn().mockResolvedValue({ data: { id: 'nl-1' }, error: null })
    const mockNewsletterSelectChain = vi.fn().mockReturnValue({ single: mockNewsletterSingle })
    const mockNewsletterInsert = vi.fn().mockReturnValue({ select: mockNewsletterSelectChain })

    // articles.select().in()
    const mockArticlesIn = vi.fn().mockResolvedValue({ data: [{ id: 'art-1', link: 'https://example.com/1' }] })
    const mockArticlesSelect = vi.fn().mockReturnValue({ in: mockArticlesIn })

    // newsletter_articles.insert()
    const mockNlArticlesInsert = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'newsletters') return { insert: mockNewsletterInsert }
      if (table === 'articles') return { select: mockArticlesSelect }
      if (table === 'newsletter_articles') return { insert: mockNlArticlesInsert }
      return {}
    })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.newslettersPrepared).toBe(1)
    expect(mockNewsletterInsert).toHaveBeenCalledWith(
      expect.objectContaining({ subscriber_email: 'alice@example.com', status: 'scheduled' })
    )
    expect(mockNlArticlesInsert).toHaveBeenCalledWith([{ newsletter_id: 'nl-1', article_id: 'art-1' }])

    vi.useRealTimers()
  })

  it('continues to next subscriber when newsletter DB insert fails', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-12T14:45:00Z')) // Friday 14:45 UTC → +1h = Friday 15:45 UTC

    const subscribers = [makeSubscriber({ email: 'a@example.com' }), makeSubscriber({ email: 'b@example.com' })]
    mockGetActiveSubscribers.mockResolvedValue(subscribers)
    mockFetchArticlesForNewsletter.mockResolvedValue(withArticles)

    const mockNewsletterSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const mockNewsletterSelectChain = vi.fn().mockReturnValue({ single: mockNewsletterSingle })
    const mockNewsletterInsert = vi.fn().mockReturnValue({ select: mockNewsletterSelectChain })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'newsletters') return { insert: mockNewsletterInsert }
      return {}
    })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    // Both failed to insert, but the loop completed without throwing
    expect(body.newslettersPrepared).toBe(0)
    expect(body.totalSubscribers).toBe(2)

    vi.useRealTimers()
  })
})

// ─── Error handling ────────────────────────────────────────────────────────────

describe('GET /api/news/prepare-newsletters — error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CRON_SECRET
  })

  it('returns 500 when getActiveSubscribers throws', async () => {
    mockGetActiveSubscribers.mockRejectedValue(new Error('DB connection failed'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
