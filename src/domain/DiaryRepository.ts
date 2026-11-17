import type { DiaryDate } from './DiaryDate'
import type { DiaryEntry } from './DiaryEntry'

export type RevisionExpectation =
  { readonly kind: 'new' } | { readonly kind: 'match'; readonly revision: string }

export interface DiaryFileFailure {
  readonly fileName: string
  readonly reason: string
}

export interface DiaryScan {
  /** Valid entries, newest date first. Title extraction belongs to the TS application layer. */
  readonly entries: readonly DiaryEntry[]
  /** Bad files do not prevent valid entries from loading. */
  readonly failures: readonly DiaryFileFailure[]
}

/** Failures reject with DiaryError; read rejects with not_found for a missing date. */
export interface DiaryRepository {
  list(): Promise<DiaryScan>
  read(date: DiaryDate): Promise<DiaryEntry>
  save(date: DiaryDate, markdown: string, expectation: RevisionExpectation): Promise<DiaryEntry>
}
