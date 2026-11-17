import { DiaryService } from '@/application/DiaryService'
import { DiarySession } from '@/application/DiarySession'
import { TauriDiaryRepository } from '@/infrastructure/TauriDiaryRepository'
import type { DiaryRepository } from '@/domain/DiaryRepository'
import { WorkspaceService, type WorkspaceGateway } from '@/application/WorkspaceService'
import { TauriWorkspaceGateway } from '@/infrastructure/TauriWorkspaceGateway'

export interface AppServices {
  diary: DiaryService
  session: DiarySession
  workspace: WorkspaceService
}

export function createServices(
  repository: DiaryRepository = new TauriDiaryRepository(),
  workspaceGateway: WorkspaceGateway = new TauriWorkspaceGateway(),
): AppServices {
  const diary = new DiaryService(repository)
  return {
    diary,
    session: new DiarySession(diary),
    workspace: new WorkspaceService(workspaceGateway),
  }
}
