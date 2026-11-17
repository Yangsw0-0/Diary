import type { DiaryRepository } from '@/domain/DiaryRepository'
import type { DiaryScan } from '@/domain/DiaryRepository'

/** Coordinates diary use cases; storage rules are added in M2 and save ordering in M3. */
export class DiaryService {
  private readonly repository: DiaryRepository

  constructor(repository: DiaryRepository) {
    this.repository = repository
  }

  list(): Promise<DiaryScan> {
    return this.repository.list()
  }
}
