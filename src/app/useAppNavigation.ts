import type { NodesSession } from '@/application/NodesSession'
import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  NavigationHistory,
  type DiarySectionRef,
  type NavigationView,
} from '@/application/NavigationHistory'
import { EditorReadiness } from '@/application/EditorReadiness'
import { MarkdownSectionExtractor } from '@/application/MarkdownSectionExtractor'
import type { DiarySession } from '@/application/DiarySession'
import type { DiaryDate } from '@/domain/DiaryDate'
import type { NavigationContextValue } from '@/shared/NavigationContext'

const extractor = new MarkdownSectionExtractor()

export function useAppNavigation(session: DiarySession, nodes?: NodesSession) {
  const [history] = useState(() => new NavigationHistory())
  const snapshot = useSyncExternalStore(history.subscribe, history.getSnapshot)
  const renamed = useSyncExternalStore(session.subscribe, () => session.getSnapshot().renamed)
  const trashed = useSyncExternalStore(session.subscribe, () => session.getSnapshot().trashed)
  const lastRename = useRef(0)
  const lastTrash = useRef(0)
  const [focusRequest, setFocusRequest] = useState<NavigationContextValue['focusRequest']>(null)
  const [cursorEdgeRequest, setCursorEdgeRequest] =
    useState<NavigationContextValue['cursorEdgeRequest']>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [navigating, setNavigating] = useState(false)
  const busy = useRef(false)
  const focusId = useRef(0)
  const scrollEpoch = useRef(0)
  const pendingEdge = useRef<string | null>(null)
  const [readiness] = useState(() => new EditorReadiness())
  useLayoutEffect(() => () => readiness.begin(null), [readiness])
  const content = useRef(new Map<string, HTMLElement>())
  const lastDiary = useRef<NavigationView | null>(null)
  const lastTags = useRef<NavigationView | null>(null)

  const capture = useCallback(() => {
    const current = history.current
    const element = content.current.get(current.moduleId)
    if (element) history.updateScroll(element.scrollTop)
    if (current.moduleId === 'diary') lastDiary.current = history.current
    else if (current.moduleId === 'tags') lastTags.current = history.current
  }, [history])

  const restoreScroll = useCallback(() => {
    const target = history.getSnapshot().current
    const epoch = scrollEpoch.current
    const restore = () => {
      if (history.getSnapshot().current !== target || scrollEpoch.current !== epoch) return
      const element = content.current.get(target.moduleId)
      if (!element) return
      const maximum = Math.max(0, element.scrollHeight - element.clientHeight)
      element.scrollTop = Math.min(target.scrollTop, maximum)
    }
    if (typeof window.requestAnimationFrame === 'function')
      window.requestAnimationFrame(() => window.requestAnimationFrame(restore))
    else setTimeout(restore, 0)
  }, [history])

  const editorReady = useCallback(
    (editorDate: DiaryDate) => {
      const date = editorDate.toString()
      if (history.current.moduleId !== 'diary' || history.current.date?.toString() !== date) return
      restoreScroll()
      const token = readiness.token
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => {
            if (token !== readiness.token) return
            if (pendingEdge.current === date) {
              pendingEdge.current = null
              const element = content.current.get('diary')
              if (element) history.updateScroll(element.scrollTop)
            }
            readiness.markReady(date, token)
          }),
        ),
      )
    },
    [history, restoreScroll, readiness],
  )

  const focusFor = useCallback(
    (view: NavigationView, restoreScroll = false): NavigationContextValue['focusRequest'] =>
      view.moduleId === 'diary' && view.section
        ? {
            date: view.section.date,
            key: view.section.key,
            ordinal: view.section.ordinal,
            id: ++focusId.current,
            restoreScroll,
          }
        : null,
    [],
  )

  useLayoutEffect(() => {
    if (!focusRequest) restoreScroll()
  }, [snapshot.current, focusRequest, restoreScroll])

  useLayoutEffect(() => {
    if (!renamed || renamed.sequence === lastRename.current) return
    lastRename.current = renamed.sequence
    history.rewriteDate(renamed.from, renamed.to)
    if (lastDiary.current?.moduleId === 'diary' && lastDiary.current.date?.equals(renamed.from)) {
      lastDiary.current = {
        ...lastDiary.current,
        date: renamed.to,
        section: lastDiary.current.section
          ? { ...lastDiary.current.section, date: renamed.to }
          : null,
      }
    }
  }, [history, renamed])

  useLayoutEffect(() => {
    if (!trashed || trashed.sequence === lastTrash.current) return
    lastTrash.current = trashed.sequence
    history.dropDate(trashed.date)
    if (lastDiary.current?.moduleId === 'diary' && lastDiary.current.date?.equals(trashed.date))
      lastDiary.current = null
  }, [history, trashed])

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
      if (nodes && history.current.moduleId === 'nodes') await nodes.flush()
      if (view.moduleId === 'nodes') {
        if (!(await session.flush())) return false
        await nodes?.ensureLoaded()
        return true
      }
      if (view.moduleId === 'tags') return session.flush()
      if (view.date === null) return session.deselect()
      if (session.getSnapshot().selected?.date.equals(view.date)) {
        await session.checkExternalChange()
        const error = session.getSnapshot().selected?.error
        if (error && ['not_found', 'corrupt_file', 'conflict'].includes(error.code)) return false
      }
      return session.open(view.date)
    },
    [session, nodes, history],
  )

  const navigate = useCallback(
    async (
      next: NavigationView,
      focus: NavigationContextValue['focusRequest'] = null,
      edge: 'start' | 'end' | null = null,
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
        readiness.begin(next.moduleId === 'diary' ? (next.date?.toString() ?? null) : null)
        pendingEdge.current =
          next.moduleId === 'diary' && next.date && edge === 'end' ? next.date.toString() : null
        history.push(next)
        setFocusRequest(focus ?? focusFor(next, true))
        setCursorEdgeRequest(
          next.moduleId === 'diary' && next.date && edge
            ? { date: next.date, edge, id: ++focusId.current }
            : null,
        )
        return true
      }),
    [activate, capture, focusFor, history, run, session, readiness],
  )

  const openDiary = useCallback(
    async (date: DiaryDate, edge: 'start' | 'end' = 'start') => {
      if (
        history.current.moduleId === 'diary' &&
        history.current.date?.equals(date) &&
        session.getSnapshot().selected?.date.equals(date)
      ) {
        await session.checkExternalChange()
        return !session.getSnapshot().selected?.error
      }
      return navigate(
        {
          moduleId: 'diary',
          date,
          section: null,
          scrollTop: edge === 'end' ? Number.MAX_SAFE_INTEGER : 0,
        },
        null,
        edge,
      )
    },
    [history, navigate, session],
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
        if (history.current.moduleId === 'diary' && history.current.date?.equals(date)) return true
        capture()
        readiness.begin(date.toString())
        history.push({ moduleId: 'diary', date, section: null, scrollTop: 0 })
        setFocusRequest(null)
        setCursorEdgeRequest({ date, edge: 'start', id: ++focusId.current })
        return true
      }),
    [capture, history, run, session, readiness],
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
        readiness.begin(ref.date.toString())
        history.push({
          moduleId: 'diary',
          date: ref.date,
          section: exists ? ref : null,
          scrollTop: 0,
        })
        setFocusRequest(
          exists
            ? focusFor({ moduleId: 'diary', date: ref.date, section: ref, scrollTop: 0 })
            : null,
        )
        if (!exists) setNotice('小节已变化，已打开该日记。')
        return true
      }),
    [activate, capture, focusFor, history, run, session, readiness],
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
    (moduleId: 'diary' | 'tags' | 'nodes') => {
      if (history.current.moduleId === moduleId) return Promise.resolve(true)
      if (moduleId === 'nodes') return navigate({ moduleId: 'nodes', scrollTop: 0 })
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
        readiness.begin(target.moduleId === 'diary' ? (target.date?.toString() ?? null) : null)
        if (direction === 'back') history.back()
        else history.forward()
        setFocusRequest(focusFor(target, true))
        setCursorEdgeRequest(null)
        return true
      }),
    [activate, capture, focusFor, history, run, session, readiness],
  )

  const navigation: NavigationContextValue = {
    view: snapshot.current,
    canGoBack: snapshot.canGoBack,
    canGoForward: snapshot.canGoForward,
    focusRequest,
    cursorEdgeRequest,
    notice,
    openModule,
    openDiary,
    createDiary,
    openDiarySection,
    openTag,
    back: () => travel('back'),
    forward: () => travel('forward'),
    restoreScroll,
    editorReady,
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
      if (history.current.moduleId === id && !(id === 'diary' && pendingEdge.current)) {
        scrollEpoch.current++
        history.updateScroll(scrollTop)
      }
    },
    waitForDiaryReady: (date: DiaryDate) => readiness.wait(date.toString()),
  }
}
