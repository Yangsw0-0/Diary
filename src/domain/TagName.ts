/** A heading's visible text and its optional branch. The source Markdown is untouched. */
export class TagName {
  readonly key: string
  readonly branch: string | null
  readonly displayTitle: string

  private constructor(key: string, branch: string | null, displayTitle: string) {
    this.key = key
    this.branch = branch
    this.displayTitle = displayTitle
  }

  static parse(title: string): TagName | null {
    const displayTitle = title.trim()
    if (!displayTitle) return null
    const match = /^(.+?)\s+-\s+(.+)$/.exec(displayTitle)
    const key = (match?.[1] ?? displayTitle).trim().normalize('NFC')
    const branch = match?.[2]?.trim() || null
    return new TagName(key, branch, displayTitle)
  }
}
