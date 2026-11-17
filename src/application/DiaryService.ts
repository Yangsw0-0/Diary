import type { DiaryRepository } from '@/domain/DiaryRepository'
import type { DiaryScan } from '@/domain/DiaryRepository'
import type { DiaryDate } from '@/domain/DiaryDate'
import type { DiaryEntry } from '@/domain/DiaryEntry'
import type { RevisionExpectation } from '@/domain/DiaryRepository'

/** Coordinates diary use cases; edit-session save ordering belongs to M3. */
export class DiaryService {
  private readonly repository: DiaryRepository

  constructor(repository: DiaryRepository) {
    this.repository = repository
  }

  list(): Promise<DiaryScan> {
    return this.repository.list()
  }

  read(date: DiaryDate): Promise<DiaryEntry> {
    return this.repository.read(date)
  }

  save(date: DiaryDate, markdown: string, expectation: RevisionExpectation): Promise<DiaryEntry> {
    return this.repository.save(date, markdown, expectation)
  }
}
