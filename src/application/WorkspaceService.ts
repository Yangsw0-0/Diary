export interface WorkspaceStatus {
  readonly root: string | null
  readonly configuredRoot: string | null
  readonly issue: string | null
}

export interface WorkspaceGateway {
  getStatus(): Promise<WorkspaceStatus>
  /** A cancelled native dialog returns null without changing the previous selection. */
  chooseRoot(): Promise<WorkspaceStatus | null>
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
}
