import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { createClient } from '@/utils/supabase/server'
import { NextRequest } from 'next/server'

// Mock the Supabase server client
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}))

describe('GET /api/messages/unread-count', () => {
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

    const request = new NextRequest('http://localhost/api/messages/unread-count')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return unread count of 0 when no unread messages', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({
          count: 0,
          error: null,
        }),
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/messages/unread-count')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.unread_count).toBe(0)
    expect(mockSelect).toHaveBeenCalledWith('*', { count: 'exact', head: true })
  })

  it('should return correct unread count', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({
          count: 5,
          error: null,
        }),
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/messages/unread-count')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.unread_count).toBe(5)
    expect(mockSelect).toHaveBeenCalledWith('*', { count: 'exact', head: true })
  })

  it('should handle database errors', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({
          count: null,
          error: { message: 'Database error' },
        }),
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/messages/unread-count')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to count unread notifications')
  })

    it('should filter by user_id and read_at is null', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockEq = vi.fn().mockReturnValue({
      is: vi.fn().mockResolvedValue({
        count: 3,
        error: null,
      }),
    })

    const mockSelect = vi.fn().mockReturnValue({
      eq: mockEq,
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/messages/unread-count')

    await GET(request)

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('notifications')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123')
  })
})

