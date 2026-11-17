import { DiaryDate } from '@/domain/DiaryDate'
import { DiaryError, type DiaryErrorCode } from '@/domain/DiaryError'
import type { DiaryEntry } from '@/domain/DiaryEntry'
import type { DiaryScan } from '@/domain/DiaryRepository'

export const diaryCommands = {
  list: 'list_diaries',
  read: 'read_diary',
  save: 'save_diary',
} as const

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DiaryError('invalid_response', '日记存储返回了无效数据')
  }
  return value as Record<string, unknown>
}

function string(value: unknown): string {
  if (typeof value !== 'string') {
    throw new DiaryError('invalid_response', '日记存储返回了无效文本')
  }
  return value
}

export function decodeEntry(value: unknown): DiaryEntry {
  const data = record(value)
  let date: DiaryDate
  try {
    date = DiaryDate.parse(string(data.date))
  } catch (error) {
    throw new DiaryError('invalid_response', '日记存储返回了无效日期', { cause: error })
  }
  const revision = string(data.revision)
  if (!revision) throw new DiaryError('invalid_response', '日记存储返回了空版本号')
  return { date, markdown: string(data.markdown), revision }
}

export function decodeScan(value: unknown): DiaryScan {
  const data = record(value)
  if (!Array.isArray(data.entries) || !Array.isArray(data.failures)) {
    throw new DiaryError('invalid_response', '日记扫描结果格式错误')
  }
  const entries = data.entries.map(decodeEntry)
  const failures = data.failures.map((value: unknown) => {
    const failure = record(value)
    return { fileName: string(failure.fileName), reason: string(failure.reason) }
  })
  return { entries, failures }
}

const errorCodes: readonly DiaryErrorCode[] = [
  'conflict',
  'not_found',
  'corrupt_file',
  'permission_denied',
  'invalid_date',
  'invalid_attachment',
  'unexpected',
]

export function mapIpcError(error: unknown): DiaryError {
  if (error instanceof DiaryError) return error
  if (error !== null && typeof error === 'object') {
    const data = error as Record<string, unknown>
    if (typeof data.code === 'string' && errorCodes.includes(data.code as DiaryErrorCode)) {
      return new DiaryError(data.code as DiaryErrorCode, String(data.message ?? data.code), {
        cause: error,
      })
    }
  }
  return new DiaryError('unexpected', '日记存储操作失败', { cause: error })
}
