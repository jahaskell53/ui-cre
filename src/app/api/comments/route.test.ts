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
  })

  it('should create comment with mentions and send emails', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    vi.mocked(parseMentions).mockReturnValue(['John Smith', 'Jane Doe'])

    const mockComment = {
      id: 'comment-123',
      post_id: 'post-123',
      user_id: 'user-123',
      content: 'Great post @John Smith @Jane Doe!',
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
          { id: 'user-456', full_name: 'John Smith' },
          { id: 'user-789', full_name: 'Jane Doe' },
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
        content: 'Great post @John Smith @Jane Doe!',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.id).toBe('comment-123')
    expect(parseMentions).toHaveBeenCalledWith('Great post @John Smith @Jane Doe!')
    expect(sendMentionNotificationEmail).toHaveBeenCalledTimes(2)
    expect(sendMentionNotificationEmail).toHaveBeenCalledWith('comment-123', 'user-456', 'post-123')
    expect(sendMentionNotificationEmail).toHaveBeenCalledWith('comment-123', 'user-789', 'post-123')
  })

  it('should not send email to comment author when they mention themselves', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    vi.mocked(parseMentions).mockReturnValue(['Test User'])

    const mockComment = {
      id: 'comment-123',
      post_id: 'post-123',
      user_id: 'user-123',
      content: 'Great post @Test User!',
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
          { id: 'user-123', full_name: 'Test User' }, // Same as comment author
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
        content: 'Great post @Test User!',
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

})

