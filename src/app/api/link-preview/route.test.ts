import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { NextRequest } from 'next/server'
import { getLinkPreview } from 'link-preview-js'

// Mock the link-preview-js library
vi.mock('link-preview-js', () => ({
  getLinkPreview: vi.fn(),
}))

describe('GET /api/link-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 400 if URL is missing', async () => {
    const request = new NextRequest('http://localhost/api/link-preview')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('URL is required')
  })

  it('should return link preview data for valid URL', async () => {
    const mockPreview = {
      title: 'Test Title',
      description: 'Test Description',
      images: ['https://example.com/image.jpg'],
      siteName: 'Example Site',
      url: 'https://example.com',
    }

    vi.mocked(getLinkPreview).mockResolvedValue(mockPreview as any)

    const request = new NextRequest('http://localhost/api/link-preview?url=https://example.com')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.title).toBe('Test Title')
    expect(data.description).toBe('Test Description')
    expect(data.image).toBe('https://example.com/image.jpg')
    expect(data.siteName).toBe('Example Site')
    expect(data.url).toBe('https://example.com')
  })

  it('should handle missing preview properties gracefully', async () => {
    const mockPreview = {
      url: 'https://example.com',
    }

    vi.mocked(getLinkPreview).mockResolvedValue(mockPreview as any)

    const request = new NextRequest('http://localhost/api/link-preview?url=https://example.com')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.title).toBe('')
    expect(data.description).toBe('')
    expect(data.image).toBe('')
    expect(data.siteName).toBe('')
    expect(data.url).toBe('https://example.com')
  })

  it('should return 500 on error', async () => {
    vi.mocked(getLinkPreview).mockRejectedValue(new Error('Network error'))

    const request = new NextRequest('http://localhost/api/link-preview?url=https://example.com')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch link preview')
  })
})

