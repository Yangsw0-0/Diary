import { MarkdownDocumentCache } from './MarkdownDocumentCache'
import type { Nodes } from 'mdast'
import type { DiaryEntry } from '@/domain/DiaryEntry'

export interface DiaryStatisticsSnapshot {
  readonly days: number
  readonly characters: number
  readonly skipped: number
}

const graphemes = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })

function visibleText(node: Nodes): string {
  if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'code') return node.value
  if (node.type === 'image' || node.type === 'imageReference' || node.type === 'html') return ''
  if ('children' in node) return node.children.map((child) => visibleText(child)).join('')
  return ''
}

/** Derives saved writing totals from the current workspace without touching the files. */
export class DiaryStatistics {
  private readonly documents: MarkdownDocumentCache

  constructor(documents = new MarkdownDocumentCache()) {
    this.documents = documents
  }

  private readonly cache = new Map<string, { revision: string; markdown: string; count: number }>()

  calculate(entries: readonly DiaryEntry[]): DiaryStatisticsSnapshot {
    const seen = new Set<string>()
    let characters = 0
    let skipped = 0
    for (const entry of entries) {
      const date = entry.date.toString()
      if (seen.has(date)) continue
      seen.add(date)
      try {
        const cached = this.cache.get(date)
        const count =
          cached?.revision === entry.revision && cached.markdown === entry.markdown
            ? cached.count
            : this.count(entry)
        if (
          count !== cached?.count ||
          cached.markdown !== entry.markdown ||
          cached.revision !== entry.revision
        )
          this.cache.set(date, { revision: entry.revision, markdown: entry.markdown, count })
        characters += count
      } catch {
        skipped++
      }
    }
    for (const date of this.cache.keys()) if (!seen.has(date)) this.cache.delete(date)
    return { days: seen.size, characters, skipped }
  }

  private count(entry: DiaryEntry): number {
    const document = this.documents.parse(entry.markdown)
    const firstDateHeading = document.children.findIndex(
      (node) => node.type === 'heading' && node.depth === 1,
    )
    const text = document.children
      .map((node, index) => {
        const content = visibleText(node)
        return index === firstDateHeading
          ? content.replace(new RegExp(`^${entry.date.toString()}(?=\\s|$)`), '')
          : content
      })
      .join('\n')
    let count = 0
    for (const { segment } of graphemes.segment(text)) if (segment.trim()) count++
    return count
  }
}
