import type { DiaryDate } from '@/domain/DiaryDate'
import { DiaryError } from '@/domain/DiaryError'
import type { DiaryEntry } from '@/domain/DiaryEntry'
import type { TagOccurrence } from '@/domain/TagOccurrence'
import type { DiaryService } from './DiaryService'
import { MarkdownSectionExtractor } from './MarkdownSectionExtractor'
import type { TagIndex } from './TagIndex'

export interface TagSection {
  readonly occurrence: TagOccurrence
  readonly markdown: string
}

/** Verifies on-disk revisions before exposing source-offset slices to the UI. */
export class TagService {
  private readonly diary: DiaryService
  private readonly index: TagIndex
  private readonly extractor: MarkdownSectionExtractor

  constructor(diary: DiaryService, index: TagIndex, extractor = new MarkdownSectionExtractor()) {
    this.diary = diary
    this.index = index
    this.extractor = extractor
  }

  async getSections(key: string): Promise<readonly TagSection[]> {
    const expected = this.index.getOccurrences(key)
    const entries = new Map<string, DiaryEntry>()
    const dates = new Map<string, DiaryDate>()
    const revisions = new Map<string, string>()
    for (const occurrence of expected) {
      dates.set(occurrence.date.toString(), occurrence.date)
      revisions.set(occurrence.date.toString(), occurrence.revision)
    }
    for (const [day, date] of dates) {
      try {
        const entry = await this.diary.read(date)
        entries.set(day, entry)
        if (revisions.get(day) !== entry.revision) {
          this.index.replaceDay(
            date,
            this.extractor.parse(entry.markdown, date, entry.revision).occurrences,
          )
        }
      } catch (reason) {
        if (reason instanceof DiaryError && reason.code === 'not_found') {
          this.index.removeDay(date)
          continue
        }
        throw reason
      }
    }
    return this.index.getOccurrences(key).flatMap((occurrence) => {
      const entry = entries.get(occurrence.date.toString())
      if (
        !entry ||
        entry.revision !== occurrence.revision ||
        occurrence.endOffset > entry.markdown.length ||
        occurrence.contentStartOffset > occurrence.endOffset
      )
        return []
      return [
        {
          occurrence,
          markdown: entry.markdown.slice(occurrence.contentStartOffset, occurrence.endOffset),
        },
      ]
    })
  }
}
