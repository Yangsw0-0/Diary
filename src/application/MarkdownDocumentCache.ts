import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { unified } from 'unified'
import type { Root } from 'mdast'

const parser = unified().use(remarkParse).use(remarkGfm)

/** Workspace-owned LRU cache. Consumers must treat returned syntax trees as read-only. */
export class MarkdownDocumentCache {
  private readonly documents = new Map<string, Root>()
  private characters = 0

  private readonly maxDocuments: number
  private readonly maxCharacters: number
  private readonly parseDocument: (markdown: string) => Root

  constructor(
    maxDocuments = 256,
    maxCharacters = 2_000_000,
    parseDocument: (markdown: string) => Root = (markdown) => parser.parse(markdown),
  ) {
    this.maxDocuments = maxDocuments
    this.maxCharacters = maxCharacters
    this.parseDocument = parseDocument
  }

  parse(markdown: string): Root {
    const cached = this.documents.get(markdown)
    if (cached) {
      this.documents.delete(markdown)
      this.documents.set(markdown, cached)
      return cached
    }
    const document = this.parseDocument(markdown)
    if (this.maxDocuments <= 0 || markdown.length > this.maxCharacters) return document
    this.documents.set(markdown, document)
    this.characters += markdown.length
    while (this.documents.size > this.maxDocuments || this.characters > this.maxCharacters) {
      const oldest = this.documents.keys().next().value
      if (oldest === undefined) break
      this.documents.delete(oldest)
      this.characters -= oldest.length
    }
    return document
  }

  clear(): void {
    this.documents.clear()
    this.characters = 0
  }
}
