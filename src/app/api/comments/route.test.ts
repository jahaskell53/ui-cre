import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createClient } from '@/utils/supabase/server'
import { NextRequest } from 'next/server'
import { parseMentions } from '@/utils/parse-mentions'
import { sendMentionNotificationEmail } from '@/utils/send-mention-notification-email'

// Mock the Supabase server client
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock the parse mentions utility
vi.mock('@/utils/parse-mentions', () => ({
  parseMentions: vi.fn(),
}))

// Mock the email sending function
vi.mock('@/utils/send-mention-notification-email', () => ({
  sendMentionNotificationEmail: vi.fn().mockResolvedValue(true),
}))

describe('POST /api/comments', () => {
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
    vi.mocked(parseMentions).mockReturnValue([])
  })

  it('should return 401 if user is not authenticated', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    } as any)

    const request = new NextRequest('http://localhost/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        post_id: 'post-123',
        content: 'Great post!',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 400 if post_id is missing', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const request = new NextRequest('http://localhost/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Great post!',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('post_id is required')
  })

  it('should return 400 if content is missing', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const request = new NextRequest('http://localhost/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        post_id: 'post-123',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('content is required and cannot be empty')
  })

  it('should return 400 if content is empty string', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const request = new NextRequest('http://localhost/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        post_id: 'post-123',
        content: '   ',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('content is required and cannot be empty')
  })

  it('should return 404 if post does not exist', async () => {
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

    const request = new NextRequest('http://localhost/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        post_id: 'post-123',
        content: 'Great post!',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Post not found')
  })

  it('should create comment successfully without mentions', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockComment = {
      id: 'comment-123',
      post_id: 'post-123',
      user_id: 'user-123',
      content: 'Great post!',
      created_at: new Date().toISOString(),
    }

    const mockPostSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'post-123' },
          error: null,
        }),
      }),
    })

    const mockCommentInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockComment,
          error: null,
        }),
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockImplementation((table) => {
      if (table === 'posts') {
        return { select: mockPostSelect } as any
      }
      if (table === 'comments') {
        return { insert: mockCommentInsert } as any
      }
      return {} as any
    })

    const request = new NextRequest('http://localhost/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        post_id: 'post-123',
        content: 'Great post!',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.id).toBe('comment-123')
    expect(data.content).toBe('Great post!')
    expect(mockCommentInsert).toHaveBeenCalledWith({
      post_id: 'post-123',
      user_id: 'user-123',
      content: 'Great post!',
    })
    expect(parseMentions).toHaveBeenCalledWith('Great post!')
    expect(sendMentionNotificationEmail).not.toHaveBeenCalled()
  })

  it('should create comment with mentions and send emails', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    vi.mocked(parseMentions).mockReturnValue(['john', 'jane'])

    const mockComment = {
      id: 'comment-123',
      post_id: 'post-123',
      user_id: 'user-123',
      content: 'Great post @john @jane!',
      created_at: new Date().toISOString(),
    }

    const mockPostSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'post-123' },
          error: null,
        }),
      }),
    })

    const mockCommentInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockComment,
          error: null,
        }),
      }),
    })

    const mockProfilesSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          { id: 'user-456', username: 'john' },
          { id: 'user-789', username: 'jane' },
        ],
        error: null,
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockImplementation((table) => {
      if (table === 'posts') {
        return { select: mockPostSelect } as any
      }
      if (table === 'comments') {
        return { insert: mockCommentInsert } as any
      }
      if (table === 'profiles') {
        return { select: mockProfilesSelect } as any
      }
      return {} as any
    })

    const request = new NextRequest('http://localhost/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        post_id: 'post-123',
        content: 'Great post @john @jane!',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.id).toBe('comment-123')
    expect(parseMentions).toHaveBeenCalledWith('Great post @john @jane!')
    expect(mockProfilesSelect).toHaveBeenCalledWith('id, username')
    expect(sendMentionNotificationEmail).toHaveBeenCalledTimes(2)
    expect(sendMentionNotificationEmail).toHaveBeenCalledWith('comment-123', 'user-456', 'post-123')
    expect(sendMentionNotificationEmail).toHaveBeenCalledWith('comment-123', 'user-789', 'post-123')
  })

  it('should not send email to comment author when they mention themselves', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    vi.mocked(parseMentions).mockReturnValue(['testuser'])

    const mockComment = {
      id: 'comment-123',
      post_id: 'post-123',
      user_id: 'user-123',
      content: 'Great post @testuser!',
      created_at: new Date().toISOString(),
    }

    const mockPostSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'post-123' },
          error: null,
        }),
      }),
    })

    const mockCommentInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockComment,
          error: null,
        }),
      }),
    })

    const mockProfilesSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          { id: 'user-123', username: 'testuser' }, // Same as comment author
        ],
        error: null,
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockImplementation((table) => {
      if (table === 'posts') {
        return { select: mockPostSelect } as any
      }
      if (table === 'comments') {
        return { insert: mockCommentInsert } as any
      }
      if (table === 'profiles') {
        return { select: mockProfilesSelect } as any
      }
      return {} as any
    })

    const request = new NextRequest('http://localhost/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        post_id: 'post-123',
        content: 'Great post @testuser!',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(sendMentionNotificationEmail).not.toHaveBeenCalled()
  })

  it('should return 500 if comment insertion fails', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockPostSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'post-123' },
          error: null,
        }),
      }),
    })

    const mockCommentInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockImplementation((table) => {
      if (table === 'posts') {
        return { select: mockPostSelect } as any
      }
      if (table === 'comments') {
        return { insert: mockCommentInsert } as any
      }
      return {} as any
    })

    const request = new NextRequest('http://localhost/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        post_id: 'post-123',
        content: 'Great post!',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to create comment')
  })

  it('should handle errors gracefully when email sending fails', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    vi.mocked(parseMentions).mockReturnValue(['john'])
    vi.mocked(sendMentionNotificationEmail).mockRejectedValue(new Error('Email failed'))

    const mockComment = {
      id: 'comment-123',
      post_id: 'post-123',
      user_id: 'user-123',
      content: 'Great post @john!',
      created_at: new Date().toISOString(),
    }

    const mockPostSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'post-123' },
          error: null,
        }),
      }),
    })

    const mockCommentInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockComment,
          error: null,
        }),
      }),
    })

    const mockProfilesSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          { id: 'user-456', username: 'john' },
        ],
        error: null,
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockImplementation((table) => {
      if (table === 'posts') {
        return { select: mockPostSelect } as any
      }
      if (table === 'comments') {
        return { insert: mockCommentInsert } as any
      }
      if (table === 'profiles') {
        return { select: mockProfilesSelect } as any
      }
      return {} as any
    })

    const request = new NextRequest('http://localhost/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        post_id: 'post-123',
        content: 'Great post @john!',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    // Should still succeed even if email fails
    expect(response.status).toBe(201)
    expect(data.id).toBe('comment-123')
  })
})

