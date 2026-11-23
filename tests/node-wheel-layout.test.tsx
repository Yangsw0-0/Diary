import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { NodeWheel } from '@/features/nodes/NodeWheel'
import { NodeWheelGeometry } from '@/application/NodeWheelGeometry'
import { wheelStep } from '@/application/nodeWheel'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('keeps date and connector inside their radial bands across supported content sizes', () => {
  for (const [width, height] of [
    [500, 220],
    [760, 520],
    [1280, 720],
    [2000, 1100],
  ] as const) {
    const g = new NodeWheelGeometry(width, height)
    expect(g.dateRadius - g.dateWidth / 2).toBeGreaterThan(g.dashedRadius)
    expect(g.dateRadius + g.dateWidth / 2).toBeLessThan(g.solidRadius)
    expect(g.cardRadius + g.dateOffset).toBe(g.dateRadius)
    expect(g.cardRadius + g.contentOffset).toBe(g.contentRadius)
    expect(g.contentRadius).toBeGreaterThan(g.solidRadius)
    expect(g.cardRadius + g.pointerOffset + g.pointerLength).toBeLessThan(g.contentRadius)
    expect(g.pointerLength).toBeLessThan(24)
    expect(g.cardRadius + g.cardWidth).toBeLessThanOrEqual(width - 24)
    // These same local radii stay valid at the top, centre and bottom of the wheel.
    for (const theta of [-wheelStep, 0, wheelStep]) {
      const angle = (theta * Math.PI) / 180
      expect(
        Math.hypot(g.dateRadius * Math.cos(angle), g.dateRadius * Math.sin(angle)),
      ).toBeCloseTo(g.dateRadius)
    }
  }
})
const events = [0, 1, 2].map((i) => ({
  id: String(i),
  title: '记录' + i,
  date: '2026-11-23',
  colorIndex: i,
  createdAt: '2026-11-23T00:00:00Z',
  updatedAt: '2026-11-23T00:00:00Z',
  nodeId: 'day',
}))
function fixture() {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  const edit = vi.fn()
  function Preview() {
    const [focused, setFocused] = useState('1')
    return (
      <NodeWheel
        events={events}
        focusedId={focused}
        onFocus={setFocused}
        onEdit={edit}
        colors={['#aaa', '#bbb', '#ccc']}
      />
    )
  }
  return { ...render(<Preview />), edit }
}
it('moves only arc texture with rotation, keeps circles fixed, and shares each card with its date and short pointer', () => {
  const { container, getByRole, edit } = fixture()
  const root = getByRole('group', { name: '事件轮盘' })
  const circles = [...container.querySelectorAll('circle')],
    dashed = circles[1]!,
    highlight = circles[2]!
  const radii = circles.map((c) => c.getAttribute('r'))
  const offset = Number(dashed.getAttribute('stroke-dashoffset'))
  expect(dashed.closest('.node-rotor')).toBeNull()
  fireEvent.keyDown(root, { key: 'ArrowDown' })
  expect(circles.map((c) => c.getAttribute('r'))).toEqual(radii)
  const advance = Number(dashed.getAttribute('stroke-dashoffset')) - offset
  expect(advance).toBeCloseTo((Number(dashed.getAttribute('r')) * wheelStep * Math.PI) / 180)
  expect(Number(highlight.getAttribute('stroke-dashoffset'))).toBeGreaterThan(0)
  fireEvent.keyDown(root, { key: 'ArrowUp' })
  expect(Number(dashed.getAttribute('stroke-dashoffset'))).toBe(offset)
  for (const item of container.querySelectorAll('.node-wheel-item')) {
    expect(item.querySelector('.node-event-date')).not.toBeNull()
    expect(item.querySelector('.node-event-text strong')).not.toBeNull()
    expect(item.querySelector('.node-pointer')).not.toBeNull()
  }
  expect(container.querySelectorAll('.node-wheel > .node-pointer')).toHaveLength(0)
  fireEvent.click(getByRole('button', { name: '编辑 记录1' }))
  expect(edit).toHaveBeenCalledWith('1')
})
it('uses the same texture phase for direct drag and vertical wheel, and ignores horizontal wheel', () => {
  vi.stubGlobal('PointerEvent', MouseEvent)
  const { container, getByRole } = fixture()
  const root = getByRole('group', { name: '事件轮盘' })
  const dashed = container.querySelector('.node-track-dashed')!
  const before = Number(dashed.getAttribute('stroke-dashoffset'))
  fireEvent.wheel(root, { deltaX: 64, deltaY: 0 })
  expect(Number(dashed.getAttribute('stroke-dashoffset'))).toBe(before)
  fireEvent.pointerDown(root, { clientY: 300 })
  fireEvent.pointerMove(root, { clientY: 275 })
  const afterDrag = Number(dashed.getAttribute('stroke-dashoffset'))
  expect(afterDrag).toBeGreaterThan(before)
  expect(root).toHaveAttribute('data-dragging', 'true')
  fireEvent.pointerUp(root)
  fireEvent.wheel(root, { deltaY: 48 })
  expect(Number(dashed.getAttribute('stroke-dashoffset'))).toBeGreaterThan(before)
})
