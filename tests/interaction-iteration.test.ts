import { expect, it } from 'vitest'
import { DiaryDate } from '@/domain/DiaryDate'
import { TagName } from '@/domain/TagName'
import { MarkdownSectionExtractor } from '@/application/MarkdownSectionExtractor'
import { TagIndex } from '@/application/TagIndex'
import { TagVisibility } from '@/application/TagVisibility'
import { TagCompletion } from '@/application/TagCompletion'
import { ThemePalette } from '@/application/ThemePalette'
import { AppearancePreferences } from '@/application/AppearancePreferences'

it('groups branched headings without rewriting the original title or losing duplicate positions', () => {
  expect(TagName.parse('探索自我 - 恋爱')).toMatchObject({ key: '探索自我', branch: '恋爱' })
  expect(TagName.parse('探索自我')).toMatchObject({ key: '探索自我', branch: null })
  const date = DiaryDate.parse('2026-11-17')
  const markdown = '# 2026-11-17\n## 探索自我 - 恋爱\n甲\n## 探索自我 - 世界观\n乙'
  const extracted = new MarkdownSectionExtractor().parse(markdown, date, 'r1')
  expect(extracted.occurrences.map((item) => [item.key, item.branch, item.ordinal])).toEqual([
    ['探索自我', '恋爱', 0],
    ['探索自我', '世界观', 1],
  ])
  expect(
    markdown.slice(
      extracted.occurrences[0]!.headingOffset,
      extracted.occurrences[0]!.contentStartOffset,
    ),
  ).toBe('## 探索自我 - 恋爱')
})

it('sorts visible and hidden tags by distinct days then recency and persists overrides', () => {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }
  const index = new TagIndex()
  const dates = ['2026-11-18', '2026-11-17', '2026-11-16'].map(DiaryDate.parse)
  index.rebuild([
    { date: dates[0]!, markdown: '# 2026-11-18\n## A\n## B\n## C', revision: '1' },
    { date: dates[1]!, markdown: '# 2026-11-17\n## A\n## B\n## D', revision: '2' },
    { date: dates[2]!, markdown: '# 2026-11-16\n## A\n## D', revision: '3' },
  ])
  const visibility = new TagVisibility(storage)
  expect(index.listGroups(visibility).frequent.map((item) => item.key)).toEqual(['A', 'B', 'D'])
  visibility.setShown('A', false)
  visibility.setShown('C', true)
  const restored = new TagVisibility(storage)
  expect(index.listGroups(restored).frequent.map((item) => item.key)).toEqual(['B', 'D', 'C'])
  expect(index.listGroups(restored).singleDay.map((item) => item.key)).toEqual(['A'])
})

it('offers an existing heading suffix', () => {
  const completion = new TagCompletion((prefix) =>
    ['探索自我 - 恋爱'].filter((item) => item.startsWith(prefix)),
  )
  expect(completion.suggest('探')).toBe('探索自我 - 恋爱')
  expect(completion.suggest('')).toBeNull()
})

it('persists independent list color and clamps text spacing', () => {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }
  const chosen = AppearancePreferences.save(storage, {
    listColor: '#AABBCC',
    lineHeight: 9,
    letterSpacing: -2,
  })
  expect(chosen).toEqual({ listColor: '#aabbcc', lineHeight: 2.4, letterSpacing: -0.5 })
  expect(AppearancePreferences.load(storage)).toEqual(chosen)
})

it('validates custom colors and restores a saved theme color', () => {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }
  expect(ThemePalette.save(storage, '#ABCDEF')).toBe('#abcdef')
  expect(ThemePalette.load(storage)).toBe('#abcdef')
  expect(() => ThemePalette.save(storage, 'red; background: black')).toThrow()
})
