import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import FeedPage from './page'
import { useUser } from '@/hooks/use-user'
import { supabase } from '@/utils/supabase'

// Mock dependencies
vi.mock('@/hooks/use-user')
vi.mock('@/utils/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))
vi.mock('next/dynamic', () => ({
  default: () => () => <div>PDF Viewer</div>,
}))

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
}

const mockProfile = {
  id: 'user-123',
  full_name: 'Test User',
  avatar_url: null,
}

describe('FeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useUser).mockReturnValue({
      user: mockUser,
      profile: mockProfile,
      loading: false,
    })
  })

  it('should load posts on mount', async () => {
    // Create a mock that supports the full method chain
    const createMockQuery = (table: string) => {
      const mockIn = vi.fn().mockResolvedValue({ data: [], error: null })
      const mockEq = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })
      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
        eq: mockEq,
        in: mockIn,
      })
      const mockDelete = vi.fn().mockReturnValue({
        eq: mockEq,
      })
      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })

      return {
        select: mockSelect,
        delete: mockDelete,
        insert: mockInsert,
      }
    }

    vi.mocked(supabase.from).mockImplementation((table) => {
      return createMockQuery(table) as any
    })

    render(<FeedPage />)

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('posts')
    })
  })

  it('should handle loading state', () => {
    vi.mocked(useUser).mockReturnValue({
      user: mockUser,
      profile: mockProfile,
      loading: true,
    })

    render(<FeedPage />)
    // Component should handle loading state
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
