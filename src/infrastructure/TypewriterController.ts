import type { EditorView } from '@milkdown/kit/prose/view'

/** One critically damped scroll follower, outside React and never modifying the document. */
export class TypewriterController {
  private readonly view: EditorView
  private readonly viewport: HTMLElement
  private readonly container: HTMLElement
  private readonly toolbar: HTMLElement | null
  private readonly observer: ResizeObserver | null
  private readonly motion = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? {
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }
  private enabled = false
  private disposed = false
  private reading = false
  private frame = 0
  private previousTime = 0
  private velocity = 0
  private padding = ''

  constructor(view: EditorView, viewport: HTMLElement, container: HTMLElement) {
    this.view = view
    this.viewport = viewport
    this.container = container
    this.toolbar = viewport.querySelector('.diary-editor-toolbar')
    this.observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(this.resize)
    this.observer?.observe(viewport)
    this.observer?.observe(view.dom)
    if (this.toolbar) this.observer?.observe(this.toolbar)
    viewport.addEventListener('wheel', this.manual, { passive: true })
    viewport.addEventListener('touchmove', this.manual, { passive: true })
    viewport.addEventListener('pointerdown', this.pointer)
    view.dom.addEventListener('compositionend', this.edited)
    this.motion.addEventListener('change', this.motionChanged)
  }

  get active(): boolean {
    return this.enabled && !this.disposed
  }

  setEnabled(enabled: boolean): void {
    if (this.disposed || enabled === this.enabled) return
    this.stop()
    this.enabled = enabled
    this.reading = false
    this.preserveLayout(() => {
      if (enabled) {
        this.container.dataset.typewriter = 'true'
        this.setPadding()
      } else {
        delete this.container.dataset.typewriter
        this.container.style.removeProperty('--typewriter-padding')
        this.padding = ''
      }
    })
    if (enabled) this.follow()
  }

  /** Called on real ProseMirror document/selection updates, including IME transactions. */
  follow = (): void => {
    if (!this.active) return
    if (!this.view.state.selection.empty) {
      this.manual()
      return
    }
    this.reading = false
    this.schedule()
  }
  private edited = () => this.follow()
  private pointer = (event: PointerEvent) => {
    if (event.target === this.viewport) this.manual() // native scrollbar drag
  }
  private manual = () => {
    this.reading = true
    this.stop()
  }
  private motionChanged = () => {
    if (!this.reading) this.schedule()
  }
  private visible(): boolean {
    return this.viewport.clientHeight > 0 && !this.view.dom.closest('[hidden]')
  }
  private setPadding(): void {
    const usable = this.viewport.clientHeight - (this.toolbar?.offsetHeight ?? 0)
    const value = Math.max(0, usable / 2) + 'px'
    if (value !== this.padding) {
      this.padding = value
      this.container.style.setProperty('--typewriter-padding', value)
    }
  }
  private preserveLayout(change: () => void): void {
    // The first DOM child can be Crepe's absolute cursor widget, not document content.
    const modelNode = this.view.nodeDOM?.(0)
    const anchor =
      modelNode instanceof Element
        ? modelNode
        : [...this.view.dom.children].find(
            (node) => !node.classList.contains('prosemirror-virtual-cursor'),
          )
    const before = anchor?.getBoundingClientRect().top
    change()
    if (before !== undefined && anchor)
      this.viewport.scrollTop += anchor.getBoundingClientRect().top - before
    this.syncVirtualCaret()
    this.container
      .querySelectorAll('.milkdown-block-handle')
      .forEach((handle) => handle.setAttribute('data-show', 'false'))
  }
  private caretCoords() {
    const selection = this.view.dom.ownerDocument.getSelection()
    if (
      selection?.isCollapsed &&
      selection.anchorNode &&
      this.view.dom.contains(selection.anchorNode) &&
      selection.rangeCount
    ) {
      const rectangles = selection.getRangeAt(0).getClientRects()
      const rect = rectangles[rectangles.length - 1]
      if (rect?.height) return rect
    }
    return this.view.coordsAtPos(this.view.state.selection.head)
  }
  /** Keep Crepe's decoration aligned after CSS padding changes, without a transaction. */
  private syncVirtualCaret(): void {
    const cursor = this.view.dom.querySelector<HTMLElement>(':scope > .prosemirror-virtual-cursor')
    if (!cursor || !this.view.state.selection.empty) return
    try {
      const caret = this.caretCoords(),
        editor = this.view.dom.getBoundingClientRect()
      cursor.style.top = caret.top - editor.top + 'px'
      cursor.style.left = caret.left - editor.left + 'px'
      cursor.style.height = caret.bottom - caret.top + 'px'
    } catch {
      /* An editor being destroyed has no measurable selection. */
    }
  }
  private resize = () => {
    if (!this.active || !this.visible()) {
      this.stop()
      return
    }
    this.preserveLayout(() => this.setPadding())
    if (!this.reading) this.schedule()
  }
  private schedule(): void {
    if (this.frame || !this.active || !this.visible()) return
    this.frame = requestAnimationFrame(this.tick)
  }
  private tick = (time: number) => {
    this.frame = 0
    if (!this.active || this.reading || !this.visible()) {
      this.stop()
      return
    }
    const viewport = this.viewport,
      rect = viewport.getBoundingClientRect()
    const toolbarBottom = this.toolbar?.getBoundingClientRect().bottom ?? rect.top
    const top = Math.max(rect.top, toolbarBottom),
      bottom = rect.top + viewport.clientHeight
    let caret: { top: number; bottom: number }
    try {
      caret = this.caretCoords()
    } catch {
      this.stop()
      return
    }
    const current = viewport.scrollTop
    this.syncVirtualCaret()
    const target = Math.max(
      0,
      Math.min(
        viewport.scrollHeight - viewport.clientHeight,
        current + (caret.top + caret.bottom) / 2 - (top + bottom) / 2,
      ),
    )
    const error = target - current
    if (this.motion.matches || Math.abs(error) < 0.5) {
      viewport.scrollTop = target
      this.stop()
      return
    }
    const dt = this.previousTime
      ? Math.min(0.04, Math.max(0.001, (time - this.previousTime) / 1000))
      : 0.016
    this.previousTime = time
    if (this.velocity * error < 0) this.velocity = 0
    const omega = 18,
      displacement = current - target
    const impulse = (this.velocity + omega * displacement) * dt,
      decay = Math.exp(-omega * dt)
    const candidate = target + (displacement + impulse) * decay
    this.velocity = (this.velocity - omega * impulse) * decay
    // Retargeting and quantized scrollTop must never overshoot or oscillate.
    const next = Math.max(Math.min(current, target), Math.min(Math.max(current, target), candidate))
    viewport.scrollTop =
      Math.abs(next - current) < 0.5
        ? current + Math.sign(error) * Math.min(Math.abs(error), 0.5)
        : next
    this.schedule()
  }
  private stop(): void {
    if (this.frame) cancelAnimationFrame(this.frame)
    this.frame = 0
    this.previousTime = 0
    this.velocity = 0
  }
  destroy(): void {
    if (this.disposed) return
    this.setEnabled(false)
    this.disposed = true
    this.observer?.disconnect()
    this.viewport.removeEventListener('wheel', this.manual)
    this.viewport.removeEventListener('touchmove', this.manual)
    this.viewport.removeEventListener('pointerdown', this.pointer)
    this.view.dom.removeEventListener('compositionend', this.edited)
    this.motion.removeEventListener('change', this.motionChanged)
  }
}
