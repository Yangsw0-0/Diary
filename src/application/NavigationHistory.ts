import type { DiaryDate } from '@/domain/DiaryDate'

export interface DiarySectionRef {
  readonly date: DiaryDate
  readonly key: string
  readonly ordinal: number
}

export type NavigationView =
  | {
      readonly moduleId: 'diary'
      readonly date: DiaryDate | null
      readonly section: DiarySectionRef | null
      readonly scrollTop: number
    }
  | { readonly moduleId: 'nodes'; readonly scrollTop: number }
  | { readonly moduleId: 'tags'; readonly key: string | null; readonly scrollTop: number }

export interface NavigationSnapshot {
  readonly current: NavigationView
  readonly canGoBack: boolean
  readonly canGoForward: boolean
}

/** Process-local browser-style history. Scroll updates do not add entries. */
export class NavigationHistory {
  private static readonly maxEntries = 200
  private past: NavigationView[] = []
  private future: NavigationView[] = []
  private currentView: NavigationView = {
    moduleId: 'diary',
    date: null,
    section: null,
    scrollTop: 0,
  }
  private snapshot: NavigationSnapshot = {
    current: this.currentView,
    canGoBack: false,
    canGoForward: false,
  }
  private listeners = new Set<() => void>()

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): NavigationSnapshot => this.snapshot

  get current(): NavigationView {
    return this.currentView
  }
  peekBack(): NavigationView | null {
    return this.past.at(-1) ?? null
  }
  peekForward(): NavigationView | null {
    return this.future.at(-1) ?? null
  }

  updateScroll(scrollTop: number): void {
    this.currentView = { ...this.currentView, scrollTop: Math.max(0, scrollTop) }
  }

  rewriteDate(from: DiaryDate, to: DiaryDate): void {
    const rewrite = (view: NavigationView): NavigationView =>
      view.moduleId === 'diary' && view.date?.equals(from)
        ? { ...view, date: to, section: view.section ? { ...view.section, date: to } : null }
        : view
    this.past = this.past.map(rewrite)
    this.currentView = rewrite(this.currentView)
    this.future = this.future.map(rewrite)
    this.publish()
  }

  dropDate(date: DiaryDate): void {
    const keep = (view: NavigationView) => view.moduleId !== 'diary' || !view.date?.equals(date)
    this.past = this.past.filter(keep)
    this.future = this.future.filter(keep)
    if (!keep(this.currentView)) {
      this.currentView = { moduleId: 'diary', date: null, section: null, scrollTop: 0 }
    }
    this.publish()
  }

  push(next: NavigationView): void {
    this.past.push(this.currentView)
    if (this.past.length > NavigationHistory.maxEntries) this.past.shift()
    this.currentView = next
    this.future = []
    this.publish()
  }

  back(): NavigationView | null {
    const previous = this.past.pop()
    if (!previous) return null
    this.future.push(this.currentView)
    if (this.future.length > NavigationHistory.maxEntries) this.future.shift()
    this.currentView = previous
    this.publish()
    return previous
  }

  forward(): NavigationView | null {
    const next = this.future.pop()
    if (!next) return null
    this.past.push(this.currentView)
    if (this.past.length > NavigationHistory.maxEntries) this.past.shift()
    this.currentView = next
    this.publish()
    return next
  }

  private publish(): void {
    this.snapshot = {
      current: this.currentView,
      canGoBack: this.past.length > 0,
      canGoForward: this.future.length > 0,
    }
    for (const listener of this.listeners) listener()
  }
}
