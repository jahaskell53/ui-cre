import { describe, it, expect, vi, beforeEach } from 'vitest'
import { recalculateNetworkStrengthForUser } from './network-strength'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSupabase(people: unknown[] | null = [], fetchError: unknown = null) {
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })

  const mockEq = vi.fn().mockResolvedValue({ data: people, error: fetchError })
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })

  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    update: mockUpdate,
  })

  return { supabase: { from: mockFrom } as any, mockFrom, mockUpdate }
}

function makePerson(id: string, timeline: unknown[]) {
  return { id, timeline }
}

function email() { return { type: 'email' } }
function meeting() { return { type: 'meeting' } }
function other() { return { type: 'note' } }

// ─── getInteractionCount (tested via recalculate) ─────────────────────────────

describe('interaction count', () => {
  it('counts emails and meetings', async () => {
    const { supabase, mockUpdate } = makeSupabase([
      makePerson('p1', [email(), email(), meeting()]),
    ])
    await recalculateNetworkStrengthForUser(supabase, 'user-1')
    // 3 interactions, only 1 person → percentile = 1.0 → HIGH
    expect(mockUpdate).toHaveBeenCalledWith({ network_strength: 'HIGH' })
  })

  it('ignores non-email, non-meeting timeline items', async () => {
    const { supabase, mockUpdate } = makeSupabase([
      makePerson('p1', [other(), other(), other()]),
    ])
    await recalculateNetworkStrengthForUser(supabase, 'user-1')
    // 0 interactions → LOW
    expect(mockUpdate).toHaveBeenCalledWith({ network_strength: 'LOW' })
  })

  it('handles null timeline', async () => {
    const { supabase, mockUpdate } = makeSupabase([
      makePerson('p1', null as any),
    ])
    await recalculateNetworkStrengthForUser(supabase, 'user-1')
    expect(mockUpdate).toHaveBeenCalledWith({ network_strength: 'LOW' })
  })

  it('handles empty timeline', async () => {
    const { supabase, mockUpdate } = makeSupabase([
      makePerson('p1', []),
    ])
    await recalculateNetworkStrengthForUser(supabase, 'user-1')
    expect(mockUpdate).toHaveBeenCalledWith({ network_strength: 'LOW' })
  })
})

// ─── network strength assignment ─────────────────────────────────────────────

describe('network strength ranking', () => {
  it('assigns LOW to person with zero interactions regardless of percentile', async () => {
    // 5 people: p1 has 0, the rest have interactions
    // p1 would be rank 5/5 = percentile 0.2 which is the LOW boundary,
    // but zero interactions always forces LOW
    const { supabase, mockFrom } = makeSupabase([
      makePerson('p1', []),
      makePerson('p2', [email()]),
      makePerson('p3', [email()]),
      makePerson('p4', [email()]),
      makePerson('p5', [email()]),
    ])

    const updateCalls: Record<string, string> = {}
    mockFrom.mockImplementation((table: string) => {
      if (table === 'people') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                makePerson('p1', []),
                makePerson('p2', [email()]),
                makePerson('p3', [email()]),
                makePerson('p4', [email()]),
                makePerson('p5', [email()]),
              ],
              error: null
            })
          }),
          update: vi.fn().mockImplementation((val: { network_strength: string }) => ({
            eq: vi.fn().mockImplementation((_col: string, id: string) => {
              updateCalls[id] = val.network_strength
              return Promise.resolve({ error: null })
            })
          }))
        }
      }
      return {}
    })

    await recalculateNetworkStrengthForUser(supabase, 'user-1')
    expect(updateCalls['p1']).toBe('LOW')
  })

  it('assigns HIGH to top 20% by interaction count', async () => {
    // 5 people: top 20% (1 person) → HIGH
    // Percentile for rank 1 (highest): (5-0)/5 = 1.0 > 0.8 → HIGH
    const people = [
      makePerson('p1', [email(), email(), email(), email(), email()]), // 5 interactions
      makePerson('p2', [email(), email()]),
      makePerson('p3', [email(), email()]),
      makePerson('p4', [email()]),
      makePerson('p5', [email()]),
    ]

    const updateCalls: Record<string, string> = {}
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'people') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: people, error: null })
            }),
            update: vi.fn().mockImplementation((val: { network_strength: string }) => ({
              eq: vi.fn().mockImplementation((_col: string, id: string) => {
                updateCalls[id] = val.network_strength
                return Promise.resolve({ error: null })
              })
            }))
          }
        }
        return {}
      })
    } as any

    await recalculateNetworkStrengthForUser(mockSupabase, 'user-1')
    expect(updateCalls['p1']).toBe('HIGH')
  })

  it('assigns LOW to bottom 20% by interaction count', async () => {
    // 5 people: bottom 20% (1 person, rank 5) → percentile = (5-4)/5 = 0.2 → LOW
    const people = [
      makePerson('p1', [email(), email(), email(), email(), email()]),
      makePerson('p2', [email(), email()]),
      makePerson('p3', [email(), email()]),
      makePerson('p4', [email()]),
      makePerson('p5', [meeting()]), // 1 interaction, rank 5 → percentile 0.2 → LOW
    ]

    const updateCalls: Record<string, string> = {}
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'people') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: people, error: null })
            }),
            update: vi.fn().mockImplementation((val: { network_strength: string }) => ({
              eq: vi.fn().mockImplementation((_col: string, id: string) => {
                updateCalls[id] = val.network_strength
                return Promise.resolve({ error: null })
              })
            }))
          }
        }
        return {}
      })
    } as any

    await recalculateNetworkStrengthForUser(mockSupabase, 'user-1')
    expect(updateCalls['p5']).toBe('LOW')
  })

  it('assigns MEDIUM to middle 60%', async () => {
    // 5 people: ranks 2-4 → percentiles 0.8, 0.6, 0.4 → all MEDIUM
    const people = [
      makePerson('p1', [email(), email(), email(), email(), email()]),
      makePerson('p2', [email(), email(), email()]), // rank 2 → percentile 0.8 → boundary (not > 0.8) → MEDIUM
      makePerson('p3', [email(), email()]),          // rank 3 → percentile 0.6 → MEDIUM
      makePerson('p4', [email()]),                   // rank 4 → percentile 0.4 → MEDIUM
      makePerson('p5', [meeting()]),
    ]

    const updateCalls: Record<string, string> = {}
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'people') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: people, error: null })
            }),
            update: vi.fn().mockImplementation((val: { network_strength: string }) => ({
              eq: vi.fn().mockImplementation((_col: string, id: string) => {
                updateCalls[id] = val.network_strength
                return Promise.resolve({ error: null })
              })
            }))
          }
        }
        return {}
      })
    } as any

    await recalculateNetworkStrengthForUser(mockSupabase, 'user-1')
    expect(updateCalls['p2']).toBe('MEDIUM')
    expect(updateCalls['p3']).toBe('MEDIUM')
    expect(updateCalls['p4']).toBe('MEDIUM')
  })
})

// ─── early returns / error handling ───────────────────────────────────────────

describe('recalculateNetworkStrengthForUser — error handling', () => {
  it('returns early without updating when there are no people', async () => {
    const { supabase, mockUpdate } = makeSupabase([])
    await recalculateNetworkStrengthForUser(supabase, 'user-1')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns early without updating when people fetch errors', async () => {
    const { supabase, mockUpdate } = makeSupabase(null, { message: 'DB error' })
    await recalculateNetworkStrengthForUser(supabase, 'user-1')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('does not throw when an update fails', async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: [makePerson('p1', [email()])], error: null })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    const mockUpdateEq = vi.fn().mockRejectedValue(new Error('update failed'))
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect, update: mockUpdate })

    await expect(
      recalculateNetworkStrengthForUser({ from: mockFrom } as any, 'user-1')
    ).resolves.toBeUndefined()
  })
})
