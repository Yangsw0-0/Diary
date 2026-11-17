import type { DiaryDate } from './DiaryDate'

export interface DiaryEntry {
  readonly date: DiaryDate
  readonly markdown: string
  readonly revision: string
}

export interface DiarySummary {
  readonly date: DiaryDate
  readonly title: string
}
