import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UsersPage from './page'
import { useUser } from '@/hooks/use-user'
import { supabase } from '@/utils/supabase'

// Mock dependencies
vi.mock('@/hooks/use-user')
vi.mock('@/utils/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
}

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useUser).mockReturnValue({
      user: mockUser,
      profile: null,
      loading: false,
    })
  })

  it('should render search input', () => {
    render(<UsersPage />)
    expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument()
  })

  it('should search for users when typing', async () => {
    const user = userEvent.setup()
    const mockSelect = vi.fn().mockReturnValue({
      ilike: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'user-1',
              full_name: 'John Doe',
              avatar_url: null,
              website: null,
              roles: ['Broker'],
            },
          ],
          error: null,
        }),
      }),
    })

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as any)

    render(<UsersPage />)
    
    const searchInput = screen.getByPlaceholderText(/search by name/i)
    await user.type(searchInput, 'john')

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('profiles')
    }, { timeout: 1000 })
  })

  it('should display search results', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      ilike: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'user-1',
              full_name: 'John Doe',
              avatar_url: null,
              website: null,
              roles: ['Broker'],
            },
          ],
          error: null,
        }),
      }),
    })

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as any)

    render(<UsersPage />)
    
    const searchInput = screen.getByPlaceholderText(/search by name/i)
    await userEvent.type(searchInput, 'john')

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('should show empty state when no search query', () => {
    render(<UsersPage />)
    expect(screen.getByText(/enter a name to find people/i)).toBeInTheDocument()
  })

  it('should show no results message when search returns empty', async () => {
    const user = userEvent.setup()
    const mockSelect = vi.fn().mockReturnValue({
      ilike: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    })

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as any)

    render(<UsersPage />)
    
    const searchInput = screen.getByPlaceholderText(/search by name/i)
    await user.type(searchInput, 'nonexistent')

    await waitFor(() => {
      expect(screen.getByText(/no users found/i)).toBeInTheDocument()
    }, { timeout: 1000 })
  })
})

