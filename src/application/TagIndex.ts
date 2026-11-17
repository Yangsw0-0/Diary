import type { DiaryDate } from '@/domain/DiaryDate'
import type { DiaryEntry, DiarySummary } from '@/domain/DiaryEntry'
import type { TagOccurrence } from '@/domain/TagOccurrence'
import { MarkdownSectionExtractor } from './MarkdownSectionExtractor'

export interface TagGroup {
  readonly key: string
  readonly displayTitle: string
  readonly dayCount: number
  readonly latestDate: DiaryDate
}

export interface TagGroups {
  readonly frequent: readonly TagGroup[]
  readonly singleDay: readonly TagGroup[]
}

/** In-memory bidirectional index; all mutations publish one completed snapshot. */
export class TagIndex {
  private readonly summaries = new Map<string, DiarySummary>()
  private stale = false
  private readonly byDate = new Map<string, readonly TagOccurrence[]>()
  private readonly byTag = new Map<string, Map<string, readonly TagOccurrence[]>>()
  private readonly listeners = new Set<() => void>()
  private version = 0
  private groupCache: { version: number; groups: TagGroups } | null = null

  private readonly extractor: MarkdownSectionExtractor

  constructor(extractor = new MarkdownSectionExtractor()) {
    this.extractor = extractor
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getVersion = (): number => this.version

  private publish(): void {
    this.version++
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {
        /* Derived subscribers cannot invalidate a committed file write. */
      }
    }
  }

  private insert(date: DiaryDate, next: readonly TagOccurrence[]): void {
    const day = date.toString()
    if (next.some((item) => !item.date.equals(date)))
      throw new Error('Tag occurrence date mismatch')
    this.byDate.set(day, [...next])
    const grouped = new Map<string, TagOccurrence[]>()
    for (const occurrence of next) {
      const group = grouped.get(occurrence.key) ?? []
      group.push(occurrence)
      grouped.set(occurrence.key, group)
    }
    for (const [key, occurrences] of grouped) {
      let dates = this.byTag.get(key)
      if (!dates) {
        dates = new Map()
        this.byTag.set(key, dates)
      }
      dates.set(day, occurrences)
    }
  }

  private remove(date: DiaryDate): void {
    const day = date.toString()
    for (const occurrence of this.byDate.get(day) ?? []) {
      const dates = this.byTag.get(occurrence.key)
      if (!dates) continue
      dates.delete(day)
      if (dates.size === 0) this.byTag.delete(occurrence.key)
    }
    this.byDate.delete(day)
    this.summaries.delete(day)
  }

  replaceDay(date: DiaryDate, next: readonly TagOccurrence[], summary?: DiarySummary): void {
    if (next.some((item) => !item.date.equals(date)))
      throw new Error('Tag occurrence date mismatch')
    this.remove(date)
    this.insert(date, next)
    if (summary) this.summaries.set(date.toString(), summary)
    this.publish()
  }

  removeDay(date: DiaryDate): void {
    this.remove(date)
    this.publish()
  }

  rebuild(entries: readonly DiaryEntry[]): void {
    const parsed = entries.map((entry) => ({
      date: entry.date,
      parsed: this.extractor.parse(entry.markdown, entry.date, entry.revision),
    }))
    this.byDate.clear()
    this.byTag.clear()
    this.summaries.clear()
    for (const day of parsed) {
      this.insert(day.date, day.parsed.occurrences)
      this.summaries.set(day.date.toString(), day.parsed.summary)
    }
    this.stale = false
    this.publish()
  }

  clear(): void {
    this.byDate.clear()
    this.byTag.clear()
    this.summaries.clear()
    this.stale = false
    this.publish()
  }

  markStale(): void {
    this.byDate.clear()
    this.byTag.clear()
    this.summaries.clear()
    this.stale = true
    this.publish()
  }

  isStale(): boolean {
    return this.stale
  }

  getSummary(date: DiaryDate): DiarySummary | undefined {
    return this.summaries.get(date.toString())
  }

  getOccurrences(key: string): readonly TagOccurrence[] {
    const dates = this.byTag.get(key)
    if (!dates) return []
    return [...dates.values()]
      .flat()
      .sort((a, b) => b.date.compare(a.date) || a.ordinal - b.ordinal)
  }

  listGroups(): TagGroups {
    if (this.groupCache?.version === this.version) return this.groupCache.groups
    const all: TagGroup[] = []
    for (const [key, dates] of this.byTag) {
      const latest = this.getOccurrences(key)[0]
      if (!latest) continue
      all.push({
        key,
        displayTitle: latest.displayTitle,
        dayCount: dates.size,
        latestDate: latest.date,
      })
    }
    all.sort(
      (a, b) => b.latestDate.compare(a.latestDate) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    )
    const groups = {
      frequent: all.filter((group) => group.dayCount >= 2),
      singleDay: all.filter((group) => group.dayCount === 1),
    }
    this.groupCache = { version: this.version, groups }
    return groups
  }
}
