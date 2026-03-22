import { describe, it, expect } from 'vitest'
import { cn, sortCx } from './utils'

describe('cn utility', () => {
  it('merges class names', () => {
    const result = cn('text-primary', 'bg-secondary', 'text-primary')
    expect(result).toBe('bg-secondary text-primary')
  })

  it('handles empty strings', () => {
    const result = cn('text-primary', '', 'bg-secondary')
    expect(result).toContain('text-primary')
    expect(result).toContain('bg-secondary')
  })

  it('handles undefined and null', () => {
    const result = cn('text-primary', undefined, null, 'bg-secondary')
    expect(result).toContain('text-primary')
    expect(result).toContain('bg-secondary')
  })

  it('handles conditional classes', () => {
    const isActive = true
    const result = cn('text-primary', isActive && 'bg-active', 'p-4')
    expect(result).toContain('bg-active')
    expect(result).toContain('text-primary')
    expect(result).toContain('p-4')
  })

  it('deduplicates conflicting Tailwind classes', () => {
    const result = cn('text-primary', 'text-secondary')
    expect(result).toBe('text-secondary')
  })

  it('handles object syntax from clsx', () => {
    const result = cn({ 'bg-active': true, 'bg-inactive': false }, 'text-primary')
    expect(result).toContain('bg-active')
    expect(result).not.toContain('bg-inactive')
  })

})

describe('sortCx utility', () => {
  it('returns the object unchanged', () => {
    const styles = { base: 'text-sm font-medium', active: 'bg-primary' }
    expect(sortCx(styles)).toBe(styles)
  })
})
