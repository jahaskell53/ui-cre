import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockFrom, mockGetUserById, mockSendEmail } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockGetUserById: vi.fn(),
  mockSendEmail: vi.fn(),
}))

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

vi.mock('@/utils/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    auth: { admin: { getUserById: mockGetUserById } },
  }),
}))

vi.mock('@/utils/email-service', () => ({
  EmailService: vi.fn().mockImplementation(() => ({
    sendEmail: mockSendEmail,
  })),
}))

import { POST } from './route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/events/evt-1/send-blast', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const params = Promise.resolve({ id: 'evt-1' })

const validBody = { subject: 'Test Subject', message: 'Hello attendees!' }

function setupEventQuery(eventData: unknown, eventError: unknown = null) {
  const mockSingle = vi.fn().mockResolvedValue({ data: eventData, error: eventError })
  const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
  return { mockSingle, mockSelect }
}

function setupRegistrationsQuery(registrations: unknown[], error: unknown = null) {
  const mockEq = vi.fn().mockResolvedValue({ data: registrations, error })
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
  return { mockSelect }
}

function setupBlastInsert(blastData: unknown = { id: 'blast-1' }) {
  const mockSingle = vi.fn().mockResolvedValue({ data: blastData, error: null })
  const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
  const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
  return { mockInsert }
}

// ─── Auth & validation ────────────────────────────────────────────────────────

describe('POST /api/events/[id]/send-blast — auth & validation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makeRequest(validBody), { params })
    expect(res.status).toBe(401)
  })

  it('returns 400 when subject is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const res = await POST(makeRequest({ message: 'Hello' }), { params })
    expect(res.status).toBe(400)
  })

  it('returns 400 when message is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const res = await POST(makeRequest({ subject: 'Hi' }), { params })
    expect(res.status).toBe(400)
  })
})

// ─── Event ownership ──────────────────────────────────────────────────────────

describe('POST /api/events/[id]/send-blast — event ownership', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when event not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const { mockSelect } = setupEventQuery(null, { message: 'not found' })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await POST(makeRequest(validBody), { params })
    expect(res.status).toBe(404)
  })

  it('returns 403 when user does not own the event', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const { mockSelect } = setupEventQuery({ id: 'evt-1', title: 'Kickoff', user_id: 'other-user' })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await POST(makeRequest(validBody), { params })
    expect(res.status).toBe(403)
  })
})

// ─── Registrations ────────────────────────────────────────────────────────────

describe('POST /api/events/[id]/send-blast — registrations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when no registered attendees', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') {
        const { mockSelect } = setupEventQuery({ id: 'evt-1', title: 'Kickoff', user_id: 'user-1' })
        return { select: mockSelect }
      }
      if (table === 'event_registrations') {
        const { mockSelect } = setupRegistrationsQuery([])
        return { select: mockSelect }
      }
      return {}
    })

    const res = await POST(makeRequest(validBody), { params })
    expect(res.status).toBe(400)
  })

  it('returns 500 when registrations fetch fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') {
        const { mockSelect } = setupEventQuery({ id: 'evt-1', title: 'Kickoff', user_id: 'user-1' })
        return { select: mockSelect }
      }
      if (table === 'event_registrations') {
        const { mockSelect } = setupRegistrationsQuery([], { message: 'DB error' })
        return { select: mockSelect }
      }
      return {}
    })

    const res = await POST(makeRequest(validBody), { params })
    expect(res.status).toBe(500)
  })

  it('returns 400 when no valid email addresses found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockGetUserById.mockResolvedValue({ data: { user: null }, error: { message: 'not found' } })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') {
        const { mockSelect } = setupEventQuery({ id: 'evt-1', title: 'Kickoff', user_id: 'user-1' })
        return { select: mockSelect }
      }
      if (table === 'event_registrations') {
        const { mockSelect } = setupRegistrationsQuery([{ user_id: 'u1' }])
        return { select: mockSelect }
      }
      return {}
    })

    const res = await POST(makeRequest(validBody), { params })
    expect(res.status).toBe(400)
  })
})

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('POST /api/events/[id]/send-blast — happy path', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends emails and returns counts', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockGetUserById
      .mockResolvedValueOnce({ data: { user: { email: 'a@example.com' } }, error: null })
      .mockResolvedValueOnce({ data: { user: { email: 'b@example.com' } }, error: null })
    mockSendEmail.mockResolvedValue(true)

    const { mockInsert } = setupBlastInsert({ id: 'blast-1' })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') {
        const { mockSelect } = setupEventQuery({ id: 'evt-1', title: 'Kickoff', user_id: 'user-1' })
        return { select: mockSelect }
      }
      if (table === 'event_registrations') {
        const { mockSelect } = setupRegistrationsQuery([{ user_id: 'u1' }, { user_id: 'u2' }])
        return { select: mockSelect }
      }
      if (table === 'event_blasts') return { insert: mockInsert }
      return {}
    })

    const res = await POST(makeRequest(validBody), { params })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sent).toBe(2)
    expect(body.failed).toBe(0)
    expect(body.total).toBe(2)
    expect(body.blast_id).toBe('blast-1')
  })

  it('counts failed emails correctly', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockGetUserById
      .mockResolvedValueOnce({ data: { user: { email: 'a@example.com' } }, error: null })
      .mockResolvedValueOnce({ data: { user: { email: 'b@example.com' } }, error: null })
    mockSendEmail
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)

    const { mockInsert } = setupBlastInsert()

    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') {
        const { mockSelect } = setupEventQuery({ id: 'evt-1', title: 'Kickoff', user_id: 'user-1' })
        return { select: mockSelect }
      }
      if (table === 'event_registrations') {
        const { mockSelect } = setupRegistrationsQuery([{ user_id: 'u1' }, { user_id: 'u2' }])
        return { select: mockSelect }
      }
      if (table === 'event_blasts') return { insert: mockInsert }
      return {}
    })

    const res = await POST(makeRequest(validBody), { params })
    const body = await res.json()

    expect(body.sent).toBe(1)
    expect(body.failed).toBe(1)
  })
})
