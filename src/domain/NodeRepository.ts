export interface NodesFile {
  readonly json: string
  readonly revision: string
}
export interface NodeRepository {
  read(): Promise<NodesFile | null>
  save(json: string, expectedRevision: string | null, force: boolean): Promise<NodesFile>
  backup(): Promise<string | null>
}
