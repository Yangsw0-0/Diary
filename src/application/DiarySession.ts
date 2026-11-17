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
  readonly editorEpoch: number
}

export interface DiarySessionSnapshot {
  readonly entries: readonly DiaryEntry[]
  readonly failures: readonly DiaryFileFailure[]
  readonly selected: DiaryDraft | null
  readonly loading: boolean
  readonly opening: boolean
  readonly error: DiaryError | null
  readonly renamed?:
    { readonly from: DiaryDate; readonly to: DiaryDate; readonly sequence: number } | undefined
  readonly trashed?: { readonly date: DiaryDate; readonly sequence: number } | undefined
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
    opening: false,
    error: null,
  }
  private timer: ReturnType<typeof setTimeout> | null = null
  private loadPromise: Promise<void> | null = null
  private savePromise: Promise<boolean> | null = null
  private composing = false
  private generation = 0
  private navigationSequence = 0
  private externalCheckSequence = 0
  private renameSequence = 0
  private trashSequence = 0

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

  getUnsavedSnapshot = (): boolean => {
    const selected = this.snapshot.selected
    return !!selected && selected.version !== selected.savedVersion
  }

  getSummary(date: DiaryDate): string | undefined {
    return this.service.getSummary(date)?.title
  }

  private set(next: Partial<DiarySessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...next }
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {
        /* View listeners cannot invalidate a committed save. */
      }
    }
  }

  private updateDraft(next: Partial<DiaryDraft>): void {
    if (this.snapshot.selected) this.set({ selected: { ...this.snapshot.selected, ...next } })
  }

  reset(): void {
    this.clearTimer()
    this.loadPromise = null
    this.generation++
    this.navigationSequence++
    this.externalCheckSequence++
    this.composing = false
    this.service.clearIndex()
    this.set({
      entries: [],
      failures: [],
      selected: null,
      loading: true,
      opening: false,
      error: null,
      renamed: undefined,
      trashed: undefined,
    })
  }

  load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise
    const generation = this.generation
    this.set({ loading: true, error: null })
    const run = this.service
      .list()
      .then(
        (scan) => {
          if (generation === this.generation)
            this.set({ entries: scan.entries, failures: scan.failures, loading: false })
        },
        (reason: unknown) => {
          if (generation === this.generation)
            this.set({ loading: false, error: diaryError(reason, '读取日记列表失败') })
        },
      )
      .finally(() => {
        if (this.loadPromise === run) this.loadPromise = null
      })
    this.loadPromise = run
    return run
  }

  resetAndLoad(): Promise<void> {
    this.reset()
    return this.load()
  }

  async refresh(): Promise<boolean> {
    if (!(await this.flush())) return false
    await this.checkExternalChange()
    await this.load()
    return !this.snapshot.error
  }

  async open(date: DiaryDate): Promise<boolean> {
    const sequence = ++this.navigationSequence
    if (this.snapshot.selected?.date.equals(date)) {
      this.set({ opening: false })
      return true
    }
    this.set({ opening: true, error: null })
    try {
      if (!(await this.flush()) || sequence !== this.navigationSequence) return false
      const entry = await this.service.read(date)
      if (sequence !== this.navigationSequence) return false
      // Input events that arrived while the read was in flight still belong to the old draft.
      if (!(await this.flush()) || sequence !== this.navigationSequence) return false
      this.set({
        selected: {
          date,
          markdown: entry.markdown,
          revision: entry.revision,
          version: 0,
          savedVersion: 0,
          saving: false,
          error: null,
          editorEpoch: 0,
        },
      })
      return true
    } catch (reason) {
      if (sequence === this.navigationSequence)
        this.set({ error: diaryError(reason, '读取日记失败') })
      return false
    } finally {
      if (sequence === this.navigationSequence) this.set({ opening: false })
    }
  }

  async deselect(): Promise<boolean> {
    ++this.navigationSequence
    if (!(await this.flush())) return false
    this.set({ selected: null, error: null, opening: false })
    return true
  }

  async create(date: DiaryDate = todayDate()): Promise<boolean> {
    if (this.snapshot.entries.some((entry) => entry.date.equals(date))) return this.open(date)
    const sequence = ++this.navigationSequence
    if (this.snapshot.selected?.date.equals(date)) {
      this.set({ opening: false })
      return true
    }
    this.set({ opening: true, error: null })
    try {
      if (!(await this.flush()) || sequence !== this.navigationSequence) return false
      this.set({
        selected: {
          date,
          markdown: `# ${date.toString()}\n\n`,
          revision: null,
          version: 1,
          savedVersion: 0,
          saving: false,
          error: null,
          editorEpoch: 0,
        },
      })
      this.scheduleSave()
      return true
    } finally {
      if (sequence === this.navigationSequence) this.set({ opening: false })
    }
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

  async checkExternalChange(): Promise<void> {
    const selected = this.snapshot.selected
    if (!selected || selected.saving || this.snapshot.opening) return
    const sequence = ++this.externalCheckSequence
    try {
      const remote = await this.service.read(selected.date)
      const current = this.snapshot.selected
      if (
        sequence !== this.externalCheckSequence ||
        !current ||
        !current.date.equals(selected.date) ||
        current.saving ||
        this.snapshot.opening ||
        remote.revision === current.revision
      )
        return
      if (current.version !== current.savedVersion) {
        this.updateDraft({
          error: new DiaryError('conflict', '日记已被外部修改，当前草稿尚未保存'),
        })
        return
      }
      this.service.reindex(remote)
      this.replaceEntry(remote)
      this.set({
        selected: {
          ...current,
          markdown: remote.markdown,
          revision: remote.revision,
          editorEpoch: current.editorEpoch + 1,
          error: null,
        },
      })
    } catch (reason) {
      if (
        sequence === this.externalCheckSequence &&
        this.snapshot.selected?.date.equals(selected.date)
      )
        this.updateDraft({ error: diaryError(reason, '检查外部修改失败') })
    }
  }

  async prepareWorkspaceSwitch(): Promise<boolean> {
    ++this.navigationSequence
    this.set({ opening: true, error: null })
    const saved = await this.flush()
    if (!saved) this.set({ opening: false })
    return saved
  }

  finishWorkspaceSwitch(): void {
    this.set({ opening: false })
  }

  async reloadSelected(): Promise<boolean> {
    const previous = this.snapshot.selected
    if (!previous) return false
    const sequence = ++this.navigationSequence
    this.clearTimer()
    this.set({ opening: true, error: null })
    try {
      if (this.savePromise) await this.savePromise
      const loaded = await this.service.read(previous.date)
      if (sequence !== this.navigationSequence) return false
      this.service.reindex(loaded)
      this.replaceEntry(loaded)
      this.set({
        selected: {
          date: previous.date,
          markdown: loaded.markdown,
          revision: loaded.revision,
          version: 0,
          savedVersion: 0,
          saving: false,
          error: null,
          editorEpoch: previous.editorEpoch + 1,
        },
      })
      return true
    } catch (reason) {
      if (sequence === this.navigationSequence)
        this.updateDraft({ error: diaryError(reason, '重新加载日记失败') })
      return false
    } finally {
      if (sequence === this.navigationSequence) this.set({ opening: false })
    }
  }

  async discardDraft(): Promise<boolean> {
    const selected = this.snapshot.selected
    if (!selected) return true
    ++this.navigationSequence
    this.clearTimer()
    this.set({ opening: true })
    if (this.savePromise) await this.savePromise
    if (this.snapshot.selected?.date.equals(selected.date)) {
      this.set({ selected: null, error: null, opening: false })
    }
    return true
  }

  async overwriteSelected(): Promise<boolean> {
    const selected = this.snapshot.selected
    if (!selected) return false
    const sequence = ++this.navigationSequence
    this.clearTimer()
    this.set({ opening: true, error: null })
    try {
      if (this.savePromise) await this.savePromise
      if (!this.isDirty()) return true
      const run = this.overwriteLoop(sequence)
      this.savePromise = run
      try {
        return await run
      } finally {
        if (this.savePromise === run) this.savePromise = null
      }
    } finally {
      if (sequence === this.navigationSequence) this.set({ opening: false })
    }
  }

  async trash(date: DiaryDate): Promise<boolean> {
    const selected = this.snapshot.selected
    if (selected?.date.equals(date) && !(await this.flush())) return false
    const entry = this.snapshot.entries.find((item) => item.date.equals(date))
    const revision = this.snapshot.selected?.date.equals(date)
      ? this.snapshot.selected.revision
      : entry?.revision
    if (!revision) return false
    try {
      await this.service.trash(date, revision)
      this.set({
        entries: this.snapshot.entries.filter((item) => !item.date.equals(date)),
        selected: this.snapshot.selected?.date.equals(date) ? null : this.snapshot.selected,
        error: null,
        trashed: { date, sequence: ++this.trashSequence },
      })
      return true
    } catch (reason) {
      this.set({ error: diaryError(reason, '删除日记失败') })
      return false
    }
  }

  private async overwriteLoop(sequence: number): Promise<boolean> {
    const draft = this.snapshot.selected
    if (!draft) return false
    try {
      let expectation: { kind: 'new' } | { kind: 'match'; revision: string }
      try {
        const remote = await this.service.read(draft.date)
        expectation = { kind: 'match', revision: remote.revision }
      } catch (reason) {
        if (!(reason instanceof DiaryError) || reason.code !== 'not_found') throw reason
        expectation = { kind: 'new' }
      }
      const current = this.snapshot.selected
      if (sequence !== this.navigationSequence || !current || !current.date.equals(draft.date))
        return false
      this.updateDraft({ saving: true, error: null })
      const saved = await this.service.save(current.date, current.markdown, expectation)
      const after = this.snapshot.selected
      if (!after || !after.date.equals(saved.date)) return false
      this.updateDraft({
        revision: saved.revision,
        savedVersion: current.version,
        saving: false,
        error: null,
      })
      this.replaceEntry(saved)
      return await this.saveLoop()
    } catch (reason) {
      if (sequence === this.navigationSequence && this.snapshot.selected?.date.equals(draft.date))
        this.updateDraft({ saving: false, error: diaryError(reason, '覆盖保存失败') })
      return false
    }
  }

  private replaceEntry(saved: DiaryEntry): void {
    const entries = this.snapshot.entries.filter((entry) => !entry.date.equals(saved.date))
    entries.push(saved)
    entries.sort((a, b) => b.date.compare(a.date))
    this.set({ entries })
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
      const headingDate = /^# (\d{4}-\d{2}-\d{2})(?:\s|$)/.exec(draft.markdown)?.[1]
      let renamedDate: DiaryDate | null = null
      if (headingDate) {
        try {
          renamedDate = DiaryDate.parse(headingDate)
        } catch {
          /* Storage reports invalid headings. */
        }
      }
      const isRename = !!renamedDate && !renamedDate.equals(draft.date)
      const expectation =
        draft.revision === null
          ? { kind: 'new' as const }
          : { kind: 'match' as const, revision: draft.revision }
      this.updateDraft({ saving: true, error: null })
      try {
        const saved = isRename
          ? draft.revision
            ? await this.service.rename(draft.date, draft.markdown, draft.revision)
            : await this.service.save(renamedDate!, draft.markdown, { kind: 'new' })
          : await this.service.save(draft.date, draft.markdown, expectation)
        const current = this.snapshot.selected
        if (!current || !current.date.equals(draft.date)) return false
        this.updateDraft({
          date: saved.date,
          revision: saved.revision,
          savedVersion: draft.version,
          saving: false,
          error: null,
          editorEpoch: isRename ? current.editorEpoch + 1 : current.editorEpoch,
        })
        if (isRename) {
          this.set({
            entries: this.snapshot.entries.filter((item) => !item.date.equals(draft.date)),
            renamed: { from: draft.date, to: saved.date, sequence: ++this.renameSequence },
          })
        }
        this.replaceEntry(saved)
      } catch (reason) {
        this.updateDraft({ saving: false, error: diaryError(reason, '保存日记失败') })
        return false
      }
    }
    return true
  }
}
