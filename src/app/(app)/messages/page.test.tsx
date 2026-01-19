import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MessagesPage from './page'
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
}))

// Mock fetch
global.fetch = vi.fn()

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
}

describe('MessagesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useUser).mockReturnValue({
      user: mockUser,
      profile: null,
      loading: false,
    })
    vi.mocked(global.fetch).mockClear()
    
    // Mock window.location.search
    Object.defineProperty(window, 'location', {
      value: {
        search: '',
      },
      writable: true,
    })
    
    // Mock Supabase
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
        ilike: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      }),
    } as any)
  })

  it('should render messages page', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    render(<MessagesPage />)
    await waitFor(() => {
      expect(screen.getByText('Messages')).toBeInTheDocument()
    })
  })

  it('should display conversations list', async () => {
    const mockConversations = [
      {
        other_user_id: 'user-456',
        other_user: {
          id: 'user-456',
          full_name: 'John Doe',
          avatar_url: null,
        },
        last_message: {
          id: 'msg-1',
          content: 'Hello',
          created_at: new Date().toISOString(),
          sender_id: 'user-456',
        },
        unread_count: 0,
      },
    ]

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConversations,
    } as Response)

    render(<MessagesPage />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
  })

  it('should show loading state', () => {
    vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}))

    render(<MessagesPage />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should show empty state when no conversations', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    render(<MessagesPage />)

    await waitFor(() => {
      expect(screen.getByText(/No conversations yet/i)).toBeInTheDocument()
    })
  })

  it('should display messages when conversation is selected', async () => {
    const mockConversations = [
      {
        other_user_id: 'user-456',
        other_user: {
          id: 'user-456',
          full_name: 'John Doe',
          avatar_url: null,
        },
        last_message: {
          id: 'msg-1',
          content: 'Hello',
          created_at: new Date().toISOString(),
          sender_id: 'user-456',
        },
        unread_count: 0,
      },
    ]

    const mockMessages = [
      {
        id: 'msg-1',
        sender_id: 'user-456',
        recipient_id: 'user-123',
        content: 'Hello there',
        created_at: new Date().toISOString(),
        read_at: null,
      },
    ]

    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConversations,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockMessages,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConversations,
      } as Response)

    render(<MessagesPage />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    const conversation = screen.getByText('John Doe').closest('div[class*="cursor-pointer"]')
    if (conversation) {
      await userEvent.click(conversation)
    }

    await waitFor(() => {
      expect(screen.getByText('Hello there')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should show message input when conversation is selected', async () => {
    const mockConversations = [
      {
        other_user_id: 'user-456',
        other_user: {
          id: 'user-456',
          full_name: 'John Doe',
          avatar_url: null,
        },
        last_message: {
          id: 'msg-1',
          content: 'Hello',
          created_at: new Date().toISOString(),
          sender_id: 'user-456',
        },
        unread_count: 0,
      },
    ]

    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConversations,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)

    render(<MessagesPage />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    const conversation = screen.getByText('John Doe').closest('div[class*="cursor-pointer"]')
    if (conversation) {
      await userEvent.click(conversation)
    }

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type a message/i)).toBeInTheDocument()
    })
  })

  it('should send message when send button is clicked', async () => {
    const mockConversations = [
      {
        other_user_id: 'user-456',
        other_user: {
          id: 'user-456',
          full_name: 'John Doe',
          avatar_url: null,
        },
        last_message: {
          id: 'msg-1',
          content: 'Hello',
          created_at: new Date().toISOString(),
          sender_id: 'user-456',
        },
        unread_count: 0,
      },
    ]

    const now = new Date()
    const mockNewMessage = {
      id: 'msg-2',
      sender_id: 'user-123',
      recipient_id: 'user-456',
      content: 'Test message',
      created_at: now.toISOString(),
      read_at: null,
    }

    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConversations,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNewMessage,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConversations,
      } as Response)

    render(<MessagesPage />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    const conversation = screen.getByText('John Doe').closest('div[class*="cursor-pointer"]')
    if (conversation) {
      await userEvent.click(conversation)
    }

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type a message/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    const input = screen.getByPlaceholderText(/Type a message/i)
    await userEvent.type(input, 'Test message')

    // Find the send button - it's an icon-only button in the message input area
    // The button should be enabled after typing
    await waitFor(() => {
      const messageInputArea = input.closest('[class*="border-t"]')
      if (messageInputArea) {
        const buttons = within(messageInputArea as HTMLElement).getAllByRole('button')
        const sendButton = buttons.find(btn => !btn.hasAttribute('disabled'))
        if (sendButton) {
          return sendButton
        }
      }
      throw new Error('Send button not found or not enabled')
    }, { timeout: 3000 })
    
    const messageInputArea = input.closest('[class*="border-t"]')
    const buttons = within(messageInputArea as HTMLElement).getAllByRole('button')
    const sendButton = buttons.find(btn => !btn.hasAttribute('disabled'))
    expect(sendButton).toBeDefined()
    await userEvent.click(sendButton!)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient_id: 'user-456',
          content: 'Test message',
        }),
      })
    })
  })

  it('should show unread count badge', async () => {
    const mockConversations = [
      {
        other_user_id: 'user-456',
        other_user: {
          id: 'user-456',
          full_name: 'John Doe',
          avatar_url: null,
        },
        last_message: {
          id: 'msg-1',
          content: 'Hello',
          created_at: new Date().toISOString(),
          sender_id: 'user-456',
        },
        unread_count: 3,
      },
    ]

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConversations,
    } as Response)

    render(<MessagesPage />)

    await waitFor(() => {
      const badge = screen.getByText('3')
      expect(badge).toBeInTheDocument()
    }, { timeout: 3000 })
  })
})

