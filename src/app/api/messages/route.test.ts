import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from './route'
import { createClient } from '@/utils/supabase/server'
import { NextRequest } from 'next/server'

// Mock the Supabase server client
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock the email sending function
vi.mock('@/utils/send-message-notification-email', () => ({
  sendMessageNotificationEmail: vi.fn().mockResolvedValue(true),
}))

describe('POST /api/messages', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  }

  const mockSupabaseClient = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any)
  })

  it('should return 401 if user is not authenticated', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    } as any)

    const request = new NextRequest('http://localhost/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        recipient_id: 'user-456',
        content: 'Hello',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 400 if recipient_id is missing', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const request = new NextRequest('http://localhost/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Hello',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('recipient_id is required')
  })

  it('should return 400 if content is missing or empty', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const request = new NextRequest('http://localhost/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        recipient_id: 'user-456',
        content: '',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('content is required and cannot be empty')
  })

  it('should return 400 if trying to send message to self', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const request = new NextRequest('http://localhost/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        recipient_id: 'user-123',
        content: 'Hello',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Cannot send message to yourself')
  })

  it('should return 404 if recipient does not exist', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        recipient_id: 'user-456',
        content: 'Hello',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Recipient not found')
  })

  it('should send message successfully', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockMessage = {
      id: 'msg-123',
      sender_id: 'user-123',
      recipient_id: 'user-456',
      content: 'Hello',
      created_at: new Date().toISOString(),
    }

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'user-456' },
          error: null,
        }),
      }),
    })

    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockMessage,
          error: null,
        }),
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockImplementation((table) => {
      if (table === 'profiles') {
        return { select: mockSelect } as any
      }
      if (table === 'messages') {
        return { insert: mockInsert } as any
      }
      return {} as any
    })

    const request = new NextRequest('http://localhost/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        recipient_id: 'user-456',
        content: 'Hello',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.id).toBe('msg-123')
    expect(data.content).toBe('Hello')
    expect(mockInsert).toHaveBeenCalledWith({
      sender_id: 'user-123',
      recipient_id: 'user-456',
      content: 'Hello',
    })
  })
})

describe('GET /api/messages', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  }

  const mockSupabaseClient = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any)
  })

  it('should return 401 if user is not authenticated', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    } as any)

    const request = new NextRequest('http://localhost/api/messages?user_id=user-456')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 400 if user_id is missing', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const request = new NextRequest('http://localhost/api/messages')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('user_id query parameter is required')
  })

  it('should fetch messages successfully', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockMessages = [
      {
        id: 'msg-1',
        sender_id: 'user-123',
        recipient_id: 'user-456',
        content: 'Hello',
        created_at: new Date().toISOString(),
        read_at: null,
      },
      {
        id: 'msg-2',
        sender_id: 'user-456',
        recipient_id: 'user-123',
        content: 'Hi there',
        created_at: new Date().toISOString(),
        read_at: null,
      },
    ]

    const mockSelect = vi.fn().mockReturnValue({
      or: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockMessages,
          error: null,
        }),
      }),
    })

    const mockUpdate = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockImplementation((table) => {
      if (table === 'messages') {
        return {
          select: mockSelect,
          update: mockUpdate,
        } as any
      }
      return {} as any
    })

    const request = new NextRequest('http://localhost/api/messages?user_id=user-456')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(2)
  })
})

