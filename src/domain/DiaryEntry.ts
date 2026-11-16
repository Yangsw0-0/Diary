import type { DiaryDate } from './DiaryDate'

export interface DiaryEntry {
  date: DiaryDate
  markdown: string
  revision: string
}

export interface DiarySummary {
  date: DiaryDate
  title: string
}
