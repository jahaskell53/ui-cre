import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockMakeGeminiCall } = vi.hoisted(() => ({
  mockMakeGeminiCall: vi.fn(),
}))

vi.mock('@/lib/news/gemini', () => ({
  makeGeminiCall: mockMakeGeminiCall,
}))

// Make p-retry a transparent pass-through so tests control the outcome directly
vi.mock('p-retry', () => ({
  default: vi.fn((fn: () => unknown) => fn()),
}))

vi.mock('@/lib/news/tag-categories', () => ({
  TAG_CATEGORIES: { multifamily: 'Multifamily housing', office: 'Office market' },
}))

import {
  checkArticleRelevance,
  getCountyCategories,
  getCityCategories,
  getArticleTags,
  generateNewsletterTitle,
  generateArticleTitles,
} from './categorization'

// ─── Helpers ────────────────────────────────────────────────────────────────

function geminiResponse(text: string) {
  return { candidates: [{ content: { parts: [{ text }] } }] }
}

const articles = [
  { title: 'Office rents rise in Boston', description: 'Strong demand.' },
  { title: 'Miami multifamily surge', description: 'Record permits.' },
]

// ─── checkArticleRelevance ───────────────────────────────────────────────────

describe('checkArticleRelevance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.GEMINI_API_KEY
  })

  it('returns empty array for empty input', async () => {
    expect(await checkArticleRelevance([])).toEqual([])
  })

  it('returns all true when GEMINI_API_KEY is not set', async () => {
    const result = await checkArticleRelevance(articles)
    expect(result).toEqual([true, true])
    expect(mockMakeGeminiCall).not.toHaveBeenCalled()
  })

  it('returns Gemini response when it is a valid boolean array', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockResolvedValue(geminiResponse('[true, false]'))
    expect(await checkArticleRelevance(articles)).toEqual([true, false])
  })

  it('coerces truthy/falsy values to booleans', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockResolvedValue(geminiResponse('[1, 0]'))
    const result = await checkArticleRelevance(articles)
    expect(result).toEqual([true, false])
    result.forEach(v => expect(typeof v).toBe('boolean'))
  })

  it('falls back to all true when response text is empty', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockResolvedValue(geminiResponse(''))
    expect(await checkArticleRelevance(articles)).toEqual([true, true])
  })

  it('falls back to all true when response is invalid JSON', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockResolvedValue(geminiResponse('not json at all'))
    expect(await checkArticleRelevance(articles)).toEqual([true, true])
  })

  it('extracts array from a wrapped object response', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockResolvedValue(geminiResponse('{"relevance":[true,false]}'))
    expect(await checkArticleRelevance(articles)).toEqual([true, false])
  })

  it('falls back to all true when response is an object with no array value', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockResolvedValue(geminiResponse('{"foo":"bar"}'))
    expect(await checkArticleRelevance(articles)).toEqual([true, true])
  })

  it('falls back to all true when response is a non-array primitive', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockResolvedValue(geminiResponse('"just a string"'))
    expect(await checkArticleRelevance(articles)).toEqual([true, true])
  })

  it('pads with true when response array is shorter than articles', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockResolvedValue(geminiResponse('[true]'))
    expect(await checkArticleRelevance(articles)).toEqual([true, true])
  })

  it('truncates when response array is longer than articles', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockResolvedValue(geminiResponse('[true, false, true]'))
    expect(await checkArticleRelevance(articles)).toEqual([true, false])
  })

  it('falls back to all true when Gemini throws', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockRejectedValue(new Error('API down'))
    expect(await checkArticleRelevance(articles)).toEqual([true, true])
  })
})

// ─── getCountyCategories ─────────────────────────────────────────────────────

describe('getCountyCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.GEMINI_API_KEY
  })

  it('returns empty array for empty input', async () => {
    expect(await getCountyCategories([])).toEqual([])
  })

  it('returns all ["Other"] when GEMINI_API_KEY is not set', async () => {
    expect(await getCountyCategories(articles)).toEqual([['Other'], ['Other']])
  })

  it('returns validated counties from Gemini', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockResolvedValue(geminiResponse('[["Suffolk"],["Miami-Dade"]]'))
    const result = await getCountyCategories(articles)
    expect(result).toEqual([['Suffolk'], ['Miami-Dade']])
  })

  it('replaces invalid county names with ["Other"]', async () => {
    process.env.GEMINI_API_KEY = 'key'
    // First call returns an invalid county; second call (retry) returns a valid one
    mockMakeGeminiCall
      .mockResolvedValueOnce(geminiResponse('[["FakeCounty"],["Miami-Dade"]]'))
      .mockResolvedValueOnce(geminiResponse('[["Suffolk"]]'))
    const result = await getCountyCategories(articles)
    expect(result[0]).toEqual(['Suffolk'])
    expect(result[1]).toEqual(['Miami-Dade'])
  })

  it('rethrows when Gemini throws', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockRejectedValue(new Error('API error'))
    await expect(getCountyCategories(articles)).rejects.toThrow('API error')
  })
})

// ─── getCityCategories ───────────────────────────────────────────────────────

describe('getCityCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.GEMINI_API_KEY
  })

  it('returns empty array for empty input', async () => {
    expect(await getCityCategories([])).toEqual([])
  })

  it('returns all [] when GEMINI_API_KEY is not set', async () => {
    expect(await getCityCategories(articles)).toEqual([[], []])
  })

  it('returns city arrays from Gemini', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockResolvedValue(geminiResponse('[["Boston"],["Miami"]]'))
    expect(await getCityCategories(articles)).toEqual([['Boston'], ['Miami']])
  })

  it('rethrows when Gemini throws', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockRejectedValue(new Error('network error'))
    await expect(getCityCategories(articles)).rejects.toThrow('network error')
  })
})

// ─── getArticleTags ──────────────────────────────────────────────────────────

describe('getArticleTags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.GEMINI_API_KEY
  })

  it('returns empty array for empty input', async () => {
    expect(await getArticleTags([])).toEqual([])
  })

  it('returns all [] when GEMINI_API_KEY is not set', async () => {
    expect(await getArticleTags(articles)).toEqual([[], []])
  })

  it('returns tag arrays from Gemini', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockResolvedValue(geminiResponse('[["office"],["multifamily","development"]]'))
    expect(await getArticleTags(articles)).toEqual([['office'], ['multifamily', 'development']])
  })

  it('rethrows when Gemini throws', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockRejectedValue(new Error('timeout'))
    await expect(getArticleTags(articles)).rejects.toThrow('timeout')
  })
})

// ─── generateNewsletterTitle ─────────────────────────────────────────────────

describe('generateNewsletterTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.GEMINI_API_KEY
  })

  it('returns "CRE News" when GEMINI_API_KEY is not set', async () => {
    expect(await generateNewsletterTitle(articles)).toBe('CRE News')
  })

  it('returns the title from Gemini', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockResolvedValue(geminiResponse('Boston Office Rise, Miami Multifamily Boom'))
    expect(await generateNewsletterTitle(articles)).toBe('Boston Office Rise, Miami Multifamily Boom')
  })

  it('returns "CRE News" when Gemini returns empty string', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockResolvedValue(geminiResponse('   '))
    expect(await generateNewsletterTitle(articles)).toBe('CRE News')
  })

  it('returns "CRE News" when Gemini throws', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockRejectedValue(new Error('rate limited'))
    expect(await generateNewsletterTitle(articles)).toBe('CRE News')
  })
})

// ─── generateArticleTitles ───────────────────────────────────────────────────

describe('generateArticleTitles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.GEMINI_API_KEY
  })

  it('returns empty arrays for empty input', async () => {
    expect(await generateArticleTitles([])).toEqual({ titles: [], descriptions: [] })
  })

  it('returns original titles and descriptions when GEMINI_API_KEY is not set', async () => {
    const result = await generateArticleTitles(articles)
    expect(result.titles).toEqual(articles.map(a => a.title))
    expect(result.descriptions).toEqual(articles.map(a => a.description))
  })

  it('returns generated titles and descriptions from Gemini', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall
      .mockResolvedValueOnce(geminiResponse('{"titles":["Boston Title","Miami Title"]}'))
      .mockResolvedValueOnce(geminiResponse('{"descriptions":["Boston desc.","Miami desc."]}'))
    const result = await generateArticleTitles(articles)
    expect(result.titles).toEqual(['Boston Title', 'Miami Title'])
    expect(result.descriptions).toEqual(['Boston desc.', 'Miami desc.'])
  })

  it('falls back to original titles and descriptions when Gemini throws', async () => {
    process.env.GEMINI_API_KEY = 'key'
    mockMakeGeminiCall.mockRejectedValue(new Error('error'))
    const result = await generateArticleTitles(articles)
    expect(result.titles).toEqual(articles.map(a => a.title))
    expect(result.descriptions).toEqual(articles.map(a => a.description))
  })
})
