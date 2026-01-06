import { describe, it, expect } from 'vitest'
import { cx } from './cx'

describe('cx utility', () => {
  it('should merge class names', () => {
    const result = cx('text-primary', 'bg-secondary', 'text-primary')
    expect(result).toBe('bg-secondary text-primary')
  })

  it('should handle empty strings', () => {
    const result = cx('text-primary', '', 'bg-secondary')
    // Order doesn't matter, just check both classes are present
    expect(result).toContain('text-primary')
    expect(result).toContain('bg-secondary')
  })

  it('should handle undefined and null', () => {
    const result = cx('text-primary', undefined, null, 'bg-secondary')
    // Order doesn't matter, just check both classes are present
    expect(result).toContain('text-primary')
    expect(result).toContain('bg-secondary')
  })

  it('should handle conditional classes', () => {
    const isActive = true
    const result = cx('text-primary', isActive && 'bg-active', 'p-4')
    expect(result).toContain('bg-active')
    expect(result).toContain('text-primary')
    expect(result).toContain('p-4')
  })

  it('should deduplicate conflicting Tailwind classes', () => {
    const result = cx('text-primary', 'text-secondary')
    // Should only keep the last one
    expect(result).toBe('text-secondary')
  })
})

