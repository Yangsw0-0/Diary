import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  NavigationHistory,
  type DiarySectionRef,
  type NavigationView,
} from '@/application/NavigationHistory'
import { MarkdownSectionExtractor } from '@/application/MarkdownSectionExtractor'
import type { DiarySession } from '@/application/DiarySession'
import type { DiaryDate } from '@/domain/DiaryDate'
import type { NavigationContextValue } from './NavigationContext'

const extractor = new MarkdownSectionExtractor()

export function useAppNavigation(session: DiarySession) {
  const [history] = useState(() => new NavigationHistory())
  const snapshot = useSyncExternalStore(history.subscribe, history.getSnapshot)
  const [focusRequest, setFocusRequest] = useState<NavigationContextValue['focusRequest']>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [navigating, setNavigating] = useState(false)
  const busy = useRef(false)
  const focusId = useRef(0)
  const content = useRef(new Map<string, HTMLElement>())
  const lastDiary = useRef<NavigationView | null>(null)
  const lastTags = useRef<NavigationView | null>(null)

  const capture = useCallback(() => {
    const current = history.current
    const element = content.current.get(current.moduleId)
    if (element) history.updateScroll(element.scrollTop)
    if (current.moduleId === 'diary') lastDiary.current = history.current
    else lastTags.current = history.current
  }, [history])

  const restoreScroll = useCallback(() => {
    const target = history.getSnapshot().current
    const restore = () => {
      if (history.getSnapshot().current !== target) return
      const element = content.current.get(target.moduleId)
      if (!element) return
      const maximum = Math.max(0, element.scrollHeight - element.clientHeight)
      element.scrollTop = Math.min(target.scrollTop, maximum)
    }
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(restore)
    else setTimeout(restore, 0)
  }, [history])

  useLayoutEffect(() => {
    if (!focusRequest) restoreScroll()
  }, [snapshot.current, focusRequest, restoreScroll])

  const run = useCallback(async (operation: () => Promise<boolean>): Promise<boolean> => {
    if (busy.current) return false
    busy.current = true
    setNavigating(true)
    try {
      return await operation()
    } finally {
      busy.current = false
      setNavigating(false)
    }
  }, [])

  const activate = useCallback(
    async (view: NavigationView): Promise<boolean> => {
      if (view.moduleId === 'tags') return session.flush()
      if (view.date === null) return session.deselect()
      if (session.getSnapshot().selected?.date.equals(view.date)) {
        await session.checkExternalChange()
        const error = session.getSnapshot().selected?.error
        if (error && ['not_found', 'corrupt_file', 'conflict'].includes(error.code)) return false
      }
      return session.open(view.date)
    },
    [session],
  )

  const navigate = useCallback(
    async (
      next: NavigationView,
      focus: NavigationContextValue['focusRequest'] = null,
    ): Promise<boolean> =>
      run(async () => {
        setNotice(null)
        if (!(await activate(next))) {
          if (
            history.current.moduleId === 'tags' ||
            !(session.getSnapshot().selected?.error ?? session.getSnapshot().error)
          )
            setNotice(
              session.getSnapshot().selected?.error?.message ??
                session.getSnapshot().error?.message ??
                '保存或打开日记失败，已留在当前页面。',
            )
          return false
        }
        capture()
        history.push(next)
        setFocusRequest(focus)
        return true
      }),
    [activate, capture, history, run, session],
  )

  const openDiary = useCallback(
    (date: DiaryDate) => navigate({ moduleId: 'diary', date, section: null, scrollTop: 0 }),
    [navigate],
  )

  const createDiary = useCallback(
    () =>
      run(async () => {
        setNotice(null)
        if (!(await session.create())) {
          if (
            history.current.moduleId === 'tags' ||
            !(session.getSnapshot().selected?.error ?? session.getSnapshot().error)
          )
            setNotice(
              session.getSnapshot().selected?.error?.message ?? '新建日记失败，已保留当前草稿。',
            )
          return false
        }
        const date = session.getSnapshot().selected?.date
        if (!date) return false
        capture()
        history.push({ moduleId: 'diary', date, section: null, scrollTop: 0 })
        setFocusRequest(null)
        return true
      }),
    [capture, history, run, session],
  )

  const openDiarySection = useCallback(
    (ref: DiarySectionRef) =>
      run(async () => {
        setNotice(null)
        if (!(await activate({ moduleId: 'diary', date: ref.date, section: ref, scrollTop: 0 }))) {
          setNotice(
            session.getSnapshot().selected?.error?.message ??
              session.getSnapshot().error?.message ??
              '无法打开原日记。',
          )
          return false
        }
        const selected = session.getSnapshot().selected
        const exists =
          !!selected &&
          extractor
            .parse(selected.markdown, ref.date, selected.revision ?? '')
            .occurrences.some((item) => item.key === ref.key && item.ordinal === ref.ordinal)
        capture()
        history.push({
          moduleId: 'diary',
          date: ref.date,
          section: exists ? ref : null,
          scrollTop: 0,
        })
        setFocusRequest(
          exists ? { key: ref.key, ordinal: ref.ordinal, id: ++focusId.current } : null,
        )
        if (!exists) setNotice('小节已变化，已打开该日记。')
        return true
      }),
    [activate, capture, history, run, session],
  )

  const openTag = useCallback(
    (key: string) => {
      if (history.current.moduleId === 'tags' && history.current.key === key)
        return Promise.resolve(true)
      return navigate({ moduleId: 'tags', key, scrollTop: 0 })
    },
    [history, navigate],
  )

  const openModule = useCallback(
    (moduleId: 'diary' | 'tags') => {
      if (history.current.moduleId === moduleId) return Promise.resolve(true)
      if (moduleId === 'tags') {
        const recent = lastTags.current
        return navigate(
          recent?.moduleId === 'tags' ? recent : { moduleId: 'tags', key: null, scrollTop: 0 },
        )
      }
      const recent = lastDiary.current
      const target: NavigationView =
        recent?.moduleId === 'diary'
          ? recent
          : {
              moduleId: 'diary',
              date: session.getSnapshot().selected?.date ?? null,
              section: null,
              scrollTop: 0,
            }
      return navigate(target).then(async (opened) => {
        if (opened || target.date === null || session.isDirty()) return opened
        const error = session.getSnapshot().selected?.error ?? session.getSnapshot().error
        if (error?.code !== 'not_found') return false
        const fallback = await navigate({
          moduleId: 'diary',
          date: null,
          section: null,
          scrollTop: 0,
        })
        if (fallback) setNotice('原日记已失效，已打开日记列表。')
        return fallback
      })
    },
    [history, navigate, session],
  )

  const travel = useCallback(
    (direction: 'back' | 'forward') =>
      run(async () => {
        const target = direction === 'back' ? history.peekBack() : history.peekForward()
        if (!target) return false
        setNotice(null)
        if (!(await activate(target))) {
          if (
            history.current.moduleId === 'tags' ||
            !(session.getSnapshot().selected?.error ?? session.getSnapshot().error)
          )
            setNotice(
              session.getSnapshot().selected?.error?.message ??
                session.getSnapshot().error?.message ??
                '保存或打开日记失败，已留在当前页面。',
            )
          return false
        }
        capture()
        if (direction === 'back') history.back()
        else history.forward()
        setFocusRequest(null)
        return true
      }),
    [activate, capture, history, run, session],
  )

  const navigation: NavigationContextValue = {
    view: snapshot.current,
    canGoBack: snapshot.canGoBack,
    canGoForward: snapshot.canGoForward,
    focusRequest,
    notice,
    openModule,
    openDiary,
    createDiary,
    openDiarySection,
    openTag,
    back: () => travel('back'),
    forward: () => travel('forward'),
    restoreScroll,
    reportMissingSection: () => setNotice('小节已变化，已打开该日记。'),
  }

  return {
    navigation,
    navigating,
    registerContent: (id: string, element: HTMLElement | null) => {
      if (element) content.current.set(id, element)
      else content.current.delete(id)
    },
    updateScroll: (id: string, scrollTop: number) => {
      if (history.current.moduleId === id) history.updateScroll(scrollTop)
    },
  }
}
