import { invoke } from '@tauri-apps/api/core'
import type { WorkspaceGateway, WorkspaceStatus } from '@/application/WorkspaceService'
import { DiaryError } from '@/domain/DiaryError'
import { mapIpcError } from './diaryIpc'

function nullableString(value: unknown): string | null {
  if (value === null || typeof value === 'string') return value
  throw new DiaryError('invalid_response', '工作区状态格式错误')
}

function decodeStatus(value: unknown): WorkspaceStatus {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DiaryError('invalid_response', '工作区状态格式错误')
  }
  const data = value as Record<string, unknown>
  return {
    root: nullableString(data.root),
    configuredRoot: nullableString(data.configuredRoot),
    issue: nullableString(data.issue),
  }
}

export const workspaceCommands = {
  status: 'get_workspace_status',
  choose: 'choose_diary_root',
} as const

export class TauriWorkspaceGateway implements WorkspaceGateway {
  private readonly invokeCommand: (command: string) => Promise<unknown>

  constructor(invokeCommand: (command: string) => Promise<unknown> = invoke) {
    this.invokeCommand = invokeCommand
  }

  async getStatus(): Promise<WorkspaceStatus> {
    try {
      return decodeStatus(await this.invokeCommand(workspaceCommands.status))
    } catch (error) {
      throw mapIpcError(error)
    }
  }

  async chooseRoot(): Promise<WorkspaceStatus | null> {
    try {
      const result = await this.invokeCommand(workspaceCommands.choose)
      return result === null ? null : decodeStatus(result)
    } catch (error) {
      throw mapIpcError(error)
    }
  }
}
