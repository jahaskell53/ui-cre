import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST, DELETE } from './route'
import { createClient } from '@/utils/supabase/server'
import { NextRequest } from 'next/server'

// Mock the Supabase server client
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}))

describe('GET /api/contacts', () => {
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

    const request = new NextRequest('http://localhost/api/contacts')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return empty array if no contacts', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/contacts')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(0)
  })

  it('should fetch contacts successfully', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockContacts = [
      {
        id: 'contact-1',
        user_id: 'user-123',
        first_name: 'John',
        last_name: 'Doe',
        email_address: 'john@example.com',
        company: 'Acme Corp',
        position: 'Engineer',
        created_at: new Date().toISOString(),
      },
      {
        id: 'contact-2',
        user_id: 'user-123',
        first_name: 'Jane',
        last_name: 'Smith',
        email_address: 'jane@example.com',
        company: null,
        position: null,
        created_at: new Date().toISOString(),
      },
    ]

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockContacts,
          error: null,
        }),
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/contacts')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(2)
    expect(data[0].id).toBe('contact-1')
    expect(data[0].first_name).toBe('John')
    expect(data[1].id).toBe('contact-2')
    expect(data[1].first_name).toBe('Jane')
  })

  it('should handle errors when fetching contacts', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/contacts')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch contacts')
  })
})

describe('POST /api/contacts', () => {
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

    const request = new NextRequest('http://localhost/api/contacts', {
      method: 'POST',
      body: JSON.stringify({
        contacts: [
          {
            firstName: 'John',
            lastName: 'Doe',
            emailAddress: 'john@example.com',
          },
        ],
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 400 if contacts array is missing', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const request = new NextRequest('http://localhost/api/contacts', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid request: contacts array required')
  })

  it('should return 400 if contacts array is empty', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const request = new NextRequest('http://localhost/api/contacts', {
      method: 'POST',
      body: JSON.stringify({
        contacts: [],
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid request: contacts array required')
  })

  it('should return 400 if contacts is not an array', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const request = new NextRequest('http://localhost/api/contacts', {
      method: 'POST',
      body: JSON.stringify({
        contacts: 'not-an-array',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid request: contacts array required')
  })

  it('should return 400 if no valid contacts after filtering', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const request = new NextRequest('http://localhost/api/contacts', {
      method: 'POST',
      body: JSON.stringify({
        contacts: [
          {
            firstName: '',
            lastName: '',
            emailAddress: '',
          },
          {
            firstName: 'John',
            // missing lastName and emailAddress
          },
        ],
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('No valid contacts to import')
  })

  it('should successfully import contacts', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockInsertedContacts = [
      {
        id: 'contact-1',
        user_id: 'user-123',
        first_name: 'John',
        last_name: 'Doe',
        email_address: 'john@example.com',
        company: 'Acme Corp',
        position: 'Engineer',
        created_at: new Date().toISOString(),
      },
      {
        id: 'contact-2',
        user_id: 'user-123',
        first_name: 'Jane',
        last_name: 'Smith',
        email_address: 'jane@example.com',
        company: null,
        position: null,
        created_at: new Date().toISOString(),
      },
    ]

    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: mockInsertedContacts,
        error: null,
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      insert: mockInsert,
    } as any)

    const request = new NextRequest('http://localhost/api/contacts', {
      method: 'POST',
      body: JSON.stringify({
        contacts: [
          {
            firstName: 'John',
            lastName: 'Doe',
            emailAddress: 'john@example.com',
            company: 'Acme Corp',
            position: 'Engineer',
          },
          {
            firstName: 'Jane',
            lastName: 'Smith',
            emailAddress: 'jane@example.com',
          },
        ],
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.count).toBe(2)
    expect(mockInsert).toHaveBeenCalledWith([
      {
        user_id: 'user-123',
        first_name: 'John',
        last_name: 'Doe',
        email_address: 'john@example.com',
        company: 'Acme Corp',
        position: 'Engineer',
      },
      {
        user_id: 'user-123',
        first_name: 'Jane',
        last_name: 'Smith',
        email_address: 'jane@example.com',
        company: null,
        position: null,
      },
    ])
  })

  it('should filter out invalid contacts and import valid ones', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockInsertedContacts = [
      {
        id: 'contact-1',
        user_id: 'user-123',
        first_name: 'John',
        last_name: 'Doe',
        email_address: 'john@example.com',
        company: null,
        position: null,
        created_at: new Date().toISOString(),
      },
    ]

    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: mockInsertedContacts,
        error: null,
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      insert: mockInsert,
    } as any)

    const request = new NextRequest('http://localhost/api/contacts', {
      method: 'POST',
      body: JSON.stringify({
        contacts: [
          {
            firstName: 'John',
            lastName: 'Doe',
            emailAddress: 'john@example.com',
          },
          {
            firstName: '',
            lastName: '',
            emailAddress: '',
          },
          {
            firstName: 'Jane',
            // missing lastName
            emailAddress: 'jane@example.com',
          },
        ],
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.count).toBe(1)
    expect(mockInsert).toHaveBeenCalledWith([
      {
        user_id: 'user-123',
        first_name: 'John',
        last_name: 'Doe',
        email_address: 'john@example.com',
        company: null,
        position: null,
      },
    ])
  })

  it('should trim whitespace from contact fields', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockInsertedContacts = [
      {
        id: 'contact-1',
        user_id: 'user-123',
        first_name: 'John',
        last_name: 'Doe',
        email_address: 'john@example.com',
        company: 'Acme Corp',
        position: 'Engineer',
        created_at: new Date().toISOString(),
      },
    ]

    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: mockInsertedContacts,
        error: null,
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      insert: mockInsert,
    } as any)

    const request = new NextRequest('http://localhost/api/contacts', {
      method: 'POST',
      body: JSON.stringify({
        contacts: [
          {
            firstName: '  John  ',
            lastName: '  Doe  ',
            emailAddress: '  john@example.com  ',
            company: '  Acme Corp  ',
            position: '  Engineer  ',
          },
        ],
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(mockInsert).toHaveBeenCalledWith([
      {
        user_id: 'user-123',
        first_name: 'John',
        last_name: 'Doe',
        email_address: 'john@example.com',
        company: 'Acme Corp',
        position: 'Engineer',
      },
    ])
  })

  it('should handle errors when inserting contacts', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      insert: mockInsert,
    } as any)

    const request = new NextRequest('http://localhost/api/contacts', {
      method: 'POST',
      body: JSON.stringify({
        contacts: [
          {
            firstName: 'John',
            lastName: 'Doe',
            emailAddress: 'john@example.com',
          },
        ],
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to import contacts')
  })
})

describe('DELETE /api/contacts', () => {
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

    const request = new NextRequest('http://localhost/api/contacts?id=contact-1', {
      method: 'DELETE',
    })

    const response = await DELETE(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 400 if contact ID is missing', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const request = new NextRequest('http://localhost/api/contacts', {
      method: 'DELETE',
    })

    const response = await DELETE(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Contact ID is required')
  })

  it('should successfully delete contact', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      delete: mockDelete,
    } as any)

    const request = new NextRequest('http://localhost/api/contacts?id=contact-1', {
      method: 'DELETE',
    })

    const response = await DELETE(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockDelete).toHaveBeenCalled()
  })

  it('should handle errors when deleting contact', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }),
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      delete: mockDelete,
    } as any)

    const request = new NextRequest('http://localhost/api/contacts?id=contact-1', {
      method: 'DELETE',
    })

    const response = await DELETE(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to delete contact')
  })
})

