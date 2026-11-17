export interface WorkspaceStatus {
  readonly root: string | null
  readonly configuredRoot: string | null
  readonly issue: string | null
  readonly sidebarWidth?: number | null
  readonly sidebarCollapsed?: boolean
  readonly theme?: 'light' | 'dark'
}

export interface WorkspaceGateway {
  getStatus(): Promise<WorkspaceStatus>
  /** A cancelled native dialog returns null without changing the previous selection. */
  chooseRoot(): Promise<WorkspaceStatus | null>
  savePreferences?(width: number | null, collapsed: boolean): Promise<void>
  saveTheme?(theme: 'light' | 'dark'): Promise<void>
}

export class WorkspaceService {
  private readonly gateway: WorkspaceGateway

  constructor(gateway: WorkspaceGateway) {
    this.gateway = gateway
  }

  getStatus(): Promise<WorkspaceStatus> {
    return this.gateway.getStatus()
  }

  chooseRoot(): Promise<WorkspaceStatus | null> {
    return this.gateway.chooseRoot()
  }

  savePreferences(width: number | null, collapsed: boolean): Promise<void> {
    return this.gateway.savePreferences?.(width, collapsed) ?? Promise.resolve()
  }

  saveTheme(theme: 'light' | 'dark'): Promise<void> {
    return this.gateway.saveTheme?.(theme) ?? Promise.resolve()
  }
}
