export type DiaryErrorCode =
  | 'conflict'
  | 'not_found'
  | 'corrupt_file'
  | 'permission_denied'
  | 'invalid_response'
  | 'invalid_date'
  | 'unexpected'

export class DiaryError extends Error {
  readonly code: DiaryErrorCode

  constructor(code: DiaryErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.code = code
    this.name = 'DiaryError'
  }
}
