import { expect, it, vi } from 'vitest'
import { EditorReadiness } from '@/application/EditorReadiness'
import { AdjacentDiaryNavigator } from '@/application/AdjacentDiaryNavigator'

it('rebounds an armed pull when there is no adjacent diary', () => {
  const gesture = new AdjacentDiaryNavigator()
  for (let i = 0; i < 5; i++) gesture.add(64, 0, false, true, 500, i * 10, true)
  expect(gesture.release(false)).toBe('rebound')
  expect(gesture.isLocked).toBe(false)
})

it('cancels old readiness requests and rejects stale editor notifications', async () => {
  const readiness = new EditorReadiness()
  readiness.begin('A')
  const oldToken = readiness.token
  const old = readiness.wait('A')
  readiness.begin('B')
  expect(await old).toBe('cancelled')
  const current = readiness.wait('B')
  readiness.markReady('A', oldToken)
  readiness.markReady('B', readiness.token)
  expect(await current).toBe('ready')
})

it('reports timeout rather than editor success', async () => {
  vi.useFakeTimers()
  try {
    const readiness = new EditorReadiness()
    readiness.begin('A')
    const pending = readiness.wait('A')
    await vi.advanceTimersByTimeAsync(2500)
    expect(await pending).toBe('timeout')
  } finally {
    vi.useRealTimers()
  }
})
