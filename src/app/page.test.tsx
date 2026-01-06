import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import FeedPage from './page'
import { useUser } from '@/hooks/use-user'
import { supabase } from '@/utils/supabase'

// Mock dependencies
vi.mock('@/hooks/use-user')
vi.mock('@/utils/supabase')
vi.mock('next/navigation')
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
    const mockSelect = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    })

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'posts') {
        return { select: mockSelect } as any
      }
      return { 
        select: vi.fn().mockResolvedValue({ data: [], error: null }) 
      } as any
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
