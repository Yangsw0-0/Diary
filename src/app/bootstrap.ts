import { BookOpenText, Tags } from 'lucide-react'
import type { DiaryRepository } from '@/domain/DiaryRepository'
import { DiaryList, DiaryDetail } from '@/features/diary/DiaryPanels'
import { TagsList, TagsDetail } from '@/features/tags/TagsPanels'
import { ModuleRegistry } from './moduleRegistry'
import { createServices } from './services'

/** Composition root. Stateful services are created once, outside React rendering. */
export function createApp(repository?: DiaryRepository) {
  const services = createServices(repository)
  const registry = new ModuleRegistry('diary')
  registry.register({
    id: 'diary',
    label: '日记',
    Icon: BookOpenText,
    listLabel: '日记列表',
    detailLabel: '日记正文',
    List: DiaryList,
    Detail: DiaryDetail,
  })
  registry.register({
    id: 'tags',
    label: '标签',
    Icon: Tags,
    listLabel: '标签列表',
    detailLabel: '标签内容',
    List: TagsList,
    Detail: TagsDetail,
  })
  registry.validate()
  return { services, registry }
}
