import { expect, it } from 'vitest'
import { DiaryStatistics } from '@/application/DiaryStatistics'
import { DiaryDate } from '@/domain/DiaryDate'

it('counts rendered writing while excluding the date, markup, images and whitespace', () => {
  const date = DiaryDate.parse('2026-11-20')
  const markdown =
    '# 2026-11-20 标题\n\n## 心情 - 学习\n\n你好，世界！ [参考](https://example.com)\n\n![截图](assets/x.png)\n\n`a👨‍👩‍👧‍👦`'
  const statistics = new DiaryStatistics()
  expect(statistics.calculate([{ date, markdown, revision: 'r1' }])).toEqual({
    days: 1,
    characters: 17,
    skipped: 0,
  })
  expect(
    statistics.calculate([
      { date, markdown, revision: 'r1' },
      { date, markdown: '# 2026-11-20\n重复日期', revision: 'r2' },
    ]),
  ).toMatchObject({ days: 1, characters: 17 })
})

it('recounts changed saved content and forgets removed dates', () => {
  const statistics = new DiaryStatistics()
  const date = DiaryDate.parse('2026-11-20')
  expect(
    statistics.calculate([{ date, markdown: '# 2026-11-20\n你好', revision: 'r1' }]),
  ).toMatchObject({
    days: 1,
    characters: 2,
  })
  expect(
    statistics.calculate([{ date, markdown: '# 2026-11-20\n你好朋友', revision: 'r2' }]),
  ).toMatchObject({
    days: 1,
    characters: 4,
  })
  expect(statistics.calculate([])).toMatchObject({ days: 0, characters: 0 })
})
