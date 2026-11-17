import { DiaryService } from '@/application/DiaryService'
import { DiarySession } from '@/application/DiarySession'
import { TagIndex } from '@/application/TagIndex'
import { TagService } from '@/application/TagService'
import { TauriDiaryRepository } from '@/infrastructure/TauriDiaryRepository'
import type { DiaryRepository } from '@/domain/DiaryRepository'
import { WorkspaceService, type WorkspaceGateway } from '@/application/WorkspaceService'
import { TauriWorkspaceGateway } from '@/infrastructure/TauriWorkspaceGateway'

export interface AppServices {
  diary: DiaryService
  session: DiarySession
  tagIndex: TagIndex
  tags: TagService
  workspace: WorkspaceService
}

export function createServices(
  repository: DiaryRepository = new TauriDiaryRepository(),
  workspaceGateway: WorkspaceGateway = new TauriWorkspaceGateway(),
): AppServices {
  const tagIndex = new TagIndex()
  const diary = new DiaryService(repository, tagIndex)
  return {
    diary,
    session: new DiarySession(diary),
    tagIndex,
    tags: new TagService(diary, tagIndex),
    workspace: new WorkspaceService(workspaceGateway),
  }
}
