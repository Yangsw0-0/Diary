import { DiaryService } from '@/application/DiaryService'
import { TauriDiaryRepository } from '@/infrastructure/TauriDiaryRepository'

export interface AppServices {
  diary: DiaryService
}

export function createServices(): AppServices {
  return {
    diary: new DiaryService(new TauriDiaryRepository()),
  }
}
