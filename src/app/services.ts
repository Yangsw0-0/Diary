import { WordCloudSession } from '@/application/WordCloudSession'
import { TauriWordCloudRepository } from '@/infrastructure/TauriWordCloudRepository'
import type { WordCloudRepository } from '@/domain/WordCloudRepository'
import { NodePalette } from '@/application/NodePalette'
import { NodesSession } from '@/application/NodesSession'
import { TauriNodeRepository } from '@/infrastructure/TauriNodeRepository'
import type { NodeRepository } from '@/domain/NodeRepository'
import { MarkdownDocumentCache } from '@/application/MarkdownDocumentCache'
import { MarkdownSectionExtractor } from '@/application/MarkdownSectionExtractor'
import { DiaryStatistics } from '@/application/DiaryStatistics'
import { DiaryService } from '@/application/DiaryService'
import { DiarySession } from '@/application/DiarySession'
import { TagIndex } from '@/application/TagIndex'
import { TagService } from '@/application/TagService'
import { TauriDiaryRepository } from '@/infrastructure/TauriDiaryRepository'
import type { DiaryRepository } from '@/domain/DiaryRepository'
import { WorkspaceService, type WorkspaceGateway } from '@/application/WorkspaceService'
import { TauriWorkspaceGateway } from '@/infrastructure/TauriWorkspaceGateway'
import { AttachmentService, type AttachmentGateway } from '@/application/AttachmentService'
import { TauriAttachmentGateway } from '@/infrastructure/TauriAttachmentGateway'

export interface AppServices {
  wordCloud: WordCloudSession
  nodePalette: NodePalette
  nodes: NodesSession
  statistics: DiaryStatistics
  diary: DiaryService
  session: DiarySession
  tagIndex: TagIndex
  tags: TagService
  workspace: WorkspaceService
  attachments: AttachmentService
}

export function createServices(
  repository: DiaryRepository = new TauriDiaryRepository(),
  workspaceGateway: WorkspaceGateway = new TauriWorkspaceGateway(),
  attachmentGateway: AttachmentGateway = new TauriAttachmentGateway(),
  nodeRepository: NodeRepository = new TauriNodeRepository(),
  cloudRepository: WordCloudRepository = new TauriWordCloudRepository(),
): AppServices {
  const documents = new MarkdownDocumentCache()
  const extractor = new MarkdownSectionExtractor(documents)
  const tagIndex = new TagIndex(extractor)
  const diary = new DiaryService(repository, tagIndex, extractor, () => documents.clear())
  return {
    wordCloud: new WordCloudSession(cloudRepository),
    nodePalette: new NodePalette(window.localStorage),
    nodes: new NodesSession(nodeRepository),
    statistics: new DiaryStatistics(documents),
    diary,
    session: new DiarySession(diary),
    tagIndex,
    tags: new TagService(diary, tagIndex),
    workspace: new WorkspaceService(workspaceGateway),
    attachments: new AttachmentService(attachmentGateway),
  }
}
