import { invoke } from '@tauri-apps/api/core'
import type { NodeRepository, NodesFile } from '@/domain/NodeRepository'

const friendly: Record<string, string> = {
  conflict: '节点文件已被外部修改，请重新载入或覆盖保存',
  permission_denied: '没有权限读写节点文件',
  not_found: '节点文件不存在',
  corrupt_file: '节点文件内容损坏',
  invalid_data: '节点文件结构或内容无效',
}

function fail(error: unknown): Error {
  if (error instanceof Error) return error
  if (typeof error === 'string') return new Error(error)
  if (error && typeof error === 'object') {
    const data = error as { code?: unknown; message?: unknown }
    const code = typeof data.code === 'string' ? data.code : ''
    const text = typeof data.message === 'string' ? data.message : ''
    if (/[\u4e00-\u9fff]/.test(text)) return new Error(text)
    if (code) return new Error(friendly[code] ?? '节点存储操作失败')
    if (text) return new Error(text)
  }
  return new Error('节点存储操作失败')
}

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
    try {
      const result: unknown = await invoke('read_nodes')
      return result === null ? null : decode(result)
    } catch (error) {
      throw fail(error)
    }
  }
  async save(json: string, expectedRevision: string | null, force: boolean): Promise<NodesFile> {
    try {
      return decode(await invoke('save_nodes', { json, expectedRevision, force }))
    } catch (error) {
      throw fail(error)
    }
  }
  async backup(): Promise<string | null> {
    try {
      return await invoke('backup_nodes_file')
    } catch (error) {
      throw fail(error)
    }
  }
}
