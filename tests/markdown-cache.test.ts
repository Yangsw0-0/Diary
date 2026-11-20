import { expect, it, vi } from 'vitest'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { unified } from 'unified'
import { MarkdownDocumentCache } from '@/application/MarkdownDocumentCache'
import { MarkdownSectionExtractor } from '@/application/MarkdownSectionExtractor'
import { DiaryStatistics } from '@/application/DiaryStatistics'
import { DiaryDate } from '@/domain/DiaryDate'

const parser = unified().use(remarkParse).use(remarkGfm)

it('shares one parse between tags and statistics without modifying the tree', () => {
  const parse = vi.fn((text: string) => parser.parse(text))
  const cache = new MarkdownDocumentCache(10, 10000, parse)
  const entry = {
    date: DiaryDate.parse('2026-11-20'),
    markdown: '# 2026-11-20\n\n## 自我 - 认识\n你好👨‍👩‍👧‍👦\n',
    revision: '1',
  }
  const extractor = new MarkdownSectionExtractor(cache)
  const first = extractor.parse(entry.markdown, entry.date, entry.revision)
  const before = JSON.stringify(cache.parse(entry.markdown))
  const statistics = new DiaryStatistics(cache)
  expect(statistics.calculate([entry]).days).toBe(1)
  expect(statistics.calculate([entry]).characters).toBeGreaterThan(0)
  expect(extractor.parse(entry.markdown, entry.date, '2').occurrences[0]?.revision).toBe('2')
  expect(first.occurrences[0]?.key).toBe('自我')
  expect(JSON.stringify(cache.parse(entry.markdown))).toBe(before)
  expect(parse).toHaveBeenCalledTimes(1)
  const changed = { ...entry, markdown: entry.markdown + '新增', revision: '2' }
  expect(statistics.calculate([changed]).characters).toBe(
    statistics.calculate([entry]).characters + 2,
  )
  expect(parse).toHaveBeenCalledTimes(2)
})

it('evicts least recently used documents and clears workspace data', () => {
  const parse = vi.fn((text: string) => parser.parse(text))
  const cache = new MarkdownDocumentCache(2, 100, parse)
  cache.parse('A')
  cache.parse('B')
  cache.parse('A')
  cache.parse('C')
  cache.parse('B')
  expect(parse).toHaveBeenCalledTimes(4)
  cache.clear()
  cache.parse('B')
  expect(parse).toHaveBeenCalledTimes(5)
})

it('bounds retained source size and does not retain oversized documents', () => {
  const parse = vi.fn((text: string) => parser.parse(text))
  const cache = new MarkdownDocumentCache(10, 3, parse)
  cache.parse('aa')
  cache.parse('bb')
  cache.parse('aa')
  expect(parse).toHaveBeenCalledTimes(3)
  cache.parse('large')
  cache.parse('large')
  expect(parse).toHaveBeenCalledTimes(5)
})
