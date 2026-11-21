import { decodeNodes, emptyNodes, flattenNodes, type NodesDocument } from '@/domain/NodesDocument'
import type { NodeRepository } from '@/domain/NodeRepository'
export interface NodesSnapshot {
  readonly document: NodesDocument
  readonly loaded: boolean
  readonly loading: boolean
  readonly saving: boolean
  readonly dirty: boolean
  readonly error: string | null
  readonly blocked: boolean
  readonly focusedId: string | null
  readonly savedAt: string | null
}
const message = (error: unknown) => {
  if (error instanceof SyntaxError) return '节点文件内容损坏'
  const text =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : ''
  if (!text) return '节点读写失败'
  if (text.startsWith('Invalid diary date')) return '节点日期无效'
  if (text.includes('Unexpected end of JSON') || text.includes('JSON')) return '节点文件内容损坏'
  return text
}
export class NodesSession {
  private snapshot: NodesSnapshot = {
    document: emptyNodes(),
    loaded: false,
    loading: false,
    saving: false,
    dirty: false,
    error: null,
    blocked: false,
    focusedId: null,
    savedAt: null,
  }
  private listeners = new Set<() => void>()
  private readonly repository: NodeRepository
  private revision: string | null = null
  private version = 0
  private epoch = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private saving: Promise<boolean> | null = null
  private loading: Promise<void> | null = null
  constructor(repository: NodeRepository) {
    this.repository = repository
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  getSnapshot = () => this.snapshot
  private publish(patch: Partial<NodesSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((fn) => fn())
  }
  async ensureLoaded(): Promise<void> {
    while (!this.snapshot.loaded) await this.reload()
  }
  reload(): Promise<void> {
    if (this.saving) return Promise.reject(new Error('请等待节点保存完成'))
    clearTimeout(this.timer)
    if (this.loading) return this.loading
    const epoch = this.epoch
    this.publish({ loading: true })
    this.loading = (async () => {
      try {
        const file = await this.repository.read()
        const document = file ? decodeNodes(JSON.parse(file.json)) : emptyNodes()
        if (epoch !== this.epoch) return
        this.revision = file?.revision ?? null
        this.version++
        const rows = flattenNodes(document)
        this.publish({
          document,
          loaded: true,
          dirty: false,
          error: null,
          blocked: false,
          focusedId: rows.some((e) => e.id === this.snapshot.focusedId)
            ? this.snapshot.focusedId
            : (rows.at(-1)?.id ?? null),
        })
      } catch (error) {
        if (epoch === this.epoch)
          this.publish({ loaded: true, error: message(error), blocked: true })
      } finally {
        if (epoch === this.epoch) this.publish({ loading: false })
        this.loading = null
      }
    })()
    return this.loading
  }
  focus(id: string) {
    if (id === this.snapshot.focusedId) return
    if (flattenNodes(this.snapshot.document).some((e) => e.id === id))
      this.publish({ focusedId: id })
  }
  edit(date: string, title: string, colorIndex: number, eventId?: string) {
    if (!this.snapshot.loaded || this.snapshot.blocked) throw new Error('请先处理节点文件读取错误')
    const now = new Date().toISOString(),
      old = flattenNodes(this.snapshot.document).find((e) => e.id === eventId)
    if (eventId && !old) throw new Error('事件已不存在')
    const id = old?.id ?? crypto.randomUUID()
    const nodes = this.snapshot.document.nodes.map((n) => ({
      ...n,
      events: n.events.filter((e) => e.id !== id),
    }))
    const event = { id, title, colorIndex, createdAt: old?.createdAt ?? now, updatedAt: now }
    const target = nodes.find((n) => n.date === date)
    if (target) target.events = [...target.events, event]
    else nodes.push({ id: crypto.randomUUID(), date, events: [event] })
    this.change(decodeNodes({ version: 2, nodes: nodes.filter((n) => n.events.length) }), id)
  }
  remove(id: string) {
    this.change(
      decodeNodes({
        version: 2,
        nodes: this.snapshot.document.nodes
          .map((n) => ({ ...n, events: n.events.filter((e) => e.id !== id) }))
          .filter((n) => n.events.length),
      }),
      null,
    )
  }
  setColor(id: string, colorIndex: number) {
    const row = flattenNodes(this.snapshot.document).find((e) => e.id === id)
    if (row) this.edit(row.date, row.title, colorIndex, id)
  }
  private change(document: NodesDocument, focusedId: string | null) {
    if (this.snapshot.blocked) throw new Error('请先处理文件错误')
    this.version++
    this.publish({
      document,
      focusedId: focusedId ?? flattenNodes(document).at(-1)?.id ?? null,
      dirty: true,
      error: null,
    })
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), 800)
  }
  flush(force = false): Promise<boolean> {
    clearTimeout(this.timer)
    if (this.saving) return force ? this.saving.then(() => this.flush(true)) : this.saving
    if (!this.snapshot.dirty) return Promise.resolve(true)
    if (this.snapshot.blocked && !force) return Promise.resolve(false)
    const epoch = this.epoch
    this.saving = (async () => {
      this.publish({ saving: true })
      try {
        do {
          const version = this.version,
            json = JSON.stringify(this.snapshot.document, null, 2) + '\n'
          const saved = await this.repository.save(json, this.revision, force)
          if (epoch !== this.epoch) return false
          this.revision = saved.revision
          this.publish({
            dirty: version !== this.version,
            error: null,
            blocked: false,
            savedAt: new Date().toLocaleTimeString(),
          })
        } while (this.snapshot.dirty)
        return true
      } catch (error) {
        if (epoch === this.epoch) this.publish({ error: message(error) })
        return false
      } finally {
        this.saving = null
        if (epoch === this.epoch) this.publish({ saving: false })
      }
    })()
    return this.saving
  }
  async backupAndReset(): Promise<void> {
    if (this.snapshot.dirty) throw new Error('请先处理未保存草稿')
    await this.repository.backup()
    this.revision = null
    this.version++
    this.publish({
      document: emptyNodes(),
      loaded: true,
      blocked: false,
      error: null,
      dirty: true,
      focusedId: null,
    })
    await this.flush()
  }
  async checkExternalChange(): Promise<void> {
    if (!this.snapshot.loaded || this.snapshot.loading || this.saving) return
    const epoch = this.epoch
    try {
      const file = await this.repository.read()
      if (epoch !== this.epoch) return
      if ((file?.revision ?? null) === this.revision) return
      if (this.snapshot.dirty) this.publish({ error: '节点文件已被外部修改，请重新载入或覆盖保存' })
      else await this.reload()
    } catch (error) {
      if (epoch === this.epoch) this.publish({ error: message(error) })
    }
  }
  reset(): void {
    clearTimeout(this.timer)
    this.epoch++
    this.revision = null
    this.version = 0
    this.saving = null
    this.loading = null
    this.publish({
      document: emptyNodes(),
      loaded: false,
      loading: false,
      saving: false,
      dirty: false,
      blocked: false,
      error: null,
      focusedId: null,
      savedAt: null,
    })
  }
}
