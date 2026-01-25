import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Next.js router
const createMockSearchParams = (params?: Record<string, string>) => {
  const searchParams = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      searchParams.set(key, value)
    })
  }
  return searchParams
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    pathname: '/',
  }),
  useParams: () => ({}),
  useSearchParams: () => createMockSearchParams(),
}))

// Mock fetch to handle relative URLs in test environment
global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  // Convert relative URLs to absolute URLs for testing
  let url: string
  if (typeof input === 'string') {
    url = input.startsWith('/') ? `http://localhost:3000${input}` : input
  } else if (input instanceof URL) {
    url = input.href
  } else {
    url = input.url
  }
  
  // Return appropriate default responses based on endpoint
  let defaultData: any = []
  if (url.includes('/api/integrations')) {
    defaultData = { integrations: [] }
  }
  
  // Return a default successful response for unmocked fetch calls
  return Promise.resolve(
    new Response(JSON.stringify(defaultData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}) as typeof fetch

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key'

