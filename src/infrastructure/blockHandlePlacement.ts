/** Keep Milkdown's block controls inside the detail pane when its gutter narrows. */
export function blockHandlePlacement(
  editorDom: HTMLElement,
  blockDom: HTMLElement,
): 'left' | 'top-start' {
  const pane = editorDom.closest('.module-content')
  if (!pane) return 'left'
  const gutter = editorDom.getBoundingClientRect().left - pane.getBoundingClientRect().left
  const handleWidth = blockDom.getBoundingClientRect().width || 68
  return gutter < handleWidth + 12 ? 'top-start' : 'left'
}
