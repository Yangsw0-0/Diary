import type { DiaryRepository } from '@/domain/DiaryRepository'
import type { DiaryScan } from '@/domain/DiaryRepository'
import type { DiaryDate } from '@/domain/DiaryDate'
import type { DiaryEntry } from '@/domain/DiaryEntry'
import type { RevisionExpectation } from '@/domain/DiaryRepository'
import { TagIndex } from './TagIndex'
import { MarkdownSectionExtractor } from './MarkdownSectionExtractor'

/** Coordinates diary use cases; edit-session save ordering belongs to M3. */
export class DiaryService {
  private readonly repository: DiaryRepository
  private readonly index: TagIndex
  private readonly extractor = new MarkdownSectionExtractor()
  private saveSerial = 0
  private workspaceEpoch = 0
  private readonly latestSaved = new Map<string, { entry: DiaryEntry; serial: number }>()

  constructor(repository: DiaryRepository, index = new TagIndex()) {
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
    const entries = [
      ...scan.entries.filter((entry) => !changedDates.has(entry.date.toString())),
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
    this.reindex(saved)
    return saved
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

  clearIndex(): void {
    this.workspaceEpoch++
    this.latestSaved.clear()
    this.index.clear()
  }
}
