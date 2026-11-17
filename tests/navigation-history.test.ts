import { expect, it } from 'vitest'
import { NavigationHistory } from '@/application/NavigationHistory'
import { DiaryDate } from '@/domain/DiaryDate'

it('tracks browser-style back and forward history with scroll positions', () => {
  const history = new NavigationHistory()
  const day = DiaryDate.parse('2025-01-01')
  expect(history.getSnapshot().canGoBack).toBe(false)
  history.push({ moduleId: 'tags', key: '工作', scrollTop: 0 })
  history.updateScroll(420)
  history.push({
    moduleId: 'diary',
    date: day,
    section: { date: day, key: '工作', ordinal: 1 },
    scrollTop: 0,
  })
  history.updateScroll(180)
  expect(history.back()).toMatchObject({ moduleId: 'tags', key: '工作', scrollTop: 420 })
  expect(history.getSnapshot().canGoForward).toBe(true)
  expect(history.forward()).toMatchObject({ moduleId: 'diary', scrollTop: 180 })
  history.back()
  history.push({ moduleId: 'tags', key: '家庭', scrollTop: 0 })
  expect(history.getSnapshot().canGoForward).toBe(false)
  expect(history.forward()).toBeNull()
})
