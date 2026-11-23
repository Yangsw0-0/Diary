export interface CloudFile {
  readonly json: string
  readonly revision: string
}
export interface WordCloudRepository {
  read(): Promise<CloudFile | null>
  save(json: string, expectedRevision: string | null, force: boolean): Promise<CloudFile>
}
