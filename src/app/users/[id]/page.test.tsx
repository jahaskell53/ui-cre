import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import UserProfilePage from './page'
import { useUser } from '@/hooks/use-user'
import { supabase } from '@/utils/supabase'

// Mock dependencies
vi.mock('@/hooks/use-user')
vi.mock('@/utils/supabase')
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({
    id: 'user-123',
  }),
}))
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const mockCurrentUser = {
  id: 'current-user',
  email: 'current@example.com',
}

const mockProfile = {
  id: 'user-123',
  username: 'testuser',
  full_name: 'Test User',
  avatar_url: 'https://example.com/avatar.jpg',
  website: 'https://example.com',
  roles: ['Property Owner', 'Broker'],
}

describe('UserProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useUser).mockReturnValue({
      user: mockCurrentUser,
      profile: null,
      loading: false,
    })
  })

  it('should load and display user profile', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        }),
      }),
    })

    const mockCount = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        count: 5,
        error: null,
      }),
    })

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'profiles') {
        return { select: mockSelect } as any
      }
      if (table === 'posts') {
        return { select: mockCount } as any
      }
      return {} as any
    })

    render(<UserProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    expect(screen.getByText('@testuser')).toBeInTheDocument()
    expect(screen.getByText('Property Owner')).toBeInTheDocument()
    expect(screen.getByText('Broker')).toBeInTheDocument()
  })

  it('should display posts count', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        }),
      }),
    })

    const mockCount = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        count: 10,
        error: null,
      }),
    })

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'profiles') {
        return { select: mockSelect } as any
      }
      if (table === 'posts') {
        return { select: mockCount } as any
      }
      return {} as any
    })

    render(<UserProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument()
    })
  })

  it('should show edit profile button for own profile', async () => {
    vi.mocked(useUser).mockReturnValue({
      user: { ...mockCurrentUser, id: 'user-123' }, // Same ID as profile
      profile: null,
      loading: false,
    })

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        }),
      }),
    })

    const mockCount = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        count: 0,
        error: null,
      }),
    })

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'profiles') {
        return { select: mockSelect } as any
      }
      if (table === 'posts') {
        return { select: mockCount } as any
      }
      return {} as any
    })

    render(<UserProfilePage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument()
    })
  })

  it('should show user not found when profile does not exist', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      }),
    })

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as any)

    render(<UserProfilePage />)

    await waitFor(() => {
      expect(screen.getByText(/user not found/i)).toBeInTheDocument()
    })
  })
})

