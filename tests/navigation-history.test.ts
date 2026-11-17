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

it('keeps at most 200 previous views in one session', () => {
  const history = new NavigationHistory()
  for (let index = 0; index < 250; index++) {
    history.push({ moduleId: 'tags', key: String(index), scrollTop: 0 })
  }
  let steps = 0
  while (history.back()) steps++
  expect(steps).toBe(200)
  expect(history.current).toMatchObject({ moduleId: 'tags', key: '49' })
})

it('rewrites a renamed date and removes a trashed date from navigation history', () => {
  const history = new NavigationHistory()
  const oldDate = DiaryDate.parse('2024-12-31')
  const newDate = DiaryDate.parse('2025-01-01')
  history.push({ moduleId: 'diary', date: oldDate, section: null, scrollTop: 40 })
  history.push({ moduleId: 'tags', key: '工作', scrollTop: 100 })
  history.rewriteDate(oldDate, newDate)
  expect(history.back()).toMatchObject({ moduleId: 'diary', date: newDate, scrollTop: 40 })
  history.dropDate(newDate)
  expect(history.current).toMatchObject({ moduleId: 'diary', date: null })
  expect(history.getSnapshot().canGoForward).toBe(true)
})
