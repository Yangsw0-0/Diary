import './settings.css'
import { useId, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import { NodePalette } from '@/application/NodePalette'
import { ThemePalette } from '@/application/ThemePalette'
import { AppearancePreferences } from '@/application/AppearancePreferences'
import { HelpDialog } from '@/features/help/HelpDialog'
import { defaultSettingsCatalog, type SettingsCatalog } from './SettingsCatalog'
import type { SettingsPanelProps, SettingsContentProps } from './settingsTypes'

/** Category navigation and composition only; each page owns its setting controls. */
export function SettingsPanel({
  catalog = defaultSettingsCatalog,
  ...props
}: SettingsPanelProps & { catalog?: SettingsCatalog }) {
  const [selectedId, setSelectedId] = useState(() => catalog.list()[0]!.id)
  const [fallbackPalette] = useState(
    () => props.nodePalette ?? new NodePalette(window.localStorage),
  )
  const nodePalette = props.nodePalette ?? fallbackPalette
  const nodeColors = useSyncExternalStore(nodePalette.subscribe, nodePalette.getSnapshot)
  const [helpOpen, setHelpOpen] = useState(false)
  const id = useId()
  const categories = catalog.list(),
    selected = catalog.resolve(selectedId),
    Content = selected.Content
  const contentProps: SettingsContentProps = {
    ...props,
    nodePalette,
    nodeColors,
    accentColor: props.accentColor ?? ThemePalette.presets.green,
    appearance: props.appearance ?? AppearancePreferences.defaults,
    onOpenHelp: () => setHelpOpen(true),
  }
  const onCategoryKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let target: number
    switch (event.key) {
      case 'ArrowDown':
        target = (index + 1) % categories.length
        break
      case 'ArrowUp':
        target = (index + categories.length - 1) % categories.length
        break
      case 'Home':
        target = 0
        break
      case 'End':
        target = categories.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    setSelectedId(categories[target]!.id)
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [target]?.focus()
  }
  return (
    <section className="settings-panel" aria-label="设置">
      <header className="settings-header">
        <p className="eyebrow">PREFERENCES</p>
        <h1>设置</h1>
      </header>
      <div className="settings-layout">
        <div
          className="settings-categories"
          role="tablist"
          aria-label="设置分类"
          aria-orientation="vertical"
        >
          {categories.map((category, index) => {
            const Icon = category.Icon
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                id={`${id}-tab-${category.id}`}
                aria-controls={`${id}-panel-${category.id}`}
                aria-selected={selected.id === category.id}
                tabIndex={selected.id === category.id ? 0 : -1}
                onClick={() => setSelectedId(category.id)}
                onKeyDown={(event) => onCategoryKey(event, index)}
              >
                <Icon aria-hidden="true" />
                <span>{category.label}</span>
              </button>
            )
          })}
        </div>
        {categories.map((category) => (
          <div
            key={category.id}
            id={`${id}-panel-${category.id}`}
            className="settings-content"
            role="tabpanel"
            aria-labelledby={`${id}-tab-${category.id}`}
            hidden={selected.id !== category.id}
            tabIndex={0}
          >
            {selected.id === category.id && (
              <>
                <header className="settings-page-header">
                  <h2>{selected.label}</h2>
                  <p>{selected.description}</p>
                </header>
                <Content {...contentProps} />
              </>
            )}
          </div>
        ))}
      </div>
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </section>
  )
}
