import { MarkdownDocumentCache } from './MarkdownDocumentCache'
import { toString } from 'mdast-util-to-string'
import type { Heading } from 'mdast'
import type { DiaryDate } from '@/domain/DiaryDate'
import type { DiarySummary } from '@/domain/DiaryEntry'
import type { TagOccurrence } from '@/domain/TagOccurrence'
import { TagName } from '@/domain/TagName'

export interface ExtractedDay {
  readonly summary: DiarySummary
  readonly occurrences: readonly TagOccurrence[]
}

/** Pure Markdown parser; offsets refer to the exact input string (UTF-16 code units). */
export class MarkdownSectionExtractor {
  private readonly documents: MarkdownDocumentCache

  constructor(documents = new MarkdownDocumentCache()) {
    this.documents = documents
  }

  parse(markdown: string, date: DiaryDate, revision: string): ExtractedDay {
    const document = this.documents.parse(markdown)
    const firstHeading = document.children.find(
      (node): node is Heading => node.type === 'heading' && node.depth === 1,
    )
    const title = firstHeading
      ? toString(firstHeading)
          .replace(new RegExp('^' + date.toString() + '(?:\\s+)?'), '')
          .trim()
      : ''
    const summary: DiarySummary = { date, title }
    const occurrences: TagOccurrence[] = []
    const ordinals = new Map<string, number>()
    const children = document.children
    for (let index = 0; index < children.length; index++) {
      const node = children[index]
      if (node?.type !== 'heading' || node.depth !== 2) continue
      const name = TagName.parse(toString(node))
      if (!name) continue
      const { displayTitle, key, branch } = name
      const headingOffset = node.position?.start.offset
      const contentStartOffset = node.position?.end.offset
      if (headingOffset === undefined || contentStartOffset === undefined) continue
      let endOffset = markdown.length
      for (let next = index + 1; next < children.length; next++) {
        const boundary = children[next]
        if (boundary?.type === 'heading' && boundary.depth <= 2) {
          endOffset = boundary.position?.start.offset ?? markdown.length
          break
        }
      }
      const ordinal = ordinals.get(key) ?? 0
      ordinals.set(key, ordinal + 1)
      occurrences.push({
        date,
        key,
        displayTitle,
        branch,
        ordinal,
        revision,
        headingOffset,
        contentStartOffset,
        endOffset,
      })
    }
    return { summary, occurrences }
  }
}
