# Testing Strategy

## Recommended Testing Stack

1. **Vitest** - Fast, modern test runner (better than Jest for Next.js)
2. **@testing-library/react** - Component testing
3. **@testing-library/jest-dom** - DOM matchers
4. **MSW (Mock Service Worker)** - API mocking for Supabase

## Priority Order (Start Here)

### 1. **API Routes** (Highest Priority - Start Here)
**Why:** Isolated, critical functionality, easy to test

**Files to test:**
- `src/app/api/upload/route.ts` - File upload validation
- `src/app/api/link-preview/route.ts` - URL validation and error handling

**What to test:**
- Input validation (missing file, invalid URL)
- Error handling
- Success responses
- Edge cases

### 2. **Utility Functions** (Second Priority)
**Why:** Pure functions, easy to test, used everywhere

**Files to test:**
- `src/utils/cx.ts` - Class name merging
- `src/utils/s3.ts` - S3 client configuration

**What to test:**
- Class merging logic
- Edge cases (empty strings, null values)

### 3. **Critical User Flows** (Third Priority)
**Why:** Core business logic, user-facing

**Flows to test:**
- User authentication (signup, login)
- Post creation (text, link, file upload)
- Profile updates
- Role selection

**How:** Integration tests with mocked Supabase

### 4. **Components** (Lower Priority - Do Last)
**Why:** More complex, requires more setup, changes frequently

**Components to prioritize:**
- Form components (Input, TextArea)
- Critical UI (FeedItem, Post creation)
- Navigation components

## Quick Start

1. Install dependencies:
```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw
```

2. Create `vitest.config.ts`

3. Start with API route tests (see examples below)

4. Add tests incrementally - don't try to test everything at once

## Example Test Structure

```
src/
├── app/
│   └── api/
│       └── link-preview/
│           └── route.test.ts
├── utils/
│   └── cx.test.ts
└── __tests__/
    └── setup.ts
```

