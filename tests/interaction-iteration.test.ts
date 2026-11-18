import { expect, it } from 'vitest'
import { DiaryDate } from '@/domain/DiaryDate'
import { TagName } from '@/domain/TagName'
import { MarkdownSectionExtractor } from '@/application/MarkdownSectionExtractor'
import { TagIndex } from '@/application/TagIndex'
import { TagVisibility } from '@/application/TagVisibility'
import { TagCompletion } from '@/application/TagCompletion'
import { AdjacentDiaryNavigator } from '@/application/AdjacentDiaryNavigator'
import { ThemePalette } from '@/application/ThemePalette'

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

it('offers a suffix after a heading prefix and requires boundary wheel movement to switch', () => {
  const completion = new TagCompletion((prefix) =>
    ['探索自我 - 恋爱'].filter((item) => item.startsWith(prefix)),
  )
  expect(completion.suggest('探')).toBe('探索自我 - 恋爱')
  expect(completion.suggest('')).toBeNull()
  const gesture = new AdjacentDiaryNavigator()
  expect(gesture.add(80, 0, false, false, 500, 100)).toBeNull()
  expect(gesture.add(70, 0, false, true, 500, 110)).toBeNull()
  expect(gesture.add(70, 0, false, true, 500, 300)).toMatchObject({
    direction: 'older',
    ready: false,
  })
  expect(gesture.add(100, 0, false, true, 500, 310)).toMatchObject({
    direction: 'older',
    ready: false,
  })
  expect(gesture.add(90, 0, false, true, 500, 320)).toMatchObject({
    direction: 'older',
    ready: true,
  })
  expect(gesture.finish()).toBe('older')
  expect(gesture.isLocked).toBe(true)
  expect(gesture.add(90, 0, false, true, 500)).toBeNull()
  expect(gesture.finish()).toBeNull()
  gesture.unlock()
  gesture.reset()
  expect(gesture.add(-1000, 0, true, false, 500)).toMatchObject({
    direction: 'newer',
    ready: false,
  })
  expect(gesture.finish()).toBeNull()
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
