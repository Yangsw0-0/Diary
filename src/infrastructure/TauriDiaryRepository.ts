import { invoke } from '@tauri-apps/api/core'
import type { DiaryDate } from '@/domain/DiaryDate'
import type { DiaryEntry } from '@/domain/DiaryEntry'
import type { DiaryRepository, DiaryScan, RevisionExpectation } from '@/domain/DiaryRepository'
import { decodeEntry, decodeScan, diaryCommands, mapIpcError } from './diaryIpc'

/** Adapter contract for Rust commands that will be implemented in M2. */
export class TauriDiaryRepository implements DiaryRepository {
  private readonly invokeCommand: (
    command: string,
    args?: Record<string, unknown>,
  ) => Promise<unknown>

  constructor(
    invokeCommand: (command: string, args?: Record<string, unknown>) => Promise<unknown> = invoke,
  ) {
    this.invokeCommand = invokeCommand
  }

  async list(): Promise<DiaryScan> {
    try {
      return decodeScan(await this.invokeCommand(diaryCommands.list))
    } catch (error) {
      throw mapIpcError(error)
    }
  }

  async read(date: DiaryDate): Promise<DiaryEntry> {
    try {
      return decodeEntry(await this.invokeCommand(diaryCommands.read, { date: date.toString() }))
    } catch (error) {
      throw mapIpcError(error)
    }
  }

  async save(
    date: DiaryDate,
    markdown: string,
    expectation: RevisionExpectation,
  ): Promise<DiaryEntry> {
    try {
      return decodeEntry(
        await this.invokeCommand(diaryCommands.save, {
          date: date.toString(),
          markdown,
          expectation,
        }),
      )
    } catch (error) {
      throw mapIpcError(error)
    }
  }
}
