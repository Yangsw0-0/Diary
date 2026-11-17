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

export interface TagReadFailure {
  readonly date: DiaryDate
  readonly message: string
}

export interface TagDetailResult {
  readonly sections: readonly TagSection[]
  readonly failures: readonly TagReadFailure[]
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

  async getSections(key: string, signal?: AbortSignal): Promise<TagDetailResult> {
    const expected = this.index.getOccurrences(key)
    const dates = new Map<string, DiaryDate>()
    const revisions = new Map<string, string>()
    for (const occurrence of expected) {
      dates.set(occurrence.date.toString(), occurrence.date)
      revisions.set(occurrence.date.toString(), occurrence.revision)
    }
    const results = await Promise.all(
      [...dates].map(async ([day, date]) => {
        try {
          if (signal?.aborted) return { day, date, canceled: true } as const
          const entry = await this.diary.read(date)
          return { day, date, entry } as const
        } catch (reason) {
          return { day, date, reason } as const
        }
      }),
    )
    if (signal?.aborted) return { sections: [], failures: [] }

    const entries = new Map<string, DiaryEntry>()
    const failures: TagReadFailure[] = []
    for (const result of results) {
      if ('canceled' in result) continue
      if ('reason' in result) {
        if (result.reason instanceof DiaryError && result.reason.code === 'not_found') {
          this.index.removeDay(result.date)
        }
        failures.push({
          date: result.date,
          message: result.reason instanceof Error ? result.reason.message : '读取失败',
        })
        continue
      }
      const { day, date, entry } = result
      entries.set(day, entry)
      if (revisions.get(day) !== entry.revision) {
        try {
          const parsed = this.extractor.parse(entry.markdown, date, entry.revision)
          this.index.replaceDay(date, parsed.occurrences, parsed.summary)
        } catch (reason) {
          entries.delete(day)
          failures.push({
            date,
            message: reason instanceof Error ? reason.message : '标签索引更新失败',
          })
        }
      }
    }
    const sections = this.index.getOccurrences(key).flatMap((occurrence) => {
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
    return { sections, failures }
  }
}
