import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { formatInterests, generateNewsletterHTML } from './email-template'

// ─── formatInterests ─────────────────────────────────────────────────────────

describe('formatInterests', () => {
  it('returns empty string for null', () => {
    expect(formatInterests(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatInterests(undefined)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(formatInterests('')).toBe('')
  })

  it('joins a JSON array of strings with spaces', () => {
    expect(formatInterests('["Office market.", "Industrial trends."]')).toBe('Office market. Industrial trends.')
  })

  it('returns a plain string as-is when it is not JSON', () => {
    expect(formatInterests('Office, Industrial')).toBe('Office, Industrial')
  })

  it('returns a non-array JSON value as-is', () => {
    expect(formatInterests('{"key":"value"}')).toBe('{"key":"value"}')
  })
})

// ─── generateNewsletterHTML ───────────────────────────────────────────────────

describe('generateNewsletterHTML', () => {
  const baseData = {
    subscriberName: 'Alice',
    content: '<p>Article content here.</p>',
    unsubscribeUrl: 'https://example.com/unsub',
  }

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  it('includes the provided content', () => {
    const html = generateNewsletterHTML(baseData)
    expect(html).toContain('<p>Article content here.</p>')
  })

  it('includes the unsubscribe link', () => {
    const html = generateNewsletterHTML(baseData)
    expect(html).toContain('href="https://example.com/unsub"')
    expect(html).toContain('Unsubscribe')
  })

  it('shows formatted interests when interests are provided', () => {
    const html = generateNewsletterHTML({ ...baseData, interests: 'Office, Industrial' })
    expect(html).toContain('Your interests:')
    expect(html).toContain('Office, Industrial')
  })

  it('shows add-interests prompt when no interests are provided', () => {
    const html = generateNewsletterHTML(baseData)
    expect(html).toContain('Want more personalized content?')
    expect(html).not.toContain('Your interests:')
  })

  it('shows regions section when locations are provided', () => {
    const html = generateNewsletterHTML({ ...baseData, locations: 'Providence, Kent' })
    expect(html).toContain('Your regions:')
    expect(html).toContain('Providence, Kent')
  })

  it('omits regions section when no locations are provided', () => {
    const html = generateNewsletterHTML(baseData)
    expect(html).not.toContain('Your regions:')
  })

  it('uses NEXT_PUBLIC_APP_URL env var for settings links when set', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://staging.example.com'
    const html = generateNewsletterHTML(baseData)
    expect(html).toContain('https://staging.example.com/news/settings')
  })

  it('falls back to production URL for settings links when env var is not set', () => {
    const html = generateNewsletterHTML(baseData)
    expect(html).toContain('https://app.openmidmarket.com/news/settings')
  })

  it('includes an edit preferences link', () => {
    const html = generateNewsletterHTML(baseData)
    expect(html).toContain('Edit your preferences here')
  })

  it('is valid HTML with a doctype', () => {
    const html = generateNewsletterHTML(baseData)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('</html>')
  })
})
