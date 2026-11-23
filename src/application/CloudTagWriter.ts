import { TagName } from '@/domain/TagName'
import { todayDate, type DiarySession } from './DiarySession'
import { MarkdownSectionExtractor } from './MarkdownSectionExtractor'
import type { DiarySectionRef } from './NavigationHistory'

/** Appends literal H2 text through the existing draft/save pipeline, never a second writer. */
export class CloudTagWriter {
  private readonly session: DiarySession
  private readonly extractor: MarkdownSectionExtractor
  constructor(session: DiarySession, extractor = new MarkdownSectionExtractor()) {
    this.session = session
    this.extractor = extractor
  }

  async write(text: string): Promise<DiarySectionRef | null> {
    const name = TagName.parse(text)
    if (!name || /[\r\n]/.test(text)) throw new Error('词语包含换行或无法作为标签')
    const date = todayDate()
    if (!(await this.session.create(date))) return null
    if (this.session.getSnapshot().selected?.revision !== null)
      await this.session.checkExternalChange()
    const draft = this.session.getSnapshot().selected
    if (!draft || draft.error) return null
    const occurrences = this.extractor.parse(draft.markdown, date, draft.revision ?? '').occurrences
    const existing = occurrences.find(
      (item) => item.displayTitle.normalize('NFC') === name.displayTitle.normalize('NFC'),
    )
    if (!existing) {
      const label = name.displayTitle.replace(/([\\`*_{}[\]()<>#+.!|~])/g, '\\$1')
      const suffix = '\n\n## ' + label + '\n\n'
      const valid = this.extractor
        .parse(draft.markdown + suffix, date, '')
        .occurrences.some(
          (item) => item.displayTitle.normalize('NFC') === name.displayTitle.normalize('NFC'),
        )
      if (!valid)
        throw new Error('日记末尾可能有未闭合的代码或 HTML 块，请先完成该段内容再添加标签')
      this.session.appendSection(suffix)
    }
    // Even on save failure, open this draft so existing error/retry controls remain reachable.
    await this.session.flush()
    const latest = this.session.getSnapshot().selected!
    const occurrence =
      existing ??
      this.extractor
        .parse(latest.markdown, date, latest.revision ?? '')
        .occurrences.find(
          (item) => item.displayTitle.normalize('NFC') === name.displayTitle.normalize('NFC'),
        )
    if (!occurrence) throw new Error('无法定位新标签，原有内容已保留')
    return { date, key: name.key, ordinal: occurrence.ordinal }
  }
}
