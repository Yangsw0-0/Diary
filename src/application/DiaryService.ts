import type { DiaryRepository } from '@/domain/DiaryRepository'
import type { DiaryScan } from '@/domain/DiaryRepository'
import type { DiaryDate } from '@/domain/DiaryDate'
import type { DiaryEntry } from '@/domain/DiaryEntry'
import type { RevisionExpectation } from '@/domain/DiaryRepository'
import { TagIndex } from './TagIndex'
import { MarkdownSectionExtractor } from './MarkdownSectionExtractor'
import { DiaryError } from '@/domain/DiaryError'

/** Coordinates diary use cases; edit-session save ordering belongs to M3. */
export class DiaryService {
  private readonly repository: DiaryRepository
  private readonly index: TagIndex
  private saveSerial = 0
  private workspaceEpoch = 0
  private readonly latestSaved = new Map<string, { entry: DiaryEntry; serial: number }>()
  private readonly latestRemoved = new Map<string, number>()

  private readonly extractor: MarkdownSectionExtractor
  private readonly clearDocuments: () => void

  constructor(
    repository: DiaryRepository,
    index = new TagIndex(),
    extractor = new MarkdownSectionExtractor(),
    clearDocuments: () => void = () => {},
  ) {
    this.extractor = extractor
    this.clearDocuments = clearDocuments
    this.repository = repository
    this.index = index
  }

  async list(): Promise<DiaryScan> {
    const startedAt = this.saveSerial
    const epoch = this.workspaceEpoch
    const scan = await this.repository.list()
    if (epoch !== this.workspaceEpoch) return scan
    const changed = [...this.latestSaved.values()].filter((item) => item.serial > startedAt)
    const changedDates = new Set(changed.map((item) => item.entry.date.toString()))
    const removedDates = new Set(
      [...this.latestRemoved].filter(([, serial]) => serial > startedAt).map(([date]) => date),
    )
    const entries = [
      ...scan.entries.filter(
        (entry) =>
          !changedDates.has(entry.date.toString()) && !removedDates.has(entry.date.toString()),
      ),
      ...changed.map((item) => item.entry),
    ]
    entries.sort((a, b) => b.date.compare(a.date))
    try {
      this.index.rebuild(entries)
    } catch {
      this.index.markStale()
    }
    return { ...scan, entries }
  }

  read(date: DiaryDate): Promise<DiaryEntry> {
    return this.repository.read(date)
  }

  async save(
    date: DiaryDate,
    markdown: string,
    expectation: RevisionExpectation,
  ): Promise<DiaryEntry> {
    const saved = await this.repository.save(date, markdown, expectation)
    this.latestSaved.set(date.toString(), { entry: saved, serial: ++this.saveSerial })
    this.latestRemoved.delete(date.toString())
    this.reindex(saved)
    return saved
  }

  async rename(oldDate: DiaryDate, markdown: string, revision: string): Promise<DiaryEntry> {
    if (!this.repository.rename) throw new DiaryError('unexpected', '当前存储不支持修改日期')
    const saved = await this.repository.rename(oldDate, markdown, revision)
    this.latestSaved.delete(oldDate.toString())
    this.latestRemoved.set(oldDate.toString(), ++this.saveSerial)
    this.latestSaved.set(saved.date.toString(), { entry: saved, serial: ++this.saveSerial })
    this.index.removeDay(oldDate)
    this.reindex(saved)
    return saved
  }

  async trash(date: DiaryDate, revision: string): Promise<void> {
    if (!this.repository.trash) throw new DiaryError('unexpected', '当前存储不支持删除日记')
    await this.repository.trash(date, revision)
    this.latestSaved.delete(date.toString())
    this.latestRemoved.set(date.toString(), ++this.saveSerial)
    this.index.removeDay(date)
  }

  reindex(entry: DiaryEntry): void {
    try {
      const parsed = this.extractor.parse(entry.markdown, entry.date, entry.revision)
      this.index.replaceDay(entry.date, parsed.occurrences, parsed.summary)
    } catch {
      this.index.markStale()
    }
  }

  getSummary(date: DiaryDate) {
    return this.index.getSummary(date)
  }

  getLabels(date: DiaryDate): readonly string[] {
    return this.index.getDayLabels(date)
  }

  clearIndex(): void {
    this.clearDocuments()
    this.workspaceEpoch++
    this.latestSaved.clear()
    this.latestRemoved.clear()
    this.index.clear()
  }
}
