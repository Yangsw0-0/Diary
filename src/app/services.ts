import { DiaryService } from '@/application/DiaryService'
import { TauriDiaryRepository } from '@/infrastructure/TauriDiaryRepository'
import type { DiaryRepository } from '@/domain/DiaryRepository'

export interface AppServices {
  diary: DiaryService
}

export function createServices(
  repository: DiaryRepository = new TauriDiaryRepository(),
): AppServices {
  return {
    diary: new DiaryService(repository),
  }
}
