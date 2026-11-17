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
  const width = data.sidebarWidth
  if (
    width != null &&
    (!Number.isInteger(width) || (width as number) < 172 || (width as number) > 500)
  ) {
    throw new DiaryError('invalid_response', '侧栏宽度格式错误')
  }
  if (data.sidebarCollapsed != null && typeof data.sidebarCollapsed !== 'boolean') {
    throw new DiaryError('invalid_response', '侧栏状态格式错误')
  }
  return {
    root: nullableString(data.root),
    configuredRoot: nullableString(data.configuredRoot),
    issue: nullableString(data.issue),
    sidebarWidth: width == null ? null : (width as number),
    sidebarCollapsed: data.sidebarCollapsed === true,
  }
}

export const workspaceCommands = {
  status: 'get_workspace_status',
  choose: 'choose_diary_root',
  preferences: 'save_ui_preferences',
} as const

export class TauriWorkspaceGateway implements WorkspaceGateway {
  private readonly invokeCommand: (
    command: string,
    args?: Record<string, unknown>,
  ) => Promise<unknown>

  constructor(
    invokeCommand: (command: string, args?: Record<string, unknown>) => Promise<unknown> = invoke,
  ) {
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

  async savePreferences(width: number | null, collapsed: boolean): Promise<void> {
    try {
      await this.invokeCommand(workspaceCommands.preferences, { width, collapsed })
    } catch (error) {
      throw mapIpcError(error)
    }
  }
}
