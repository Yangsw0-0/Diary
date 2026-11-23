import { invoke } from '@tauri-apps/api/core'
import type { CloudFile, WordCloudRepository } from '@/domain/WordCloudRepository'
function decode(value: unknown): CloudFile {
  if (
    !value ||
    typeof value !== 'object' ||
    !('json' in value) ||
    typeof value.json !== 'string' ||
    !('revision' in value) ||
    typeof value.revision !== 'string'
  )
    throw new Error('词云存储响应无效')
  return { json: value.json, revision: value.revision }
}
export class TauriWordCloudRepository implements WordCloudRepository {
  async read(): Promise<CloudFile | null> {
    const value: unknown = await invoke('read_word_cloud')
    return value === null ? null : decode(value)
  }
  async save(json: string, expectedRevision: string | null, force: boolean): Promise<CloudFile> {
    return decode(await invoke('save_word_cloud', { json, expectedRevision, force }))
  }
}
