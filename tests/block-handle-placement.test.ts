import { expect, it } from 'vitest'
import { blockHandlePlacement } from '@/infrastructure/blockHandlePlacement'

it('places block controls above the paragraph when the pane gutter cannot fit them', () => {
  const pane = document.createElement('section')
  pane.className = 'module-content'
  const editor = document.createElement('div')
  const handle = document.createElement('div')
  pane.append(editor)
  Object.defineProperty(pane, 'getBoundingClientRect', {
    value: () => ({ left: 100 }),
  })
  Object.defineProperty(handle, 'getBoundingClientRect', {
    value: () => ({ width: 62 }),
  })
  Object.defineProperty(editor, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 136 }),
  })
  expect(blockHandlePlacement(editor, handle)).toBe('top-start')
  Object.defineProperty(editor, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 190 }),
  })
  expect(blockHandlePlacement(editor, handle)).toBe('left')
})
