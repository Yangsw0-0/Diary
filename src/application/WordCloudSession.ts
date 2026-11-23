import {
  decodeCloud,
  emptyCloud,
  normalizeCloudText,
  type CloudDocument,
  type CloudPreferences,
  type CustomCloudWord,
} from '@/domain/WordCloud'
import type { WordCloudRepository } from '@/domain/WordCloudRepository'
export interface CloudSnapshot {
  readonly document: CloudDocument
  readonly loaded: boolean
  readonly loading: boolean
  readonly dirty: boolean
  readonly saving: boolean
  readonly error: string | null
  readonly blocked: boolean
}
const fresh = (): CloudSnapshot => ({
  document: emptyCloud(),
  loaded: false,
  loading: false,
  dirty: false,
  saving: false,
  error: null,
  blocked: false,
})
const errorMessage = (error: unknown) =>
  error instanceof SyntaxError
    ? '词云文件内容损坏，请修复文件后重新读取'
    : error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : '词云读写失败'
/** Workspace-scoped saved content. Only custom words and preferences ever cross the port. */
export class WordCloudSession {
  private readonly repository: WordCloudRepository
  private snapshot = fresh()
  private readonly listeners = new Set<() => void>()
  private revision: string | null = null
  private epoch = 0
  private version = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private loadTask: Promise<void> | null = null
  private saveTask: Promise<boolean> | null = null
  constructor(repository: WordCloudRepository) {
    this.repository = repository
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  getSnapshot = () => this.snapshot
  private publish(patch: Partial<CloudSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const fn of this.listeners) fn()
  }
  async ensureLoaded(): Promise<void> {
    while (!this.snapshot.loaded) await this.reload()
  }
  reload(): Promise<void> {
    if (this.saveTask) return Promise.reject(new Error('请等待词云保存完成'))
    if (this.loadTask) return this.loadTask
    clearTimeout(this.timer)
    const epoch = this.epoch
    this.publish({ loading: true })
    const task = Promise.resolve().then(async () => {
      try {
        const file = await this.repository.read(),
          document = file ? decodeCloud(JSON.parse(file.json)) : emptyCloud()
        if (epoch !== this.epoch) return
        this.revision = file?.revision ?? null
        this.version++
        this.publish({
          document,
          loaded: true,
          loading: false,
          dirty: false,
          blocked: false,
          error: null,
        })
      } catch (error) {
        if (epoch === this.epoch)
          this.publish({ loaded: true, loading: false, blocked: true, error: errorMessage(error) })
      } finally {
        if (epoch === this.epoch) this.loadTask = null
      }
    })
    this.loadTask = task
    return task
  }
  private change(document: CloudDocument) {
    if (!this.snapshot.loaded || this.snapshot.blocked || this.snapshot.loading)
      throw new Error('请先处理词云读取错误')
    this.version++
    this.publish({ document: decodeCloud(document), dirty: true, error: null })
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), 800)
  }
  add(text: string): void {
    const word = { id: crypto.randomUUID(), text: normalizeCloudText(text) }
    if (this.snapshot.document.words.some((w) => w.text === word.text))
      throw new Error('该自定义词语已存在')
    this.change({ ...this.snapshot.document, words: [...this.snapshot.document.words, word] })
  }
  remove(id: string): CustomCloudWord | undefined {
    const word = this.snapshot.document.words.find((w) => w.id === id)
    if (word)
      this.change({
        ...this.snapshot.document,
        words: this.snapshot.document.words.filter((w) => w.id !== id),
      })
    return word
  }
  restore(word: CustomCloudWord): void {
    if (this.snapshot.document.words.some((w) => w.id === word.id || w.text === word.text)) return
    this.change({ ...this.snapshot.document, words: [...this.snapshot.document.words, word] })
  }
  configure(patch: Partial<CloudPreferences>): void {
    this.change({
      ...this.snapshot.document,
      preferences: { ...this.snapshot.document.preferences, ...patch },
    })
  }
  flush(force = false): Promise<boolean> {
    clearTimeout(this.timer)
    if (this.saveTask) return force ? this.saveTask.then(() => this.flush(true)) : this.saveTask
    if (!this.snapshot.dirty) return Promise.resolve(true)
    if (this.snapshot.blocked) return Promise.resolve(false)
    const epoch = this.epoch
    const task = Promise.resolve().then(async () => {
      this.publish({ saving: true })
      try {
        do {
          const version = this.version,
            json = JSON.stringify(this.snapshot.document, null, 2) + '\n'
          const saved = await this.repository.save(json, this.revision, force)
          if (epoch !== this.epoch) return false
          this.revision = saved.revision
          this.publish({ dirty: version !== this.version, error: null })
        } while (this.snapshot.dirty)
        return true
      } catch (error) {
        if (epoch === this.epoch) this.publish({ error: errorMessage(error) })
        return false
      } finally {
        if (epoch === this.epoch) {
          this.saveTask = null
          this.publish({ saving: false })
        }
      }
    })
    this.saveTask = task
    return task
  }
  async checkExternalChange(): Promise<void> {
    if (!this.snapshot.loaded || this.snapshot.loading || this.saveTask) return
    const epoch = this.epoch
    try {
      const file = await this.repository.read()
      if (
        epoch !== this.epoch ||
        file?.revision === this.revision ||
        (!file && this.revision === null)
      )
        return
      if (this.snapshot.dirty) this.publish({ error: '词云文件已被外部修改，请重新载入或覆盖保存' })
      else await this.reload()
    } catch (error) {
      if (epoch === this.epoch) this.publish({ error: errorMessage(error) })
    }
  }
  reset(): void {
    clearTimeout(this.timer)
    this.epoch++
    this.version = 0
    this.revision = null
    this.loadTask = null
    this.saveTask = null
    this.publish(fresh())
  }
}
