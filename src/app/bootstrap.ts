import { BookOpenText, Tags } from 'lucide-react'
import type { DiaryRepository } from '@/domain/DiaryRepository'
import { createDiaryPanels } from '@/features/diary/DiaryPanels'
import { CrepeEditorAdapter } from '@/infrastructure/CrepeEditorAdapter'
import { TagCompletion } from '@/application/TagCompletion'
import { TagVisibility } from '@/application/TagVisibility'
import { createTagsPanels } from '@/features/tags/TagsPanels'
import { openExternalLink } from '@/infrastructure/openExternalLink'
import { ModuleRegistry } from './moduleRegistry'
import { createServices } from './services'
import type { WorkspaceGateway } from '@/application/WorkspaceService'
import type { AttachmentGateway } from '@/application/AttachmentService'

/** Composition root. Stateful services are created once, outside React rendering. */
export function createApp(
  repository?: DiaryRepository,
  workspaceGateway?: WorkspaceGateway,
  attachmentGateway?: AttachmentGateway,
) {
  const services = createServices(repository, workspaceGateway, attachmentGateway)
  const completion = new TagCompletion((prefix) =>
    services.tagIndex.getCompletionCandidates(prefix),
  )
  const diaryPanels = createDiaryPanels(
    services.session,
    services.attachments,
    (date) =>
      new CrepeEditorAdapter(
        {
          onUpload: async (file) =>
            (await services.attachments.importFile(date, file)).attachment.relativePath,
          previewUrl: (url) => services.attachments.previewUrl(date, url),
        },
        completion,
      ),
  )
  const tagPanels = createTagsPanels(
    services.tagIndex,
    services.tags,
    services.session,
    services.attachments,
    new TagVisibility(window.localStorage),
    { open: openExternalLink },
  )
  const registry = new ModuleRegistry('diary')
  registry.register({
    id: 'diary',
    label: '日记',
    Icon: BookOpenText,
    listLabel: '日记列表',
    detailLabel: '日记正文',
    List: diaryPanels.List,
    Detail: diaryPanels.Detail,
    Provider: diaryPanels.Provider,
  })
  registry.register({
    id: 'tags',
    label: '标签',
    Icon: Tags,
    listLabel: '标签列表',
    detailLabel: '标签内容',
    List: tagPanels.List,
    Detail: tagPanels.Detail,
    Provider: tagPanels.Provider,
  })
  registry.validate()
  return { services, registry }
}
