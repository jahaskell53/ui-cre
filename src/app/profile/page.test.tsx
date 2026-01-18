import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfilePage from './page'
import { useUser } from '@/hooks/use-user'
import { supabase } from '@/utils/supabase'

// Mock dependencies
vi.mock('@/hooks/use-user')
vi.mock('@/utils/supabase')
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
  }),
}))
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
}

const mockProfile = {
  id: 'user-123',
  full_name: 'Test User',
  website: 'https://example.com',
  avatar_url: 'https://example.com/avatar.jpg',
  roles: ['Property Owner'],
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useUser).mockReturnValue({
      user: mockUser,
      profile: mockProfile,
      loading: false,
    })
  })

  it('should display user email', () => {
    render(<ProfilePage />)
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument()
  })

  it('should load profile data into form', () => {
    render(<ProfilePage />)
    expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument()
  })

  it('should update profile when save is clicked', async () => {
    const user = userEvent.setup()
    const mockUpdate = vi.fn().mockResolvedValue({ error: null })
    
    vi.mocked(supabase.from).mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue(mockUpdate),
      }),
    } as any)

    render(<ProfilePage />)
    
    const fullNameInput = screen.getByDisplayValue('Test User')
    await user.clear(fullNameInput)
    await user.type(fullNameInput, 'Updated Name')
    
    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('profiles')
    })
  })

  it('should toggle roles when checkbox is clicked', async () => {
    const user = userEvent.setup()
    render(<ProfilePage />)
    
    // Find a role checkbox that's not selected
    const brokerCheckbox = screen.getByRole('checkbox', { name: 'Broker' })
    expect(brokerCheckbox).not.toBeChecked()
    
    await user.click(brokerCheckbox)
    expect(brokerCheckbox).toBeChecked()
    
    await user.click(brokerCheckbox)
    expect(brokerCheckbox).not.toBeChecked()
  })

  it('should show selected roles from profile', () => {
    render(<ProfilePage />)
    const propertyOwnerCheckbox = screen.getByRole('checkbox', { name: 'Property Owner' })
    expect(propertyOwnerCheckbox).toBeChecked()
  })

  it('should redirect to login when user is not authenticated', async () => {
    vi.mocked(useUser).mockReturnValue({
      user: null,
      profile: null,
      loading: false,
    })

    render(<ProfilePage />)
    
    // Wait for useEffect to run
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })
})

