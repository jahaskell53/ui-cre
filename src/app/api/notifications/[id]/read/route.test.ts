import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createClient } from '@/utils/supabase/server'
import { NextRequest } from 'next/server'

// Mock the Supabase server client
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}))

describe('POST /api/notifications/[id]/read', () => {
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

    const request = new NextRequest('http://localhost/api/notifications/notif-123/read', {
      method: 'POST',
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'notif-123' }) })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should mark notification as read', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      update: mockUpdate,
    } as any)

    const request = new NextRequest('http://localhost/api/notifications/notif-123/read', {
      method: 'POST',
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'notif-123' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalled()
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('notifications')
  })

  it('should handle errors when marking notification as read', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      update: mockUpdate,
    } as any)

    const request = new NextRequest('http://localhost/api/notifications/notif-123/read', {
      method: 'POST',
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'notif-123' }) })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to mark notification as read')
  })
})

