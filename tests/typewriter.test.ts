import { afterEach, expect, it, vi } from 'vitest'
import type { EditorView } from '@milkdown/kit/prose/view'
import { TypewriterController } from '@/infrastructure/TypewriterController'
import { TypewriterPreferences } from '@/application/TypewriterPreferences'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})
function fixture(reduced = false) {
  const frames = new Map<number, FrameRequestCallback>()
  let next = 0,
    time = 0,
    head = 10
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    frames.set(++next, fn)
    return next
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('matchMedia', () => ({
    matches: reduced,
    addEventListener() {},
    removeEventListener() {},
  }))
  const resize: (() => void)[] = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize.push(callback)
      }
      observe() {}
      disconnect() {}
    },
  )
  const viewport = document.createElement('section'),
    toolbar = document.createElement('header'),
    container = document.createElement('div'),
    dom = document.createElement('div'),
    anchor = document.createElement('p')
  toolbar.className = 'diary-editor-toolbar'
  dom.append(anchor)
  container.append(dom)
  viewport.append(toolbar, container)
  document.body.append(viewport)
  viewport.scrollTop = 500
  Object.defineProperties(viewport, {
    clientHeight: { value: 600, configurable: true },
    scrollHeight: { value: 10000 },
  })
  Object.defineProperty(toolbar, 'offsetHeight', { value: 54 })
  const rect = (top: number, bottom: number) => ({
    top,
    bottom,
    left: 0,
    right: 500,
    width: 500,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON() {},
  })
  viewport.getBoundingClientRect = () => rect(0, 600)
  toolbar.getBoundingClientRect = () => rect(0, 54)
  anchor.getBoundingClientRect = () =>
    rect(
      54 +
        (Number.parseFloat(container.style.getPropertyValue('--typewriter-padding')) || 0) -
        viewport.scrollTop,
      100,
    )
  const dispatch = vi.fn()
  const view = {
    dom,
    state: { selection: { head, empty: true } },
    coordsAtPos: () => {
      const top =
        54 +
        (Number.parseFloat(container.style.getPropertyValue('--typewriter-padding')) || 0) +
        head * 24 -
        viewport.scrollTop
      return { top, bottom: top + 24 }
    },
    dispatch,
  } as unknown as EditorView
  const controller = new TypewriterController(view, viewport, container)
  const step = () => {
    time += 16
    const pending = [...frames.values()]
    frames.clear()
    for (const fn of pending) fn(time)
  }
  const settle = () => {
    for (let i = 0; i < 200 && frames.size; i++) step()
    expect(frames.size).toBe(0)
  }
  return {
    controller,
    viewport,
    container,
    anchor,
    frames,
    dispatch,
    step,
    settle,
    resize,
    select: (value: number) => {
      head = value
      controller.follow()
    },
  }
}
it('enables without a visual jump and smoothly centers an offscreen caret with only one RAF', () => {
  const f = fixture(),
    before = f.anchor.getBoundingClientRect().top
  f.controller.setEnabled(true)
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  expect(f.frames.size).toBe(1)
  const start = f.viewport.scrollTop
  f.step()
  expect(f.viewport.scrollTop).toBeLessThan(start)
  expect(f.viewport.scrollTop).toBeGreaterThan(252)
  f.settle()
  expect(f.viewport.scrollTop).toBeCloseTo(252)
  expect(f.dispatch).not.toHaveBeenCalled()
  f.controller.destroy()
})
it('retargets rapid Enter/IME updates continuously and does not start competing animations', () => {
  const f = fixture()
  f.controller.setEnabled(true)
  f.settle()
  f.select(11)
  expect(f.viewport.scrollTop).toBe(252)
  f.step()
  const intermediate = f.viewport.scrollTop
  expect(intermediate).toBeGreaterThan(252)
  expect(intermediate).toBeLessThan(276)
  for (let i = 12; i < 30; i++) f.select(i)
  expect(f.frames.size).toBe(1)
  let last = f.viewport.scrollTop
  for (let i = 0; i < 200 && f.frames.size; i++) {
    f.step()
    expect(f.viewport.scrollTop).toBeGreaterThanOrEqual(last)
    expect(f.viewport.scrollTop).toBeLessThanOrEqual(708)
    last = f.viewport.scrollTop
  }
  expect(f.viewport.scrollTop).toBeCloseTo(708)
  expect(f.frames.size).toBe(0)
  f.controller.destroy()
})
it('yields to manual reading and resumes only on editing or selection change', () => {
  const f = fixture()
  f.controller.setEnabled(true)
  f.step()
  const wheel = new WheelEvent('wheel', { deltaY: 60, cancelable: true })
  f.viewport.dispatchEvent(wheel)
  expect(wheel.defaultPrevented).toBe(false)
  expect(f.frames.size).toBe(0)
  f.viewport.scrollTop = 900
  for (const callback of f.resize) callback()
  expect(f.viewport.scrollTop).toBe(900)
  expect(f.frames.size).toBe(0)
  f.select(12)
  expect(f.frames.size).toBe(1)
  f.settle()
  expect(f.viewport.scrollTop).toBeCloseTo(300)
  f.controller.destroy()
})
it('removes layout-only padding and cancels callbacks on disable/destroy', () => {
  const f = fixture()
  f.controller.setEnabled(true)
  f.settle()
  const before = f.anchor.getBoundingClientRect().top
  f.controller.setEnabled(false)
  expect(f.container.dataset.typewriter).toBeUndefined()
  expect(f.container.style.getPropertyValue('--typewriter-padding')).toBe('')
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  f.select(100)
  expect(f.frames.size).toBe(0)
  f.controller.destroy()
  f.controller.follow()
  expect(f.frames.size).toBe(0)
})
it('centers first/last lines with layout padding and respects reduced motion', () => {
  const f = fixture(true)
  f.controller.setEnabled(true)
  f.select(0)
  f.step()
  expect(f.viewport.scrollTop).toBe(12)
  expect(f.frames.size).toBe(0)
  f.select(100)
  f.step()
  expect(f.viewport.scrollTop).toBe(2412)
  expect(f.frames.size).toBe(0)
  f.controller.destroy()
})
it('persists only the mode and tolerates missing or corrupt settings', () => {
  const map = new Map<string, string>(),
    storage = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value)
      },
    }
  expect(TypewriterPreferences.load(storage)).toBe(false)
  TypewriterPreferences.save(storage, true)
  expect(TypewriterPreferences.load(storage)).toBe(true)
  TypewriterPreferences.save(storage, false)
  expect(TypewriterPreferences.load(storage)).toBe(false)
  map.set(TypewriterPreferences.key, 'bad')
  expect(TypewriterPreferences.load(storage)).toBe(false)
  expect(
    TypewriterPreferences.load({
      getItem: () => {
        throw Error('blocked')
      },
    }),
  ).toBe(false)
})
it('anchors actual document content instead of the absolute virtual cursor decoration', () => {
  const f = fixture(),
    dom = f.anchor.parentElement!,
    cursor = document.createElement('div')
  cursor.className = 'prosemirror-virtual-cursor'
  cursor.style.position = 'absolute'
  cursor.getBoundingClientRect = () => ({ top: 0 }) as DOMRect
  dom.prepend(cursor)
  const before = f.anchor.getBoundingClientRect().top
  f.controller.setEnabled(true)
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  expect(cursor.style.height).toBe('24px')
  f.settle()
  expect(f.viewport.scrollTop).toBeCloseTo(252)
  f.controller.destroy()
})
