import { afterEach, expect, it, vi } from 'vitest'
import { SphereRenderer } from '@/features/wordcloud/SphereRenderer'
import { emptyCloud, mergeCloudWords } from '@/domain/WordCloud'
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function setup() {
  const frames = new Map<number, FrameRequestCallback>()
  let id = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }))
  vi.spyOn(performance, 'now').mockReturnValue(0)
  const context = {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    measureText: (s: string) => ({ width: s.length * 10 }),
  }
  const canvas = document.createElement('canvas')
  document.body.append(canvas)
  vi.spyOn(canvas, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 600,
    height: 600,
  } as DOMRect)
  let captured = false
  canvas.setPointerCapture = () => {
    captured = true
  }
  canvas.hasPointerCapture = () => captured
  canvas.releasePointerCapture = () => {
    captured = false
    dispatch('lostpointercapture', { pointerId: 1 })
  }
  function dispatch(type: string, fields: Record<string, number>) {
    const event = new Event(type)
    Object.assign(event, fields)
    canvas.dispatchEvent(event)
  }
  const step = (time: number) => {
    const tasks = [...frames.values()]
    frames.clear()
    for (const fn of tasks) fn(time)
  }
  const activate = vi.fn(),
    renderer = new SphereRenderer(canvas, activate, vi.fn())
  renderer.setPreferences({ ...emptyCloud().preferences, autoRotate: false, lineMode: 'mixed' })
  renderer.setWords(mergeCloudWords([{ id: 'a', text: '成长' }], [], false))
  renderer.setActive(true)
  return { frames, step, activate, renderer, canvas, context, dispatch }
}
it('only activates visible front words, and removes all queued work on destroy', () => {
  const { step, activate, renderer, canvas, dispatch, frames } = setup()
  step(600)
  dispatch('pointerdown', { pointerId: 1, button: 0, clientX: 300, clientY: 300 })
  dispatch('pointerup', { pointerId: 1, clientX: 300, clientY: 300 })
  expect(activate).toHaveBeenCalledOnce()
  for (let i = 0; i < 21; i++)
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
  step(1200)
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
  expect(activate).toHaveBeenCalledOnce()
  dispatch('pointerdown', { pointerId: 1, button: 0, clientX: 300, clientY: 300 })
  renderer.destroy()
  expect(canvas.hasPointerCapture(1)).toBe(false)
  expect(frames.size).toBe(0)
  dispatch('pointermove', { pointerId: 1, clientX: 100, clientY: 100 })
  expect(frames.size).toBe(0)
  canvas.remove()
})
it('retains drag inertia after normal pointer release, pauses inactive pages, and resumes safely', () => {
  const { step, renderer, canvas, dispatch, frames, context } = setup()
  step(600)
  context.fillText.mockClear()
  dispatch('pointerdown', { pointerId: 1, button: 0, clientX: 300, clientY: 300 })
  dispatch('pointermove', { pointerId: 1, clientX: 340, clientY: 315 })
  dispatch('pointerup', { pointerId: 1, clientX: 340, clientY: 315 })
  step(616)
  expect(frames.size).toBeGreaterThan(0)
  const first = context.fillText.mock.calls.at(-1)
  context.fillText.mockClear()
  step(632)
  expect(context.fillText.mock.calls.at(-1)).not.toEqual(first)
  renderer.setActive(false)
  expect(frames.size).toBe(0)
  renderer.setActive(true)
  expect(frames.size).toBe(1)
  renderer.destroy()
  canvas.remove()
})
it('does not auto-spin under reduced motion, and supports empty contents', () => {
  const setupResult = setup()
  setupResult.renderer.destroy()
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }))
  const { canvas, step, frames } = setupResult,
    renderer = new SphereRenderer(canvas, vi.fn(), vi.fn())
  renderer.setPreferences(emptyCloud().preferences)
  renderer.setWords([])
  renderer.setActive(true)
  step(600)
  expect(frames.size).toBe(0)
  renderer.destroy()
  canvas.remove()
})

it('does not restart layout animation when tag content updates without changing displayed words', () => {
  const { step, renderer, canvas, frames } = setup()
  step(600)
  expect(frames.size).toBe(0)
  vi.mocked(performance.now).mockReturnValue(600)
  renderer.setWords(
    mergeCloudWords([{ id: 'a', text: '成长' }], [{ key: '成长', displayTitle: '成长' }], true),
  )
  step(616)
  expect(frames.size).toBe(0)
  renderer.destroy()
  canvas.remove()
})
it('culls overlapping labels in a dense cloud while keeping a finite drawing workload', () => {
  const { step, renderer, canvas, context } = setup()
  renderer.setWords(
    mergeCloudWords(
      [],
      Array.from({ length: 2000 }, (_, i) => ({ key: `标签${i}`, displayTitle: `标签${i}` })),
      true,
    ),
  )
  step(600)
  expect(context.fillText.mock.calls.length).toBeGreaterThan(0)
  expect(context.fillText.mock.calls.length).toBeLessThan(300)
  renderer.destroy()
  canvas.remove()
})

it('repaints immediately after a resize instead of leaving the cleared canvas until the next frame', () => {
  const { step, renderer, canvas, context } = setup()
  step(600)
  vi.mocked(performance.now).mockReturnValue(600)
  context.fillText.mockClear()
  vi.mocked(canvas.getBoundingClientRect).mockReturnValue({
    left: 0,
    top: 0,
    width: 500,
    height: 600,
  } as DOMRect)
  window.dispatchEvent(new Event('resize'))
  expect(canvas.width).toBe(500)
  expect(context.fillText).toHaveBeenCalled()
  renderer.destroy()
  canvas.remove()
})
