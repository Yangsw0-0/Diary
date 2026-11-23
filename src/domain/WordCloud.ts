export interface CustomCloudWord {
  readonly id: string
  readonly text: string
}
export type CloudLineMode = 'none' | 'grid' | 'constellation' | 'mixed'
export interface CloudPreferences {
  readonly showTags: boolean
  readonly autoRotate: boolean
  readonly lineMode: CloudLineMode
  readonly panelCollapsed: boolean
}
export interface CloudDocument {
  readonly version: 1
  readonly words: readonly CustomCloudWord[]
  readonly preferences: CloudPreferences
}
export interface CloudWord {
  readonly id: string
  readonly text: string
  readonly source: 'custom' | 'tag'
  readonly frequency?: number
  readonly level?: 0 | 1 | 2 | 3 | 4
  readonly customIds: readonly string[]
  readonly tagKey?: string
}
export const normalizeCloudText = (text: string) => text.trim().normalize('NFC')
export const emptyCloud = (): CloudDocument => ({
  version: 1,
  words: [],
  preferences: { showTags: true, autoRotate: true, lineMode: 'mixed', panelCollapsed: false },
})
export function decodeCloud(value: unknown): CloudDocument {
  if (!value || typeof value !== 'object') throw new Error('词云文件内容损坏')
  const doc = value as Record<string, unknown>
  if (doc.version !== 1) throw new Error('词云文件版本不受支持')
  if (!Array.isArray(doc.words) || doc.words.length > 500)
    throw new Error('词云最多保存500个自定义词语')
  const ids = new Set<string>(),
    texts = new Set<string>()
  const words = doc.words.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Error('词语格式无效')
    const word = raw as Record<string, unknown>
    if (
      typeof word.id !== 'string' ||
      !word.id.trim() ||
      ids.has(word.id) ||
      typeof word.text !== 'string'
    )
      throw new Error('词语ID或内容无效')
    const text = normalizeCloudText(word.text)
    if (!text || Array.from(text).length > 120 || texts.has(text))
      throw new Error('词语为空、重复或超过120字')
    ids.add(word.id)
    texts.add(text)
    return { id: word.id, text }
  })
  const preferences = { ...emptyCloud().preferences }
  if (doc.preferences !== undefined) {
    if (!doc.preferences || typeof doc.preferences !== 'object' || Array.isArray(doc.preferences))
      throw new Error('词云配置无效')
    const raw = doc.preferences as Record<string, unknown>
    for (const name of ['showTags', 'autoRotate', 'panelCollapsed'] as const) {
      if (raw[name] !== undefined) {
        if (typeof raw[name] !== 'boolean') throw new Error('词云配置无效')
        preferences[name] = raw[name]
      }
    }
    if (raw.lineMode !== undefined) {
      if (!['none', 'grid', 'constellation', 'mixed'].includes(String(raw.lineMode)))
        throw new Error('词云线条模式无效')
      preferences.lineMode = raw.lineMode as CloudLineMode
    }
  }
  return { version: 1, words, preferences }
}
export function mergeCloudWords(
  custom: readonly CustomCloudWord[],
  tags: readonly { key: string; displayTitle: string; frequency?: number }[],
  showTags: boolean,
): readonly CloudWord[] {
  const merged = new Map<string, CloudWord>()
  for (const word of custom) {
    const text = normalizeCloudText(word.text)
    merged.set(text, {
      id: text,
      text,
      source: 'custom',
      customIds: [word.id],
      frequency: 0,
      level: 0,
    })
  }
  const levels = frequencyLevels(tags.map((tag) => tag.frequency ?? 1))
  for (const tag of tags) {
    const text = normalizeCloudText(tag.displayTitle),
      current = merged.get(text)
    if (!showTags && !current) continue
    merged.set(text, {
      id: text,
      text,
      source: 'tag',
      customIds: current?.customIds ?? [],
      tagKey: tag.key,
      frequency: tag.frequency ?? 1,
      level: levels.get(tag.frequency ?? 1) ?? 0,
    })
  }
  return [...merged.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Upper cumulative percentile: ties share rank; [0,.2), [.2,.5), [.5,.9), [.9,1]. */
export function frequencyLevels(
  frequencies: readonly number[],
): ReadonlyMap<number, 1 | 2 | 3 | 4> {
  const sorted = frequencies.filter((n) => n > 0).sort((a, b) => a - b)
  const result = new Map<number, 1 | 2 | 3 | 4>()
  sorted.forEach((frequency, i) => {
    const p = (i + 1) / sorted.length
    result.set(frequency, p >= 0.9 ? 4 : p >= 0.5 ? 3 : p >= 0.2 ? 2 : 1)
  })
  return result
}
