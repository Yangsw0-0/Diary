import type { DiaryDate } from './DiaryDate'

export interface TagOccurrence {
  date: DiaryDate
  key: string
  displayTitle: string
  ordinal: number
  revision: string
  headingOffset: number
  contentStartOffset: number
  endOffset: number
}
