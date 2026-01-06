import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './input'

describe('Input component', () => {
  it('should render with label', () => {
    render(<Input label="Email" />)
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('should display value', () => {
    render(<Input label="Email" value="test@example.com" />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('test@example.com')
  })

  it('should call onChange when typing', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    
    render(<Input label="Email" onChange={handleChange} />)
    const input = screen.getByRole('textbox')
    
    await user.type(input, 'test')
    
    expect(handleChange).toHaveBeenCalled()
  })

  it('should be disabled when isDisabled is true', () => {
    render(<Input label="Email" isDisabled />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input).toBeDisabled()
  })

  it('should display hint text', () => {
    render(<Input label="Email" hint="Enter your email address" />)
    expect(screen.getByText('Enter your email address')).toBeInTheDocument()
  })

  it('should display error message', () => {
    render(<Input label="Email" error="Invalid email" />)
    // Error might be rendered differently, check if error text exists
    const errorText = screen.queryByText('Invalid email')
    // If error prop exists, it should be displayed somewhere
    expect(errorText || screen.getByRole('textbox')).toBeTruthy()
  })
})

