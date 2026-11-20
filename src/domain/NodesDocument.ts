import { DiaryDate } from './DiaryDate'

export interface NodeEvent {
  readonly id: string
  readonly title: string
  readonly colorIndex: number
  readonly createdAt: string
  readonly updatedAt: string
}
export interface NodeRecord {
  readonly id: string
  readonly date: string
  readonly events: readonly NodeEvent[]
}
export interface NodesDocument {
  readonly version: 2
  readonly nodes: readonly NodeRecord[]
}
export const emptyNodes = (): NodesDocument => ({ version: 2, nodes: [] })
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('节点文件结构损坏')
  return value as Record<string, unknown>
}
export function decodeNodes(value: unknown): NodesDocument {
  const doc = object(value)
  if (doc.version !== 1 && doc.version !== 2) throw new Error('数据文件版本不受支持')
  if (!Array.isArray(doc.nodes) || doc.nodes.length > 1000) throw new Error('节点数量或格式无效')
  const ids = new Set<string>(),
    dates = new Set<string>()
  const id = (value: unknown): string => {
    if (typeof value !== 'string' || !value.trim() || ids.has(value))
      throw new Error('节点或事件 ID 无效/重复')
    ids.add(value)
    return value
  }
  let count = 0
  const nodes = doc.nodes.map((raw) => {
    const node = object(raw),
      nodeId = id(node.id)
    if (typeof node.date !== 'string') throw new Error('日期缺失')
    DiaryDate.parse(node.date)
    if (dates.has(node.date)) throw new Error('日期节点重复')
    dates.add(node.date)
    const events = doc.version === 1 ? [{ ...node, id: `${nodeId}:event` }] : node.events
    if (!Array.isArray(events) || !events.length) throw new Error('节点必须包含事件')
    return {
      id: nodeId,
      date: node.date,
      events: events.map((rawEvent) => {
        const event = object(rawEvent)
        const eventId = id(event.id)
        if (
          typeof event.title !== 'string' ||
          !event.title.trim() ||
          Array.from(event.title.trim()).length > 60
        )
          throw new Error('概述应为 1–60 字')
        if (
          !Number.isInteger(event.colorIndex) ||
          Number(event.colorIndex) < 0 ||
          Number(event.colorIndex) > 5
        )
          throw new Error('颜色槽位无效')
        for (const field of ['createdAt', 'updatedAt'])
          if (
            typeof event[field] !== 'string' ||
            !/^\d{4}-\d\d-\d\dT/.test(event[field]) ||
            !Number.isFinite(Date.parse(event[field]))
          )
            throw new Error('事件时间无效')
        if (++count > 1000) throw new Error('最多记录 1000 个事件')
        return {
          id: eventId,
          title: event.title.trim(),
          colorIndex: Number(event.colorIndex),
          createdAt: String(event.createdAt),
          updatedAt: String(event.updatedAt),
        }
      }),
    }
  })
  return { version: 2, nodes: nodes.sort((a, b) => a.date.localeCompare(b.date)) }
}
export const flattenNodes = (doc: NodesDocument) =>
  doc.nodes.flatMap((node) =>
    node.events.map((event) => ({ ...event, date: node.date, nodeId: node.id })),
  )
