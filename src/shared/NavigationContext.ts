import { createContext, useContext } from 'react'
import type { DiaryDate } from '@/domain/DiaryDate'
import type { DiarySectionRef, NavigationView } from '@/application/NavigationHistory'

export interface NavigationContextValue {
  readonly view: NavigationView
  readonly canGoBack: boolean
  readonly canGoForward: boolean
  readonly focusRequest: {
    readonly date: DiaryDate
    readonly key: string
    readonly ordinal: number
    readonly id: number
    readonly restoreScroll?: boolean
  } | null
  readonly cursorEdgeRequest: {
    readonly date: DiaryDate
    readonly edge: 'start' | 'end'
    readonly id: number
  } | null
  readonly notice: string | null
  openModule(moduleId: 'diary' | 'tags' | 'nodes' | 'wordcloud'): Promise<boolean>
  openDiary(date: DiaryDate, edge?: 'start' | 'end'): Promise<boolean>
  createDiary(): Promise<boolean>
  openDiarySection(ref: DiarySectionRef): Promise<boolean>
  openTag(key: string): Promise<boolean>
  back(): Promise<boolean>
  forward(): Promise<boolean>
  restoreScroll(): void
  editorReady(date: DiaryDate): void
  reportMissingSection(): void
}

export const NavigationContext = createContext<NavigationContextValue | null>(null)

export function useNavigation(): NavigationContextValue {
  const value = useContext(NavigationContext)
  if (!value) throw new Error('Navigation requires AppShell')
  return value
}
