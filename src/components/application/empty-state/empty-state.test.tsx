import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from './empty-state'

describe('EmptyState', () => {
  it('renders root without crashing', () => {
    const { container } = render(<EmptyState />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders with title and description', () => {
    render(
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Title>No results found</EmptyState.Title>
          <EmptyState.Description>Try adjusting your search.</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    )
    expect(screen.getByText('No results found')).toBeTruthy()
    expect(screen.getByText('Try adjusting your search.')).toBeTruthy()
  })

  it('renders sm size variant', () => {
    const { container } = render(<EmptyState size="sm"><EmptyState.Header /></EmptyState>)
    expect(container.firstChild).toBeTruthy()
  })
})
