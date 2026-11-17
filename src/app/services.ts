import { DiaryService } from '@/application/DiaryService'
import { TauriDiaryRepository } from '@/infrastructure/TauriDiaryRepository'
import type { DiaryRepository } from '@/domain/DiaryRepository'
import { WorkspaceService, type WorkspaceGateway } from '@/application/WorkspaceService'
import { TauriWorkspaceGateway } from '@/infrastructure/TauriWorkspaceGateway'

export interface AppServices {
  diary: DiaryService
  workspace: WorkspaceService
}

export function createServices(
  repository: DiaryRepository = new TauriDiaryRepository(),
  workspaceGateway: WorkspaceGateway = new TauriWorkspaceGateway(),
): AppServices {
  return {
    diary: new DiaryService(repository),
    workspace: new WorkspaceService(workspaceGateway),
  }
}
