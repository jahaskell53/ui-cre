import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockSendMail } = vi.hoisted(() => ({
  mockSendMail: vi.fn().mockResolvedValue({ messageId: 'msg-123' }),
}))

vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockReturnValue({ sendMail: mockSendMail }),
}))

vi.mock('./email-template', () => ({
  generateNewsletterHTML: vi.fn().mockReturnValue('<html>newsletter</html>'),
  formatInterests: vi.fn().mockReturnValue(''),
}))

import { createTransport } from 'nodemailer'
import { formatInterests } from './email-template'
import { EmailService } from './email-service'
import type { Subscriber } from './subscribers'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSubscriber(overrides: Partial<Subscriber> = {}): Subscriber {
  return {
    id: 'sub-1',
    firstName: 'Alice',
    email: 'alice@example.com',
    selectedCounties: [],
    selectedCities: [],
    subscribedAt: null,
    isActive: true,
    interests: null,
    timezone: 'America/New_York',
    preferredSendTimes: [],
    ...overrides,
  }
}

function makeService(smtpConfigured = false): EmailService {
  if (smtpConfigured) {
    process.env.SMTP_USER = 'sender@example.com'
    process.env.SMTP_PASS = 'secret'
  }
  return new EmailService()
}

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('EmailService constructor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASS
  })

  it('does not create a transporter when SMTP credentials are missing', () => {
    makeService()
    expect(createTransport).not.toHaveBeenCalled()
  })

  it('creates a transporter when SMTP credentials are present', () => {
    makeService(true)
    expect(createTransport).toHaveBeenCalledOnce()
  })
})

// ─── sendEmail ───────────────────────────────────────────────────────────────

describe('EmailService.sendEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASS
  })

  const content = { subject: 'Hello', html: '<p>hi</p>', text: 'hi' }

  it('returns true in simulation mode (no SMTP)', async () => {
    const service = makeService()
    expect(await service.sendEmail('to@example.com', content)).toBe(true)
  })

  it('does not call sendMail in simulation mode', async () => {
    const service = makeService()
    await service.sendEmail('to@example.com', content)
    expect(mockSendMail).not.toHaveBeenCalled()
  })

  it('returns true and calls sendMail when SMTP is configured', async () => {
    const service = makeService(true)
    expect(await service.sendEmail('to@example.com', content)).toBe(true)
    expect(mockSendMail).toHaveBeenCalledOnce()
  })

  it('includes cc in mail options when provided', async () => {
    const service = makeService(true)
    await service.sendEmail('to@example.com', content, 'cc@example.com')
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ cc: 'cc@example.com' })
    )
  })

  it('omits cc from mail options when not provided', async () => {
    const service = makeService(true)
    await service.sendEmail('to@example.com', content)
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.not.objectContaining({ cc: expect.anything() })
    )
  })

  it('sets List-Unsubscribe header to the provided unsubscribe URL', async () => {
    const service = makeService(true)
    await service.sendEmail('to@example.com', content, undefined, 'https://example.com/unsub')
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'List-Unsubscribe': '<https://example.com/unsub>',
        }),
      })
    )
  })

  it('falls back to default unsubscribe URL when none is provided', async () => {
    const service = makeService(true)
    await service.sendEmail('to@example.com', content)
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'List-Unsubscribe': expect.stringContaining('to%40example.com'),
        }),
      })
    )
  })

  it('returns false when sendMail throws', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'))
    const service = makeService(true)
    expect(await service.sendEmail('to@example.com', content)).toBe(false)
  })
})

// ─── sendNewsletterToSubscriber ───────────────────────────────────────────────

describe('EmailService.sendNewsletterToSubscriber', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASS
    vi.mocked(formatInterests).mockReturnValue('')
  })

  it('sends to the subscriber email address', async () => {
    const service = makeService()
    const spy = vi.spyOn(service, 'sendEmail')
    await service.sendNewsletterToSubscriber(makeSubscriber(), '<p>content</p>')
    expect(spy).toHaveBeenCalledWith(
      'alice@example.com',
      expect.anything(),
      undefined,
      expect.any(String)
    )
  })

  it('subject contains the newsletter title', async () => {
    const service = makeService()
    const spy = vi.spyOn(service, 'sendEmail')
    await service.sendNewsletterToSubscriber(makeSubscriber(), '')
    const [, { subject }] = spy.mock.calls[0]
    expect(subject).toContain('OpenMidMarket News')
  })

  it('subject contains a formatted date', async () => {
    const service = makeService()
    const spy = vi.spyOn(service, 'sendEmail')
    await service.sendNewsletterToSubscriber(makeSubscriber(), '')
    const [, { subject }] = spy.mock.calls[0]
    // e.g. "Mar 15 - OpenMidMarket News"
    expect(subject).toMatch(/\w{3} \d{1,2} - /)
  })

  it('forwards cc when provided', async () => {
    const service = makeService()
    const spy = vi.spyOn(service, 'sendEmail')
    await service.sendNewsletterToSubscriber(makeSubscriber(), '', undefined, 'bcc@example.com')
    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      'bcc@example.com',
      expect.any(String)
    )
  })

  it('builds unsubscribe URL using subscriber email', async () => {
    const service = makeService()
    const spy = vi.spyOn(service, 'sendEmail')
    await service.sendNewsletterToSubscriber(makeSubscriber(), '')
    const [, , , unsubscribeUrl] = spy.mock.calls[0]
    expect(unsubscribeUrl).toContain('alice%40example.com')
    expect(unsubscribeUrl).toContain('/api/news/unsubscribe')
  })

  it('plain text body includes subscriber first name', async () => {
    const service = makeService()
    const spy = vi.spyOn(service, 'sendEmail')
    await service.sendNewsletterToSubscriber(makeSubscriber({ firstName: 'Bob' }), '')
    const [, { text }] = spy.mock.calls[0]
    expect(text).toContain('Bob')
  })

  it('plain text body includes county location when counties are set', async () => {
    const service = makeService()
    const spy = vi.spyOn(service, 'sendEmail')
    await service.sendNewsletterToSubscriber(
      makeSubscriber({ selectedCounties: ['Providence', 'Kent'] }),
      ''
    )
    const [, { text }] = spy.mock.calls[0]
    expect(text).toContain('Providence')
    expect(text).toContain('Kent')
  })

  it('plain text body omits location phrase when no counties are set', async () => {
    const service = makeService()
    const spy = vi.spyOn(service, 'sendEmail')
    await service.sendNewsletterToSubscriber(makeSubscriber({ selectedCounties: [] }), '')
    const [, { text }] = spy.mock.calls[0]
    expect(text).not.toContain(' for ')
  })

  it('plain text body includes interests section when formatInterests returns a value', async () => {
    vi.mocked(formatInterests).mockReturnValue('Office, Industrial')
    const service = makeService()
    const spy = vi.spyOn(service, 'sendEmail')
    await service.sendNewsletterToSubscriber(makeSubscriber({ interests: 'office, industrial' }), '')
    const [, { text }] = spy.mock.calls[0]
    expect(text).toContain('Your Interests: Office, Industrial')
  })

  it('plain text body omits interests section when formatInterests returns empty string', async () => {
    vi.mocked(formatInterests).mockReturnValue('')
    const service = makeService()
    const spy = vi.spyOn(service, 'sendEmail')
    await service.sendNewsletterToSubscriber(makeSubscriber({ interests: null }), '')
    const [, { text }] = spy.mock.calls[0]
    expect(text).not.toContain('Your Interests:')
  })
})
