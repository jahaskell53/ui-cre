import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { createClient } from '@/utils/supabase/server'
import { NextRequest } from 'next/server'

// Mock the Supabase server client
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}))

describe('GET /api/conversations', () => {
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

    const request = new NextRequest('http://localhost/api/conversations')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return empty array if no conversations', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockSelect = vi.fn().mockReturnValue({
      or: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/conversations')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(0)
  })

  it('should return conversations with profile data', async () => {
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
        created_at: new Date(Date.now() - 10000).toISOString(),
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

    const mockProfiles = [
      {
        id: 'user-456',
        username: 'johndoe',
        full_name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
      },
    ]

    let callCount = 0
    const mockSelect = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // First call for messages
        return {
          or: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockMessages,
              error: null,
            }),
          }),
        }
      } else {
        // Second call for profiles
        return {
          in: vi.fn().mockResolvedValue({
            data: mockProfiles,
            error: null,
          }),
        }
      }
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/conversations')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(1)
    expect(data[0].other_user_id).toBe('user-456')
    expect(data[0].other_user).toBeDefined()
    expect(data[0].other_user?.username).toBe('johndoe')
    expect(data[0].last_message).toBeDefined()
    expect(data[0].unread_count).toBeGreaterThanOrEqual(0)
  })

  it('should handle errors when fetching messages', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockSelect = vi.fn().mockReturnValue({
      or: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/conversations')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch conversations')
  })
})

