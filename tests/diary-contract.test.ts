import { describe, expect, it, vi } from 'vitest'
import { DiaryDate } from '@/domain/DiaryDate'
import { DiaryError } from '@/domain/DiaryError'
import { TauriDiaryRepository } from '@/infrastructure/TauriDiaryRepository'
import { ModuleRegistry } from '@/app/moduleRegistry'
import { BookOpenText } from 'lucide-react'

describe('DiaryDate', () => {
  it('accepts leap days and rejects impossible dates or path fragments', () => {
    expect(DiaryDate.parse('2024-02-29').toString()).toBe('2024-02-29')
    expect(DiaryDate.parse('2024-02-29').year).toBe('2024')
    expect(DiaryDate.parse('2024-02-29').fileName).toBe('2024-02-29.md')
    expect(DiaryDate.parse('2024-02-29').compare(DiaryDate.parse('2024-03-01'))).toBe(-1)
    for (const value of ['2023-02-29', '0000-01-01', '2024-13-01', '../2024-01-01', '2024-1-1']) {
      expect(() => DiaryDate.parse(value)).toThrow()
    }
  })
})

describe('ModuleRegistry', () => {
  it('rejects duplicates, missing defaults, and unknown modules', () => {
    const registry = new ModuleRegistry('diary')
    expect(() => registry.validate()).toThrow('diary')
    const module = {
      id: 'diary',
      label: '日记',
      Icon: BookOpenText,
      listLabel: '列表',
      detailLabel: '正文',
      List: () => null,
      Detail: () => null,
    }
    registry.register(module)
    registry.validate()
    expect(() => registry.register(module)).toThrow('already registered')
    expect(() => registry.require('missing')).toThrow('Unknown feature module')
    expect(Object.isFrozen(registry.list())).toBe(true)
  })
})

describe('TauriDiaryRepository IPC boundary', () => {
  const date = DiaryDate.parse('2024-02-29')
  const entry = { date: '2024-02-29', markdown: '# Today', revision: 'abc' }

  it('serializes dates and revision expectations and decodes entries', async () => {
    const invoke = vi.fn().mockResolvedValue(entry)
    const repository = new TauriDiaryRepository(invoke)
    expect((await repository.read(date)).date.toString()).toBe('2024-02-29')
    await repository.save(date, '# Today', { kind: 'new' })
    await repository.save(date, '# Later', { kind: 'match', revision: 'abc' })
    expect(invoke).toHaveBeenNthCalledWith(1, 'read_diary', { date: '2024-02-29' })
    expect(invoke).toHaveBeenNthCalledWith(2, 'save_diary', {
      date: '2024-02-29',
      markdown: '# Today',
      expectation: { kind: 'new' },
    })
    expect(invoke).toHaveBeenNthCalledWith(3, 'save_diary', {
      date: '2024-02-29',
      markdown: '# Later',
      expectation: { kind: 'match', revision: 'abc' },
    })
  })

  it('preserves partial scan failures and rejects invalid IPC data', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        entries: [entry],
        failures: [{ fileName: 'bad.md', reason: 'invalid date' }],
      })
      .mockResolvedValueOnce({ entries: [{ ...entry, date: '../bad' }], failures: [] })
    const repository = new TauriDiaryRepository(invoke)
    const scan = await repository.list()
    expect(scan.entries[0]?.date.toString()).toBe('2024-02-29')
    expect(scan.failures).toEqual([{ fileName: 'bad.md', reason: 'invalid date' }])
    await expect(repository.list()).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('maps structured storage errors', async () => {
    const repository = new TauriDiaryRepository(
      vi.fn().mockRejectedValue({
        code: 'conflict',
        message: 'file changed',
      }),
    )
    await expect(repository.read(date)).rejects.toMatchObject({ code: 'conflict' })
    await expect(repository.read(date)).rejects.toBeInstanceOf(DiaryError)
  })
})
