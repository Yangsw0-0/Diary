import type { DiaryDate } from './DiaryDate'
import type { DiaryEntry, DiarySummary } from './DiaryEntry'

export interface DiaryRepository {
  list(): Promise<DiarySummary[]>
  read(date: DiaryDate): Promise<DiaryEntry | null>
  save(date: DiaryDate, markdown: string, expectedRevision: string | null): Promise<DiaryEntry>
}
