import { invoke } from '@tauri-apps/api/core'
import type { DiaryDate } from '@/domain/DiaryDate'
import type { DiaryEntry, DiarySummary } from '@/domain/DiaryEntry'
import type { DiaryRepository } from '@/domain/DiaryRepository'

/** Adapter contract for Rust commands that will be implemented in M2. */
export class TauriDiaryRepository implements DiaryRepository {
  list(): Promise<DiarySummary[]> {
    return invoke<DiarySummary[]>('list_diaries')
  }

  read(date: DiaryDate): Promise<DiaryEntry | null> {
    return invoke<DiaryEntry | null>('read_diary', { date })
  }

  save(date: DiaryDate, markdown: string, expectedRevision: string | null): Promise<DiaryEntry> {
    return invoke<DiaryEntry>('save_diary', { date, markdown, expectedRevision })
  }
}
