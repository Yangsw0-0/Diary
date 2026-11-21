import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NodesSession } from '@/application/NodesSession'
import { NodePalette } from '@/application/NodePalette'
import { NodesPanel } from '@/features/nodes/NodesPanel'
afterEach(cleanup)
it('adds two events to one date, renders the canvas and edits via keyboard', async () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scroll })
  const session = new NodesSession({
    read: async () => null,
    save: async (json) => ({ json, revision: 'r' }),
    backup: async () => null,
  })
  render(<NodesPanel session={session} palette={new NodePalette(localStorage)} />)
  const add = await screen.findByRole('button', { name: '＋ 添加事件' })
  await waitFor(() => expect(add).not.toBeDisabled())
  fireEvent.click(add)
  fireEvent.change(screen.getByLabelText('日期'), { target: { value: '2026-01-01' } })
  fireEvent.change(screen.getByLabelText('时间概述'), { target: { value: '初见' } })
  fireEvent.click(screen.getByRole('button', { name: '保存事件' }))
  expect(await screen.findByRole('group', { name: '事件轮盘' })).toBeInTheDocument()
  const wheel = screen.getByRole('group', { name: '事件轮盘' })
  fireEvent.pointerDown(wheel, { clientY: 400, pointerId: 1 })
  fireEvent.pointerMove(wheel, { clientY: 320, pointerId: 1 })
  fireEvent.pointerUp(wheel, { pointerId: 1 })
  fireEvent.click(screen.getByRole('button', { name: '初见 颜色 2' }))
  expect(
    session.getSnapshot().document.nodes[0]?.events.find((event) => event.title === '初见')
      ?.colorIndex,
  ).toBe(1)
  fireEvent.click(add)
  fireEvent.change(screen.getByLabelText('日期'), { target: { value: '2026-01-01' } })
  fireEvent.change(screen.getByLabelText('时间概述'), { target: { value: '再见' } })
  fireEvent.click(screen.getByRole('button', { name: '保存事件' }))
  expect(session.getSnapshot().document.nodes).toHaveLength(1)
  expect(session.getSnapshot().document.nodes[0]?.events).toHaveLength(2)
  fireEvent.keyDown(screen.getByRole('group', { name: '事件轮盘' }), { key: 'Enter' })
  expect(screen.getByRole('dialog', { name: '编辑事件' })).toBeInTheDocument()
  await session.flush()
  session.reset()
  vi.unstubAllGlobals()
})
