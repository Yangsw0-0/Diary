import { invoke } from '@tauri-apps/api/core'
import { mapIpcError } from './diaryIpc'

export async function openExternalLink(url: string): Promise<void> {
  try {
    await invoke('open_external_link', { url })
  } catch (reason) {
    throw mapIpcError(reason)
  }
}
