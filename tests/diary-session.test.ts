import { expect, it, vi } from 'vitest'
import { DiarySession } from '@/application/DiarySession'
import { DiaryService } from '@/application/DiaryService'
import { DiaryDate } from '@/domain/DiaryDate'
import { DiaryError } from '@/domain/DiaryError'
import type { DiaryEntry } from '@/domain/DiaryEntry'
import type { DiaryRepository } from '@/domain/DiaryRepository'

const date = DiaryDate.parse('2024-02-29')
const nextDate = DiaryDate.parse('2024-03-01')

function repository(initial: DiaryEntry[] = []) {
  const files = new Map(initial.map((entry) => [entry.date.toString(), entry]))
  let revision = 0
  const save = vi.fn<DiaryRepository['save']>(async (day, markdown, expected) => {
    const previous = files.get(day.toString())
    if (expected.kind === 'new' ? !!previous : previous?.revision !== expected.revision) {
      throw new DiaryError('conflict', '文件在外部发生变化')
    }
    const entry = { date: day, markdown, revision: `r${++revision}` }
    files.set(day.toString(), entry)
    return entry
  })
  const repo: DiaryRepository = {
    list: async () => ({
      entries: [...files.values()].sort((a, b) => b.date.compare(a.date)),
      failures: [],
    }),
    read: async (day) => {
      const entry = files.get(day.toString())
      if (!entry) throw new DiaryError('not_found', '文件不存在')
      return entry
    },
    save,
  }
  return { repo, files, save }
}

it('creates today only once and persists Markdown that can be reopened', async () => {
  const { repo, files, save } = repository()
  const session = new DiarySession(new DiaryService(repo), 60_000)
  await session.load()
  expect(await session.create(date)).toBe(true)
  session.edit('# 2024-02-29 Leap day\n\n**重要**\n')
  expect(await session.flush()).toBe(true)
  expect(files.get(date.toString())?.markdown).toContain('**重要**')
  expect(save).toHaveBeenCalledTimes(1)
  expect(await session.create(date)).toBe(true)
  expect(save).toHaveBeenCalledTimes(1)
  const restarted = new DiarySession(new DiaryService(repo))
  await restarted.load()
  expect(await restarted.open(date)).toBe(true)
  expect(restarted.getSnapshot().selected?.markdown).toBe(files.get(date.toString())?.markdown)
})

it('serializes edits made during a pending save and writes the latest version', async () => {
  const initial = { date, markdown: '# 2024-02-29 Old', revision: 'r0' }
  const { repo, files, save } = repository([initial])
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const originalSave = repo.save
  repo.save = async (...args) => {
    if (save.mock.calls.length === 0) await pending
    return originalSave(...args)
  }
  const session = new DiarySession(new DiaryService(repo), 60_000)
  await session.load()
  await session.open(date)
  session.edit('# 2024-02-29 First')
  const flushing = session.flush()
  session.edit('# 2024-02-29 Latest')
  release()
  expect(await flushing).toBe(true)
  expect(files.get(date.toString())?.markdown).toBe('# 2024-02-29 Latest')
  expect(save).toHaveBeenCalledTimes(2)
  expect(session.getSnapshot().selected?.savedVersion).toBe(2)
})

it('keeps a conflicted draft visible and blocks opening another date', async () => {
  const first = { date, markdown: '# 2024-02-29 Old', revision: 'r0' }
  const second = { date: nextDate, markdown: '# 2024-03-01 Next', revision: 'r0' }
  const { repo, files } = repository([first, second])
  const session = new DiarySession(new DiaryService(repo), 60_000)
  await session.load()
  await session.open(date)
  session.edit('# 2024-02-29 My draft')
  files.set(date.toString(), { ...first, revision: 'external' })
  expect(await session.open(nextDate)).toBe(false)
  expect(session.getSnapshot().selected?.markdown).toBe('# 2024-02-29 My draft')
  expect(session.getSnapshot().selected?.error?.code).toBe('conflict')
  expect(session.isDirty()).toBe(true)
})

it('does not auto-save during IME composition and saves when it ends', async () => {
  vi.useFakeTimers()
  try {
    const { repo, save } = repository([{ date, markdown: '# 2024-02-29', revision: 'r0' }])
    const session = new DiarySession(new DiaryService(repo), 800)
    await session.load()
    await session.open(date)
    session.setComposing(true)
    session.edit('# 2024-02-29 中文')
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).not.toHaveBeenCalled()
    session.setComposing(false)
    await vi.advanceTimersByTimeAsync(800)
    expect(save).toHaveBeenCalledTimes(1)
  } finally {
    vi.useRealTimers()
  }
})

it('keeps the latest date selection when reads finish out of order', async () => {
  const first = { date, markdown: '# 2024-02-29 First', revision: 'r1' }
  const second = { date: nextDate, markdown: '# 2024-03-01 Second', revision: 'r2' }
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const { repo } = repository([first, second])
  const read = repo.read
  repo.read = async (day) => {
    if (day.equals(date)) await pending
    return read(day)
  }
  const session = new DiarySession(new DiaryService(repo))
  await session.load()
  const olderRequest = session.open(date)
  expect(await session.open(nextDate)).toBe(true)
  release()
  expect(await olderRequest).toBe(false)
  expect(session.getSnapshot().selected?.date.toString()).toBe('2024-03-01')
})

it('saves edits that arrive while opening another date', async () => {
  const first = { date, markdown: '# 2024-02-29 Old', revision: 'r0' }
  const second = { date: nextDate, markdown: '# 2024-03-01 Next', revision: 'r0' }
  const { repo, files } = repository([first, second])
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  let reading = false
  const read = repo.read
  repo.read = async (day) => {
    if (day.equals(nextDate)) {
      reading = true
      await pending
    }
    return read(day)
  }
  const session = new DiarySession(new DiaryService(repo), 60_000)
  await session.load()
  await session.open(date)
  const opening = session.open(nextDate)
  await vi.waitFor(() => expect(reading).toBe(true))
  expect(session.getSnapshot().opening).toBe(true)
  session.edit('# 2024-02-29 Late edit')
  release()
  expect(await opening).toBe(true)
  expect(files.get(date.toString())?.markdown).toBe('# 2024-02-29 Late edit')
  expect(session.getSnapshot().selected?.date.toString()).toBe('2024-03-01')
})

it('retains the current draft if reading the next date fails', async () => {
  const first = { date, markdown: '# 2024-02-29 Old', revision: 'r0' }
  const { repo } = repository([first])
  const session = new DiarySession(new DiaryService(repo), 60_000)
  await session.load()
  await session.open(date)
  session.edit('# 2024-02-29 My text')
  expect(await session.open(nextDate)).toBe(false)
  expect(session.getSnapshot().selected?.date.toString()).toBe('2024-02-29')
  expect(session.getSnapshot().selected?.markdown).toBe('# 2024-02-29 My text')
  expect(session.getSnapshot().error?.code).toBe('not_found')
})

it('offers reload, explicit overwrite and discard after a conflict', async () => {
  const first = { date, markdown: '# 2024-02-29 Old', revision: 'r0' }
  const { repo, files } = repository([first])
  const session = new DiarySession(new DiaryService(repo), 60_000)
  await session.load()
  await session.open(date)
  session.edit('# 2024-02-29 My draft')
  files.set(date.toString(), { ...first, markdown: '# 2024-02-29 External', revision: 'external' })
  expect(await session.flush()).toBe(false)
  expect(session.getSnapshot().selected?.error?.code).toBe('conflict')
  expect(await session.overwriteSelected()).toBe(true)
  expect(files.get(date.toString())?.markdown).toBe('# 2024-02-29 My draft')
  expect(session.isDirty()).toBe(false)
  files.set(date.toString(), {
    ...first,
    markdown: '# 2024-02-29 New external',
    revision: 'external2',
  })
  session.edit('# 2024-02-29 Another draft')
  expect(await session.flush()).toBe(false)
  expect(await session.reloadSelected()).toBe(true)
  expect(session.getSnapshot().selected?.markdown).toBe('# 2024-02-29 New external')
  expect(session.getSnapshot().selected?.editorEpoch).toBe(1)
  session.edit('# 2024-02-29 Unsaved')
  expect(await session.discardDraft()).toBe(true)
  expect(session.getSnapshot().selected).toBeNull()
})

it('finishes an in-flight overwrite before opening another day', async () => {
  const first = { date, markdown: '# 2024-02-29 Old', revision: 'r0' }
  const second = { date: nextDate, markdown: '# 2024-03-01 Next', revision: 'r0' }
  const { repo, files } = repository([first, second])
  const session = new DiarySession(new DiaryService(repo), 60_000)
  await session.load()
  await session.open(date)
  session.edit('# 2024-02-29 My draft')
  files.set(date.toString(), { ...first, revision: 'external' })
  expect(await session.flush()).toBe(false)
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const originalSave = repo.save
  let saving = false
  repo.save = async (...args) => {
    saving = true
    await pending
    return originalSave(...args)
  }
  const overwriting = session.overwriteSelected()
  await vi.waitFor(() => expect(saving).toBe(true))
  const opening = session.open(nextDate)
  release()
  expect(await overwriting).toBe(true)
  expect(await opening).toBe(true)
  expect(files.get(date.toString())?.markdown).toBe('# 2024-02-29 My draft')
  expect(session.getSnapshot().selected?.date.equals(nextDate)).toBe(true)
})

it('refreshes a clean same-day editor after an external change and warns on dirty conflicts', async () => {
  const first = { date, markdown: '# 2024-02-29 Old', revision: 'r0' }
  const { repo, files } = repository([first])
  const session = new DiarySession(new DiaryService(repo), 60_000)
  await session.load()
  await session.open(date)
  files.set(date.toString(), { ...first, markdown: '# 2024-02-29 External', revision: 'r1' })
  await session.checkExternalChange()
  expect(session.getSnapshot().selected?.markdown).toBe('# 2024-02-29 External')
  expect(session.getSnapshot().selected?.editorEpoch).toBe(1)
  session.edit('# 2024-02-29 Local')
  files.set(date.toString(), { ...first, markdown: '# 2024-02-29 Newer', revision: 'r2' })
  await session.checkExternalChange()
  expect(session.getSnapshot().selected?.markdown).toBe('# 2024-02-29 Local')
  expect(session.getSnapshot().selected?.error?.code).toBe('conflict')
})
