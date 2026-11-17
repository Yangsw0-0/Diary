import { DiaryDate } from '@/domain/DiaryDate'
import type { DiaryEntry } from '@/domain/DiaryEntry'
import { DiaryError } from '@/domain/DiaryError'
import type { DiaryFileFailure } from '@/domain/DiaryRepository'
import type { DiaryService } from './DiaryService'

export interface DiaryDraft {
  readonly date: DiaryDate
  readonly markdown: string
  readonly revision: string | null
  readonly version: number
  readonly savedVersion: number
  readonly saving: boolean
  readonly error: DiaryError | null
}

export interface DiarySessionSnapshot {
  readonly entries: readonly DiaryEntry[]
  readonly failures: readonly DiaryFileFailure[]
  readonly selected: DiaryDraft | null
  readonly loading: boolean
  readonly error: DiaryError | null
}

function diaryError(reason: unknown, fallback: string): DiaryError {
  if (reason instanceof DiaryError) return reason
  return new DiaryError('unexpected', reason instanceof Error ? reason.message : fallback, {
    cause: reason,
  })
}

export function todayDate(now: Date = new Date()): DiaryDate {
  return DiaryDate.parse(
    `${now.getFullYear().toString().padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
  )
}

/** One workspace edit session. Disk writes are serialized, and failed writes retain the draft. */
export class DiarySession {
  private readonly listeners = new Set<() => void>()
  private snapshot: DiarySessionSnapshot = {
    entries: [],
    failures: [],
    selected: null,
    loading: true,
    error: null,
  }
  private timer: ReturnType<typeof setTimeout> | null = null
  private savePromise: Promise<boolean> | null = null
  private composing = false
  private generation = 0
  private navigationSequence = 0

  private readonly service: DiaryService
  private readonly debounceMs: number

  constructor(service: DiaryService, debounceMs = 800) {
    this.service = service
    this.debounceMs = debounceMs
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): DiarySessionSnapshot => this.snapshot

  private set(next: Partial<DiarySessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...next }
    this.listeners.forEach((listener) => listener())
  }

  private updateDraft(next: Partial<DiaryDraft>): void {
    if (this.snapshot.selected) this.set({ selected: { ...this.snapshot.selected, ...next } })
  }

  reset(): void {
    this.clearTimer()
    this.generation++
    this.navigationSequence++
    this.composing = false
    this.set({ entries: [], failures: [], selected: null, loading: true, error: null })
  }

  async load(): Promise<void> {
    const generation = this.generation
    this.set({ loading: true, error: null })
    try {
      const scan = await this.service.list()
      if (generation === this.generation)
        this.set({ entries: scan.entries, failures: scan.failures, loading: false })
    } catch (reason) {
      if (generation === this.generation)
        this.set({ loading: false, error: diaryError(reason, '读取日记列表失败') })
    }
  }

  async refresh(): Promise<boolean> {
    if (!(await this.flush())) return false
    await this.load()
    return !this.snapshot.error
  }

  async open(date: DiaryDate): Promise<boolean> {
    const sequence = ++this.navigationSequence
    if (this.snapshot.selected?.date.equals(date)) return true
    if (!(await this.flush())) return false
    if (sequence !== this.navigationSequence) return false
    const generation = this.generation
    this.set({ error: null })
    try {
      const entry = await this.service.read(date)
      if (generation !== this.generation || sequence !== this.navigationSequence) return false
      this.set({
        selected: {
          date,
          markdown: entry.markdown,
          revision: entry.revision,
          version: 0,
          savedVersion: 0,
          saving: false,
          error: null,
        },
      })
      return true
    } catch (reason) {
      if (generation === this.generation && sequence === this.navigationSequence)
        this.set({ selected: null, error: diaryError(reason, '读取日记失败') })
      return false
    }
  }

  async create(date: DiaryDate = todayDate()): Promise<boolean> {
    if (this.snapshot.entries.some((entry) => entry.date.equals(date))) return this.open(date)
    const sequence = ++this.navigationSequence
    if (this.snapshot.selected?.date.equals(date)) return true
    if (!(await this.flush())) return false
    if (sequence !== this.navigationSequence) return false
    this.set({
      selected: {
        date,
        markdown: `# ${date.toString()}\n\n`,
        revision: null,
        version: 1,
        savedVersion: 0,
        saving: false,
        error: null,
      },
      error: null,
    })
    this.scheduleSave()
    return true
  }

  edit(markdown: string): void {
    const selected = this.snapshot.selected
    if (!selected || markdown === selected.markdown) return
    this.updateDraft({ markdown, version: selected.version + 1, error: null })
    if (!this.composing) this.scheduleSave()
  }

  setComposing(value: boolean): void {
    this.composing = value
    if (value) this.clearTimer()
    else if (this.isDirty()) this.scheduleSave()
  }

  isDirty(): boolean {
    const selected = this.snapshot.selected
    return !!selected && (selected.version !== selected.savedVersion || selected.saving)
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private scheduleSave(): void {
    this.clearTimer()
    this.timer = setTimeout(() => {
      void this.flush()
    }, this.debounceMs)
  }

  async flush(): Promise<boolean> {
    this.clearTimer()
    if (this.composing) return false
    if (this.savePromise) return this.savePromise
    if (!this.isDirty()) return true
    const run = this.saveLoop()
    this.savePromise = run
    try {
      return await run
    } finally {
      this.savePromise = null
    }
  }

  private async saveLoop(): Promise<boolean> {
    while (
      this.snapshot.selected &&
      this.snapshot.selected.version !== this.snapshot.selected.savedVersion
    ) {
      const draft = this.snapshot.selected
      const expectation =
        draft.revision === null
          ? { kind: 'new' as const }
          : { kind: 'match' as const, revision: draft.revision }
      this.updateDraft({ saving: true, error: null })
      try {
        const saved = await this.service.save(draft.date, draft.markdown, expectation)
        const current = this.snapshot.selected
        if (!current || !current.date.equals(draft.date)) return false
        this.updateDraft({
          revision: saved.revision,
          savedVersion: draft.version,
          saving: false,
          error: null,
        })
        const entries = this.snapshot.entries.filter((entry) => !entry.date.equals(saved.date))
        entries.push(saved)
        entries.sort((a, b) => b.date.compare(a.date))
        this.set({ entries })
      } catch (reason) {
        this.updateDraft({ saving: false, error: diaryError(reason, '保存日记失败') })
        return false
      }
    }
    return true
  }
}
