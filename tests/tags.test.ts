import { expect, it, vi } from 'vitest'
import { MarkdownSectionExtractor } from '@/application/MarkdownSectionExtractor'
import { TagIndex } from '@/application/TagIndex'
import { TagService } from '@/application/TagService'
import { DiaryService } from '@/application/DiaryService'
import { DiaryDate } from '@/domain/DiaryDate'
import type { DiaryEntry } from '@/domain/DiaryEntry'
import type { DiaryRepository } from '@/domain/DiaryRepository'

const extractor = new MarkdownSectionExtractor()
const day = DiaryDate.parse('2024-12-31')
const next = DiaryDate.parse('2025-01-01')
const entry = (date: DiaryDate, markdown: string, revision = 'r1'): DiaryEntry => ({
  date,
  markdown,
  revision,
})

it('extracts only top-level level-two headings with exact source offsets', () => {
  const markdown =
    '# 2024-12-31 Title\r\n\r\n## 主题\r\n正文 😀\r\n### 子标题\r\n子内容\r\n\r\n```md\r\n## 代码\r\n```\r\n> ## 引用\r\n- ## 列表\r\n## 主题\r\n第二段\r\n# 下一篇\r\n## 末尾\r\n尾声'
  const result = extractor.parse(markdown, day, 'r1')
  expect(result.summary.title).toBe('Title')
  expect(result.occurrences.map((item) => [item.key, item.ordinal])).toEqual([
    ['主题', 0],
    ['主题', 1],
    ['末尾', 0],
  ])
  const [first, second, last] = result.occurrences
  expect(first).toBeDefined()
  expect(markdown.slice(first!.headingOffset, first!.contentStartOffset)).toBe('## 主题')
  expect(markdown.slice(first!.contentStartOffset, first!.endOffset)).toContain('### 子标题')
  expect(markdown.slice(first!.contentStartOffset, first!.endOffset)).toContain('正文 😀')
  expect(markdown.slice(first!.contentStartOffset, first!.endOffset)).not.toContain('第二段')
  expect(markdown.slice(second!.contentStartOffset, second!.endOffset)).toContain('第二段')
  expect(markdown.slice(second!.contentStartOffset, second!.endOffset)).not.toContain('下一篇')
  expect(markdown.slice(last!.contentStartOffset, last!.endOffset)).toContain('尾声')
})

it('uses visible heading text, NFC and trim without folding case or internal whitespace', () => {
  const markdown =
    '# 2024-12-31\n## **Café**\nA\n## Café\nB\n## café\nC\n## A  B\nD\n## A B\nE\n##   \nF'
  const found = extractor.parse(markdown, day, 'r1').occurrences
  expect(found.map((item) => [item.key, item.ordinal])).toEqual([
    ['Café', 0],
    ['Café', 1],
    ['café', 0],
    ['A  B', 0],
    ['A B', 0],
  ])
})

it('replaces one day atomically, counts distinct days and removes old names', () => {
  const index = new TagIndex()
  const first = entry(day, '# 2024-12-31\n## 工作\nA\n## 工作\nB\n## 单日\nX')
  const second = entry(next, '# 2025-01-01\n## 工作\nC')
  index.rebuild([first, second])
  expect(index.listGroups().frequent.map((group) => [group.key, group.dayCount])).toEqual([
    ['工作', 2],
  ])
  expect(index.listGroups().singleDay.map((group) => group.key)).toEqual(['单日'])
  expect(index.getOccurrences('工作').map((item) => [item.date.toString(), item.ordinal])).toEqual([
    ['2025-01-01', 0],
    ['2024-12-31', 0],
    ['2024-12-31', 1],
  ])
  const changed = extractor.parse('# 2024-12-31\n## 新名字\nY', day, 'r2')
  index.replaceDay(day, changed.occurrences)
  expect(index.getOccurrences('单日')).toEqual([])
  expect(index.getOccurrences('工作')).toHaveLength(1)
  expect(index.listGroups().frequent).toEqual([])
  expect(index.listGroups().singleDay.map((group) => group.key)).toEqual(['工作', '新名字'])
  index.removeDay(next)
  expect(index.getOccurrences('工作')).toEqual([])
})

it('rechecks revisions and rebuilds a changed day before slicing details', async () => {
  const index = new TagIndex()
  const original = entry(day, '# 2024-12-31\n## 工作\n旧内容')
  const current = entry(day, '# 2024-12-31\n## 工作\n新内容', 'r2')
  index.rebuild([original])
  const read = vi.fn().mockResolvedValue(current)
  const repo: DiaryRepository = {
    list: async () => ({ entries: [original], failures: [] }),
    read,
    save: async () => current,
  }
  const sections = await new TagService(new DiaryService(repo, index), index).getSections('工作')
  expect(sections).toHaveLength(1)
  expect(sections[0]?.markdown).toContain('新内容')
  expect(sections[0]?.markdown).not.toContain('旧内容')
  expect(index.getOccurrences('工作')[0]?.revision).toBe('r2')
  expect(read).toHaveBeenCalledTimes(1)
})

it('does not show stale content when an externally changed heading removes a tag', async () => {
  const index = new TagIndex()
  index.rebuild([entry(day, '# 2024-12-31\n## 工作\n旧内容')])
  const changed = entry(day, '# 2024-12-31\n## 家庭\n新内容', 'r2')
  const repo: DiaryRepository = {
    list: async () => ({ entries: [changed], failures: [] }),
    read: async () => changed,
    save: async () => changed,
  }
  expect(await new TagService(new DiaryService(repo, index), index).getSections('工作')).toEqual([])
  expect(index.getOccurrences('工作')).toEqual([])
  expect(index.getOccurrences('家庭')).toHaveLength(1)
})

it('updates only the saved day in the shared index', async () => {
  const index = new TagIndex()
  const first = entry(day, '# 2024-12-31\n## 旧名\nA')
  const second = entry(next, '# 2025-01-01\n## 保留\nB')
  const saved = entry(day, '# 2024-12-31\n## 新名\nC', 'r2')
  const repo: DiaryRepository = {
    list: async () => ({ entries: [second, first], failures: [] }),
    read: async () => first,
    save: async () => saved,
  }
  const diary = new DiaryService(repo, index)
  await diary.list()
  await diary.save(day, saved.markdown, { kind: 'match', revision: 'r1' })
  expect(index.getOccurrences('旧名')).toEqual([])
  expect(index.getOccurrences('新名')).toHaveLength(1)
  expect(index.getOccurrences('保留')).toHaveLength(1)
})

it('keeps a save made during a slow list scan in the returned list and index', async () => {
  const index = new TagIndex()
  const old = entry(day, '# 2024-12-31\n## 旧名\nA')
  const saved = entry(day, '# 2024-12-31\n## 新名\nB', 'r2')
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const repo: DiaryRepository = {
    list: async () => {
      await pending
      return { entries: [old], failures: [] }
    },
    read: async () => saved,
    save: async () => saved,
  }
  const diary = new DiaryService(repo, index)
  const listing = diary.list()
  await diary.save(day, saved.markdown, { kind: 'match', revision: 'r1' })
  release()
  expect((await listing).entries[0]?.revision).toBe('r2')
  expect(index.getOccurrences('旧名')).toEqual([])
  expect(index.getOccurrences('新名')).toHaveLength(1)
})
