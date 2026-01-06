# Testing Guide

## Quick Start

1. **Install dependencies:**
```bash
npm install
```

2. **Run tests (runs once and exits):**
```bash
npm test
```

3. **Run tests in watch mode (for local development):**
```bash
npm run test:watch
```

4. **Run tests with UI:**
```bash
npm run test:ui
```

## CI/CD Integration

Tests run automatically on every push and pull request via GitHub Actions.

### GitHub Actions Workflow

The workflow file is located at `.github/workflows/test.yml` and:
- Runs on all pushes and pull requests
- Uses Node.js 20
- Installs dependencies with `npm ci`
- Runs all tests with `npm test`

### Viewing Test Results

1. Go to your GitHub repository
2. Click on the "Actions" tab
3. Select the workflow run to see test results
4. Tests must pass before merging pull requests (if branch protection is enabled)

### Alternative CI/CD Platforms

If you're using a different CI/CD platform, the test command is:
```bash
npm ci && npm test
```

## Test Structure

```
src/
├── __tests__/
│   ├── setup.ts              # Test configuration
│   └── integration/          # Integration tests
│       └── post-creation.test.ts
├── app/
│   └── api/
│       ├── link-preview/
│       │   └── route.test.ts
│       └── upload/
│           └── route.test.ts
├── components/
│   └── base/
│       └── input/
│           └── input.test.tsx
└── utils/
    └── cx.test.ts
```

## What's Tested

### ✅ API Routes
- `/api/link-preview` - URL validation, error handling, response formatting
- `/api/upload` - File validation, S3 upload, error handling

### ✅ Utility Functions
- `cx` - Class name merging and deduplication

### ✅ Components
- `Input` - Rendering, user interaction, validation states

### ✅ Integration Tests
- Post creation flow examples

## Writing New Tests

### API Route Test Template

```typescript
import { describe, it, expect, vi } from 'vitest'
import { GET } from './route'
import { NextRequest } from 'next/server'

describe('GET /api/your-route', () => {
  it('should handle success case', async () => {
    const request = new NextRequest('http://localhost/api/your-route')
    const response = await GET(request)
    expect(response.status).toBe(200)
  })
})
```

### Component Test Template

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { YourComponent } from './your-component'

describe('YourComponent', () => {
  it('should render', () => {
    render(<YourComponent />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })
})
```

## Next Steps

1. **Add more API route tests** - Test all edge cases
2. **Test critical user flows** - Authentication, posting, profile updates
3. **Add component tests** - Start with form components
4. **Set up MSW** - For better Supabase mocking in integration tests
5. **Add E2E tests** - Using Playwright or Cypress for critical paths

## Tips

- Start with API routes - they're easiest and most valuable
- Test error cases, not just happy paths
- Keep tests focused - one assertion per test when possible
- Mock external dependencies (Supabase, S3, etc.)
- Use descriptive test names that explain what's being tested

