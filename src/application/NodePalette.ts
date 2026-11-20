export const defaultNodeColors = [
  '#8fae94',
  '#a7c9ea',
  '#e9a9bb',
  '#e5c07b',
  '#b39ddb',
  '#9aa7b1',
] as const
export class NodePalette {
  private colors: readonly string[] = [...defaultNodeColors]
  private readonly storage: Storage
  private listeners = new Set<() => void>()
  constructor(storage: Storage) {
    this.storage = storage
    try {
      const value: unknown = JSON.parse(storage.getItem('diary.nodeColors.v1') ?? 'null')
      if (
        Array.isArray(value) &&
        value.length === 6 &&
        value.every((c) => typeof c === 'string' && /^#[\da-f]{6}$/i.test(c))
      )
        this.colors = value
    } catch {
      /* Defaults remain available. */
    }
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  getSnapshot = () => this.colors
  setColor(index: number, color: string) {
    if (!Number.isInteger(index) || index < 0 || index > 5 || !/^#[\da-f]{6}$/i.test(color))
      throw new Error('节点颜色无效')
    const next = [...this.colors]
    next[index] = color
    this.save(next)
  }
  reset() {
    this.save([...defaultNodeColors])
  }
  private save(colors: readonly string[]) {
    this.storage.setItem('diary.nodeColors.v1', JSON.stringify(colors))
    this.colors = colors
    this.listeners.forEach((fn) => fn())
  }
}

/** WCAG relative luminance; fall back to black/white for arbitrary user colors. */
export function readableInk(color: string, background: string): string {
  const luminance = (hex: string) => {
    const parts = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return parts[0]! * 0.2126 + parts[1]! * 0.7152 + parts[2]! * 0.0722
  }
  const bg = luminance(background),
    fg = luminance(color)
  return (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05) >= 4.5
    ? color
    : bg > 0.179
      ? '#000000'
      : '#ffffff'
}
