import type { DiaryDate } from './DiaryDate'

export interface TagOccurrence {
  readonly date: DiaryDate
  readonly key: string
  readonly displayTitle: string
  readonly ordinal: number
  readonly revision: string
  /** UTF-16 code unit offsets into the original Markdown; ranges are half-open. */
  readonly headingOffset: number
  readonly contentStartOffset: number
  readonly endOffset: number
}
