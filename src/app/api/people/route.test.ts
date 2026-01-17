import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST, PUT, DELETE } from './route'
import { createClient } from '@/utils/supabase/server'
import { NextRequest } from 'next/server'

// Mock the Supabase server client
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}))

describe('GET /api/people', () => {
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

    const request = new NextRequest('http://localhost/api/people')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return empty array if no people', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockOrder = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    })

    const mockEq = vi.fn().mockReturnValue({
      order: mockOrder,
    })

    const mockSelect = vi.fn().mockReturnValue({
      eq: mockEq,
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/people')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(0)
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123')
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('should fetch people successfully', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockPeople = [
      {
        id: 'person-1',
        user_id: 'user-123',
        name: 'John Doe',
        starred: false,
        email: 'john@example.com',
        signal: false,
        address: null,
        owned_addresses: null,
        timeline: [],
        created_at: new Date().toISOString(),
      },
      {
        id: 'person-2',
        user_id: 'user-123',
        name: 'Jane Smith',
        starred: true,
        email: 'jane@example.com',
        signal: false,
        address: '123 Main St',
        owned_addresses: [],
        timeline: [],
        created_at: new Date().toISOString(),
      },
    ]

    const mockOrder = vi.fn().mockResolvedValue({
      data: mockPeople,
      error: null,
    })

    const mockEq = vi.fn().mockReturnValue({
      order: mockOrder,
    })

    const mockSelect = vi.fn().mockReturnValue({
      eq: mockEq,
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/people')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(2)
    expect(data[0].id).toBe('person-1')
    expect(data[0].name).toBe('John Doe')
    expect(data[1].id).toBe('person-2')
    expect(data[1].name).toBe('Jane Smith')
  })

  it('should search people by name when search query is provided', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockPeople = [
      {
        id: 'person-1',
        user_id: 'user-123',
        name: 'John Doe',
        starred: false,
        email: 'john@example.com',
        signal: false,
        address: null,
        owned_addresses: null,
        timeline: [],
        created_at: new Date().toISOString(),
      },
    ]

    const mockOrder = vi.fn().mockResolvedValue({
      data: mockPeople,
      error: null,
    })

    const mockIlike = vi.fn().mockReturnValue({
      order: mockOrder,
    })

    const mockEq = vi.fn().mockReturnValue({
      ilike: mockIlike,
    })

    const mockSelect = vi.fn().mockReturnValue({
      eq: mockEq,
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/people?search=John')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(1)
    expect(data[0].name).toBe('John Doe')
    expect(mockIlike).toHaveBeenCalledWith('name', '%John%')
  })

  it('should handle case-insensitive search', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockPeople = [
      {
        id: 'person-1',
        user_id: 'user-123',
        name: 'John Doe',
        starred: false,
        email: 'john@example.com',
        signal: false,
        address: null,
        owned_addresses: null,
        timeline: [],
        created_at: new Date().toISOString(),
      },
    ]

    const mockOrder = vi.fn().mockResolvedValue({
      data: mockPeople,
      error: null,
    })

    const mockIlike = vi.fn().mockReturnValue({
      order: mockOrder,
    })

    const mockEq = vi.fn().mockReturnValue({
      ilike: mockIlike,
    })

    const mockSelect = vi.fn().mockReturnValue({
      eq: mockEq,
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/people?search=jOhN')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(mockIlike).toHaveBeenCalledWith('name', '%jOhN%')
  })

  it('should trim search query whitespace', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockOrder = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    })

    const mockIlike = vi.fn().mockReturnValue({
      order: mockOrder,
    })

    const mockEq = vi.fn().mockReturnValue({
      ilike: mockIlike,
    })

    const mockSelect = vi.fn().mockReturnValue({
      eq: mockEq,
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/people?search=  John  ')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(mockIlike).toHaveBeenCalledWith('name', '%John%')
  })

  it('should not apply search filter if search query is empty', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockPeople = [
      {
        id: 'person-1',
        user_id: 'user-123',
        name: 'John Doe',
        starred: false,
        email: 'john@example.com',
        signal: false,
        address: null,
        owned_addresses: null,
        timeline: [],
        created_at: new Date().toISOString(),
      },
    ]

    const mockOrder = vi.fn().mockResolvedValue({
      data: mockPeople,
      error: null,
    })

    const mockEq = vi.fn().mockReturnValue({
      order: mockOrder,
    })

    const mockSelect = vi.fn().mockReturnValue({
      eq: mockEq,
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/people?search=')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.length).toBe(1)
    // Should not call ilike when search is empty
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123')
  })

  it('should handle errors when fetching people', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockOrder = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    })

    const mockEq = vi.fn().mockReturnValue({
      order: mockOrder,
    })

    const mockSelect = vi.fn().mockReturnValue({
      eq: mockEq,
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/people')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch people')
  })

  it('should handle partial name matches in search', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockPeople = [
      {
        id: 'person-1',
        user_id: 'user-123',
        name: 'John Doe',
        starred: false,
        email: 'john@example.com',
        signal: false,
        address: null,
        owned_addresses: null,
        timeline: [],
        created_at: new Date().toISOString(),
      },
      {
        id: 'person-2',
        user_id: 'user-123',
        name: 'Johnny Smith',
        starred: false,
        email: 'johnny@example.com',
        signal: false,
        address: null,
        owned_addresses: null,
        timeline: [],
        created_at: new Date().toISOString(),
      },
    ]

    const mockOrder = vi.fn().mockResolvedValue({
      data: mockPeople,
      error: null,
    })

    const mockIlike = vi.fn().mockReturnValue({
      order: mockOrder,
    })

    const mockEq = vi.fn().mockReturnValue({
      ilike: mockIlike,
    })

    const mockSelect = vi.fn().mockReturnValue({
      eq: mockEq,
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      select: mockSelect,
    } as any)

    const request = new NextRequest('http://localhost/api/people?search=John')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.length).toBe(2)
    expect(data[0].name).toBe('John Doe')
    expect(data[1].name).toBe('Johnny Smith')
    expect(mockIlike).toHaveBeenCalledWith('name', '%John%')
  })
})

describe('POST /api/people', () => {
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

    const request = new NextRequest('http://localhost/api/people', {
      method: 'POST',
      body: JSON.stringify({
        name: 'John Doe',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 400 if name is missing', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const request = new NextRequest('http://localhost/api/people', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Name is required')
  })

  it('should successfully create a person', async () => {
    vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockPerson = {
      id: 'person-1',
      user_id: 'user-123',
      name: 'John Doe',
      starred: false,
      email: 'john@example.com',
      signal: false,
      address: null,
      owned_addresses: [],
      timeline: [],
      created_at: new Date().toISOString(),
    }

    const mockSingle = vi.fn().mockResolvedValue({
      data: mockPerson,
      error: null,
    })

    const mockSelect = vi.fn().mockReturnValue({
      single: mockSingle,
    })

    const mockInsert = vi.fn().mockReturnValue({
      select: mockSelect,
    })

    vi.mocked(mockSupabaseClient.from).mockReturnValue({
      insert: mockInsert,
    } as any)

    const request = new NextRequest('http://localhost/api/people', {
      method: 'POST',
      body: JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe('person-1')
    expect(data.name).toBe('John Doe')
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-123',
      name: 'John Doe',
      starred: false,
      email: 'john@example.com',
      signal: false,
      address: null,
      owned_addresses: [],
      timeline: [],
    })
  })
})

