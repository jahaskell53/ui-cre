import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { s3Client } from '@/utils/s3'

// Mock the S3 client
vi.mock('@/utils/s3', () => ({
  s3Client: {
    send: vi.fn(),
  },
  BUCKET_NAME: 'test-bucket',
}))

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.AWS_REGION = 'us-east-1'
  })

  it('should return 400 if no file is provided', async () => {
    // Mock request with empty formData
    const mockFormData = {
      get: vi.fn().mockReturnValue(null),
    }
    
    const request = {
      formData: vi.fn().mockResolvedValue(mockFormData),
    } as any

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('No file provided')
  })

  it('should upload file successfully', async () => {
    const mockFile = {
      name: 'test-image.jpg',
      type: 'image/jpeg',
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as any

    const mockFormData = {
      get: vi.fn().mockReturnValue(mockFile),
    }

    const request = {
      formData: vi.fn().mockResolvedValue(mockFormData),
    } as any

    vi.mocked(s3Client.send).mockResolvedValue({} as any)

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.url).toContain('test-bucket.s3.us-east-1.amazonaws.com')
    expect(data.url).toContain('profile-pics/')
    expect(data.url).toContain('test-image.jpg')
    expect(s3Client.send).toHaveBeenCalledWith(expect.any(PutObjectCommand))
  })

  it('should sanitize file names with spaces', async () => {
    const mockFile = {
      name: 'my test file.jpg',
      type: 'image/jpeg',
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as any

    const mockFormData = {
      get: vi.fn().mockReturnValue(mockFile),
    }

    const request = {
      formData: vi.fn().mockResolvedValue(mockFormData),
    } as any

    vi.mocked(s3Client.send).mockResolvedValue({} as any)

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.url).not.toContain(' ')
    expect(data.url).toContain('my-test-file.jpg')
  })

  it('should handle S3 upload errors', async () => {
    const mockFile = {
      name: 'test.jpg',
      type: 'image/jpeg',
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as any

    const mockFormData = {
      get: vi.fn().mockReturnValue(mockFile),
    }

    const request = {
      formData: vi.fn().mockResolvedValue(mockFormData),
    } as any

    const mockError = new Error('S3 upload failed')
    vi.mocked(s3Client.send).mockRejectedValue(mockError)

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('S3 upload failed')
  })

  it('should use custom AWS region from env', async () => {
    process.env.AWS_REGION = 'eu-west-1'
    
    const mockFile = {
      name: 'test.jpg',
      type: 'image/jpeg',
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as any

    const mockFormData = {
      get: vi.fn().mockReturnValue(mockFile),
    }

    const request = {
      formData: vi.fn().mockResolvedValue(mockFormData),
    } as any

    vi.mocked(s3Client.send).mockResolvedValue({} as any)

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.url).toContain('eu-west-1')
  })
})
