import { invoke } from '@tauri-apps/api/core'
import type { NodeRepository, NodesFile } from '@/domain/NodeRepository'
function decode(value: unknown): NodesFile {
  if (
    !value ||
    typeof value !== 'object' ||
    !('json' in value) ||
    typeof value.json !== 'string' ||
    !('revision' in value) ||
    typeof value.revision !== 'string'
  )
    throw new Error('节点存储响应无效')
  return { json: value.json, revision: value.revision }
}
export class TauriNodeRepository implements NodeRepository {
  async read(): Promise<NodesFile | null> {
    const result: unknown = await invoke('read_nodes')
    return result === null ? null : decode(result)
  }
  async save(json: string, expectedRevision: string | null, force: boolean): Promise<NodesFile> {
    return decode(await invoke('save_nodes', { json, expectedRevision, force }))
  }
  backup(): Promise<string | null> {
    return invoke('backup_nodes_file')
  }
}
