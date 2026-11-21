import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsPanel } from '@/features/settings/SettingsPanel'
import { SettingsCatalog, defaultSettingsCatalog } from '@/features/settings/SettingsCatalog'
import { NodePalette } from '@/application/NodePalette'
import { AppearancePreferences } from '@/application/AppearancePreferences'
afterEach(cleanup)
const base = {
  root: '/test/diaries',
  choosingRoot: false,
  theme: 'light' as const,
  onError: vi.fn(),
}

it('groups related controls and uses keyboard category navigation without changing preferences', async () => {
  const user = userEvent.setup(),
    save = vi.fn(),
    choose = vi.fn()
  render(<SettingsPanel {...base} onSaveTheme={save} onChooseRoot={choose} />)
  expect(screen.getByRole('tab', { name: '个性化' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('heading', { name: '节点颜色' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '更换文件夹' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: '编辑与阅读' }))
  expect(screen.getByRole('slider', { name: '行间距' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '节点颜色' })).not.toBeInTheDocument()
  await user.keyboard('{ArrowDown}')
  expect(screen.getByRole('tab', { name: '文件与存储' })).toHaveFocus()
  expect(screen.getByRole('tabpanel', { name: '文件与存储' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '更换文件夹' }))
  expect(choose).toHaveBeenCalledOnce()
  expect(save).not.toHaveBeenCalled()
  await user.click(screen.getByRole('tab', { name: '文件与存储' }))
  await user.keyboard('{End}')
  expect(screen.getByRole('tab', { name: '帮助' })).toHaveFocus()
  await user.keyboard('{Home}')
  expect(screen.getByRole('tab', { name: '个性化' })).toHaveFocus()
  expect(screen.getByRole('group', { name: '主题' })).toBeInTheDocument()
})

it('preserves controlled appearance and shared palette values when switching categories', async () => {
  const user = userEvent.setup(),
    appearance = vi.fn(),
    theme = vi.fn(async () => undefined),
    palette = new NodePalette(localStorage)
  render(
    <SettingsPanel
      {...base}
      nodePalette={palette}
      onSaveAppearance={appearance}
      onSaveTheme={theme}
      appearance={{ ...AppearancePreferences.defaults, lineHeight: 2 }}
    />,
  )
  await user.click(screen.getByRole('button', { name: '深色' }))
  expect(theme).toHaveBeenCalledWith('dark')
  await user.click(screen.getByRole('tab', { name: '编辑与阅读' }))
  expect(screen.getByRole('slider', { name: '行间距' })).toHaveValue('2')
  await user.click(screen.getByRole('button', { name: '重置排版' }))
  expect(appearance).toHaveBeenCalledWith({ lineHeight: 1.7, letterSpacing: 0 })
  await user.click(screen.getByRole('tab', { name: '个性化' }))
  expect(screen.getByLabelText('节点颜色 1')).toHaveValue(palette.getSnapshot()[0])
})

it('adds a category through the catalog alone and rejects duplicate category identifiers', async () => {
  const user = userEvent.setup(),
    first = defaultSettingsCatalog.list()[0]!
  const catalog = new SettingsCatalog([
    first,
    {
      ...first,
      id: 'extension',
      label: '扩展设置',
      description: '新增设置',
      Content: () => <p>扩展内容</p>,
    },
  ])
  render(<SettingsPanel {...base} catalog={catalog} />)
  await user.click(screen.getByRole('tab', { name: '扩展设置' }))
  expect(screen.getByRole('tabpanel', { name: '扩展设置' })).toHaveTextContent('扩展内容')
  expect(() => new SettingsCatalog([first, first])).toThrow()
  expect(() => new SettingsCatalog([])).toThrow()
})
