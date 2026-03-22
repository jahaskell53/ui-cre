import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingIndicator } from './loading-indicator'

describe('LoadingIndicator', () => {
  it('renders without crashing (line-simple)', () => {
    const { container } = render(<LoadingIndicator />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders line-spinner variant', () => {
    const { container } = render(<LoadingIndicator type="line-spinner" />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders dot-circle variant', () => {
    const { container } = render(<LoadingIndicator type="dot-circle" />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders with a label', () => {
    render(<LoadingIndicator label="Loading..." />)
    expect(screen.getByText('Loading...')).toBeTruthy()
  })

  it('renders all sizes', () => {
    for (const size of ['sm', 'md', 'lg', 'xl'] as const) {
      const { container } = render(<LoadingIndicator size={size} />)
      expect(container.firstChild).toBeTruthy()
    }
  })
})
