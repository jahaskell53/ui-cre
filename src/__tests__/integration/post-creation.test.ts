/**
 * Integration test example for post creation flow
 * 
 * This demonstrates how to test a critical user flow.
 * In a real scenario, you'd mock Supabase responses using MSW (Mock Service Worker)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/utils/supabase'

// Mock Supabase
vi.mock('@/utils/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
    },
  },
}))

describe('Post Creation Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create a text post successfully', async () => {
    const mockInsert = vi.fn().mockResolvedValue({
      data: { id: 'post-123' },
      error: null,
    })

    vi.mocked(supabase.from).mockReturnValue({
      insert: mockInsert,
    } as any)

    // Simulate post creation
    const postData = {
      user_id: 'user-123',
      type: 'post',
      content: 'This is a test post',
    }

    const result = await supabase.from('posts').insert(postData)

    expect(supabase.from).toHaveBeenCalledWith('posts')
    expect(mockInsert).toHaveBeenCalledWith(postData)
    expect(result.data).toEqual({ id: 'post-123' })
    expect(result.error).toBeNull()
  })

  it('should create a link post with URL in content', async () => {
    const mockInsert = vi.fn().mockResolvedValue({
      data: { id: 'post-456' },
      error: null,
    })

    vi.mocked(supabase.from).mockReturnValue({
      insert: mockInsert,
    } as any)

    const postData = {
      user_id: 'user-123',
      type: 'link',
      content: 'https://example.com',
    }

    const result = await supabase.from('posts').insert(postData)

    expect(mockInsert).toHaveBeenCalledWith(postData)
    expect(result.data).toEqual({ id: 'post-456' })
  })

  it('should handle post creation errors', async () => {
    const mockError = { message: 'Database error', code: '23505' }
    const mockInsert = vi.fn().mockResolvedValue({
      data: null,
      error: mockError,
    })

    vi.mocked(supabase.from).mockReturnValue({
      insert: mockInsert,
    } as any)

    const postData = {
      user_id: 'user-123',
      type: 'post',
      content: 'Test post',
    }

    const result = await supabase.from('posts').insert(postData)

    expect(result.error).toEqual(mockError)
    expect(result.data).toBeNull()
  })
})

