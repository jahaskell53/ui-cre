import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetSubscriberByEmail,
  mockFetchArticlesForNewsletter,
  mockGenerateEmailContentFromArticles,
  mockSendNewsletterToSubscriber,
} = vi.hoisted(() => ({
  mockGetSubscriberByEmail: vi.fn(),
  mockFetchArticlesForNewsletter: vi.fn(),
  mockGenerateEmailContentFromArticles: vi.fn(),
  mockSendNewsletterToSubscriber: vi.fn(),
}))

vi.mock('@/lib/news/subscribers', () => ({
  getSubscriberByEmail: mockGetSubscriberByEmail,
}))

vi.mock('@/lib/news/newsletter-utils', () => ({
  fetchArticlesForNewsletter: mockFetchArticlesForNewsletter,
  generateEmailContentFromArticles: mockGenerateEmailContentFromArticles,
}))

vi.mock('@/lib/news/email-service', () => ({
  EmailService: vi.fn().mockImplementation(() => ({
    sendNewsletterToSubscriber: mockSendNewsletterToSubscriber,
  })),
}))

import { GET } from './route'

function makeGet() {
  return new NextRequest('http://localhost/api/news/test-newsletter')
}

const activeSubscriber = {
  id: 'sub-1',
  email: 'alon@greenpointcollection.com',
  firstName: 'Alon',
  isActive: true,
  selectedCounties: ['Suffolk'],
  selectedCities: [{ name: 'Boston', state: 'MA', stateAbbr: 'MA' }],
  interests: 'multifamily, CRE deals',
}

describe('GET /api/news/test-newsletter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when subscriber not found', async () => {
    mockGetSubscriberByEmail.mockResolvedValue(null)
    const res = await GET(makeGet())
    expect(res.status).toBe(404)
  })

  it('returns 400 when subscriber is not active', async () => {
    mockGetSubscriberByEmail.mockResolvedValue({ ...activeSubscriber, isActive: false })
    const res = await GET(makeGet())
    expect(res.status).toBe(400)
  })

  it('returns 200 with articlesFound:0 when no articles', async () => {
    mockGetSubscriberByEmail.mockResolvedValue(activeSubscriber)
    mockFetchArticlesForNewsletter.mockResolvedValue({ nationalArticles: [], localArticles: [] })

    const res = await GET(makeGet())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.articlesFound).toBe(0)
  })

  it('sends newsletter and returns success', async () => {
    mockGetSubscriberByEmail.mockResolvedValue(activeSubscriber)
    mockFetchArticlesForNewsletter.mockResolvedValue({
      nationalArticles: [{ id: 'a1', title: 'Deal 1' }],
      localArticles: [],
    })
    mockGenerateEmailContentFromArticles.mockReturnValue('<p>Content</p>')
    mockSendNewsletterToSubscriber.mockResolvedValue(true)

    const res = await GET(makeGet())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.articlesCount).toBe(1)
  })

  it('returns 500 when email send fails', async () => {
    mockGetSubscriberByEmail.mockResolvedValue(activeSubscriber)
    mockFetchArticlesForNewsletter.mockResolvedValue({
      nationalArticles: [{ id: 'a1', title: 'Deal 1' }],
      localArticles: [],
    })
    mockGenerateEmailContentFromArticles.mockReturnValue('<p>Content</p>')
    mockSendNewsletterToSubscriber.mockResolvedValue(false)

    const res = await GET(makeGet())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.success).toBe(false)
  })
})
