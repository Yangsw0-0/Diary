/** Selects a stable candidate without changing the Markdown source. */
export class TagCompletion {
  private readonly candidates: (prefix: string) => readonly string[]

  constructor(candidates: (prefix: string) => readonly string[]) {
    this.candidates = candidates
  }

  suggest(prefix: string): string | null {
    const normalized = prefix.trim().normalize('NFC')
    if (!normalized) return null
    return this.candidates(normalized).find((item) => item.startsWith(normalized)) ?? null
  }
}
