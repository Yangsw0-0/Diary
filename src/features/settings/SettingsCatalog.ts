import type { ComponentType } from 'react'
import { BookOpenText, FolderOpen, Palette, Type, type LucideIcon } from 'lucide-react'
import type { SettingsContentProps } from './settingsTypes'
import { PersonalizationSettings } from './PersonalizationSettings'
import { ReadingSettings } from './ReadingSettings'
import { StorageSettings } from './StorageSettings'
import { HelpSettings } from './HelpSettings'

export interface SettingsCategory {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly Icon: LucideIcon
  readonly Content: ComponentType<SettingsContentProps>
}

/** Immutable category catalog: new pages register here, without branching in the shell. */
export class SettingsCatalog {
  private readonly categories: readonly SettingsCategory[]
  constructor(categories: readonly SettingsCategory[]) {
    const ids = new Set<string>()
    if (!categories.length) throw new Error('Settings require at least one category')
    for (const category of categories) {
      if (!category.id.trim() || ids.has(category.id))
        throw new Error(`Invalid settings category: ${category.id}`)
      ids.add(category.id)
    }
    this.categories = Object.freeze(categories.map((category) => Object.freeze({ ...category })))
  }
  list(): readonly SettingsCategory[] {
    return this.categories
  }
  resolve(id: string): SettingsCategory {
    return this.categories.find((category) => category.id === id) ?? this.categories[0]!
  }
}

export const defaultSettingsCatalog = new SettingsCatalog([
  {
    id: 'personalization',
    label: '个性化',
    description: '调整界面外观、主题配色、列表色调和节点色板。',
    Icon: Palette,
    Content: PersonalizationSettings,
  },
  {
    id: 'reading',
    label: '编辑与阅读',
    description: '调整正文排版，让阅读与编辑更舒适。',
    Icon: Type,
    Content: ReadingSettings,
  },
  {
    id: 'storage',
    label: '文件与存储',
    description: '查看当前日记文件夹，或切换到其他位置。',
    Icon: FolderOpen,
    Content: StorageSettings,
  },
  {
    id: 'help',
    label: '帮助',
    description: '了解各项功能、操作方式、备份与版本更新。',
    Icon: BookOpenText,
    Content: HelpSettings,
  },
])
