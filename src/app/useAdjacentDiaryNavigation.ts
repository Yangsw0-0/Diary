import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  AdjacentDiaryNavigator,
  type AdjacentDirection,
} from '@/application/AdjacentDiaryNavigator'
import type { DiarySessionSnapshot } from '@/application/DiarySession'
import type { DiaryDate } from '@/domain/DiaryDate'
import type { EditorReadyResult } from '@/application/EditorReadiness'
import type { NavigationContextValue } from '@/shared/NavigationContext'

interface AdjacentNavigationOptions {
  sessionSnapshot: DiarySessionSnapshot
  navigation: NavigationContextValue
  settingsOpen: boolean
  waitForDiaryReady: (date: DiaryDate) => Promise<EditorReadyResult>
  onError: (message: string) => void
}

/** Owns wheel/native listeners, animation lifetime, cancellation and preview state. */
export function useAdjacentDiaryNavigation({
  sessionSnapshot,
  navigation,
  settingsOpen,
  waitForDiaryReady,
  onError,
}: AdjacentNavigationOptions) {
  const activeId = navigation.view.moduleId
  const adjacentGesture = useRef(new AdjacentDiaryNavigator())
  const [adjacentPreview, setAdjacentPreview] = useState<{
    direction: 'older' | 'newer'
    date: string
    markdown: string
  } | null>(null)
  const [, setAdjacentBusy] = useState(false)
  const adjacentBusyRef = useRef(false)
  const [boundaryNotice, setBoundaryNotice] = useState<string | null>(null)
  const trackElement = useRef<HTMLDivElement>(null)
  const previewElement = useRef<HTMLDivElement>(null)
  const previewIdentity = useRef<string | null>(null)
  const trackOffset = useRef(0)
  const cancelTrackAnimation = useRef<(() => void) | null>(null)
  const gestureBaseOffset = useRef(0)
  const gestureDirection = useRef<AdjacentDirection | null>(null)
  const lastWheelAt = useRef(0)
  const gestureEpoch = useRef(0)
  const diaryContentElement = useRef<HTMLElement | null>(null)
  const wheelHandler = useRef<(element: HTMLElement, event: WheelEvent) => void>(() => {})
  const gestureIdle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unlockIdle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nativeGestureActive = useRef(false)
  const nativeMomentum = useRef(false)
  const pendingAdjacent = useRef<{
    target: (typeof sessionSnapshot.entries)[number]
    direction: AdjacentDirection
  } | null>(null)
  const phaseHandler = useRef<(phase: string) => void>(() => {})
  useEffect(() => {
    if (!isTauri() || !('__TAURI_INTERNALS__' in window)) return
    let cancelled = false
    let stop: (() => void) | undefined
    void listen<string>('diary-scroll-phase', (event) => phaseHandler.current(event.payload)).then(
      (unlisten) => {
        if (cancelled) unlisten()
        else stop = unlisten
      },
    )
    return () => {
      cancelled = true
      stop?.()
    }
  }, [])
  useEffect(
    () => () => {
      if (gestureIdle.current) clearTimeout(gestureIdle.current)
      if (unlockIdle.current) clearTimeout(unlockIdle.current)
      cancelTrackAnimation.current?.()
    },
    [],
  )
  useLayoutEffect(() => {
    if (adjacentPreview && previewElement.current)
      previewElement.current.scrollTop =
        adjacentPreview.direction === 'newer' ? previewElement.current.scrollHeight : 0
  }, [adjacentPreview])
  const setTrackOffset = (pixels: number) => {
    const height = diaryContentElement.current?.clientHeight || window.innerHeight
    trackOffset.current = Math.max(-height, Math.min(height, pixels))
    if (trackElement.current)
      trackElement.current.style.transform = `translate3d(0, ${trackOffset.current}px, 0)`
  }
  const animateTrack = (destination: number, duration = 280): Promise<boolean> => {
    cancelTrackAnimation.current?.()
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced || duration === 0) {
      setTrackOffset(destination)
      return Promise.resolve(true)
    }
    const from = trackOffset.current
    return new Promise((resolve) => {
      const started = performance.now()
      let frame = 0
      const tick = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - started) / duration))
        const eased = 1 - (1 - t) ** 4
        setTrackOffset(from + (destination - from) * eased)
        if (t < 1) frame = window.requestAnimationFrame(tick)
        else {
          cancelTrackAnimation.current = null
          resolve(true)
        }
      }
      cancelTrackAnimation.current = () => {
        window.cancelAnimationFrame(frame)
        cancelTrackAnimation.current = null
        resolve(false)
      }
      frame = window.requestAnimationFrame(tick)
    })
  }
  const clearPreview = () => {
    previewIdentity.current = null
    pendingAdjacent.current = null
    setAdjacentPreview(null)
  }
  const reboundAdjacent = () => {
    adjacentGesture.current.reset()
    void animateTrack(0, 300).then((finished) => {
      if (finished) clearPreview()
    })
  }
  const scheduleUnlock = () => {
    if (unlockIdle.current) clearTimeout(unlockIdle.current)
    if (adjacentBusyRef.current) return
    unlockIdle.current = setTimeout(() => {
      if (
        !adjacentBusyRef.current &&
        !nativeGestureActive.current &&
        Date.now() - lastWheelAt.current >= AdjacentDiaryNavigator.idleGapMs
      )
        adjacentGesture.current.unlock()
      else scheduleUnlock()
    }, AdjacentDiaryNavigator.idleGapMs)
  }
  const commitAdjacent = (
    target: (typeof sessionSnapshot.entries)[number],
    direction: AdjacentDirection,
  ) => {
    adjacentGesture.current.lock()
    adjacentBusyRef.current = true
    setAdjacentBusy(true)
    const epoch = ++gestureEpoch.current
    const height = diaryContentElement.current?.clientHeight || window.innerHeight
    const destination = direction === 'older' ? -height : height
    void (async () => {
      try {
        const finished = await animateTrack(
          destination,
          Math.abs(trackOffset.current - destination) < 1 ? 0 : 300,
        )
        if (!finished || epoch !== gestureEpoch.current) return
        let opened = false
        try {
          opened = await navigation.openDiary(target.date, direction === 'newer' ? 'end' : 'start')
        } catch {
          // The navigation layer reports the read/save error through its existing notice.
        }
        if (epoch !== gestureEpoch.current) return
        if (opened) {
          if (isTauri() && '__TAURI_INTERNALS__' in window) {
            const result = await waitForDiaryReady(target.date)
            if (result === 'cancelled') return
            if (result === 'timeout') onError('编辑器尚未就绪，请稍后重试打开日记。')
          }
          await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
          if (epoch !== gestureEpoch.current) return
          setTrackOffset(0)
          clearPreview()
        } else if (await animateTrack(0, 300)) clearPreview()
      } finally {
        if (epoch === gestureEpoch.current) {
          adjacentBusyRef.current = false
          setAdjacentBusy(false)
          scheduleUnlock()
        }
      }
    })()
  }
  const releaseAdjacent = () => {
    const pending = pendingAdjacent.current
    const decision = adjacentGesture.current.release(!!pending)
    if (decision === 'commit' && pending) commitAdjacent(pending.target, pending.direction)
    else if (decision === 'rebound') reboundAdjacent()
  }
  useLayoutEffect(() => {
    phaseHandler.current = (phase) => {
      if (phase === 'began') {
        nativeGestureActive.current = true
        nativeMomentum.current = false
        if (gestureIdle.current) clearTimeout(gestureIdle.current)
      } else if (phase === 'ended' || phase === 'cancelled') {
        const active = nativeGestureActive.current
        nativeGestureActive.current = false
        if (!active) return
        nativeMomentum.current = !!pendingAdjacent.current || trackOffset.current !== 0
        if (gestureIdle.current) clearTimeout(gestureIdle.current)
        if (phase === 'ended') releaseAdjacent()
        else reboundAdjacent()
      } else if (phase === 'mouse') {
        nativeMomentum.current = false
      }
    }
  })
  const onAdjacentWheel = (element: HTMLElement, event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) return
    if (nativeMomentum.current) {
      event.preventDefault()
      return
    }
    const now = Date.now()
    if (adjacentGesture.current.isLocked || adjacentBusyRef.current) {
      event.preventDefault()
      lastWheelAt.current = now
      scheduleUnlock()
      return
    }
    if (sessionSnapshot.opening || settingsOpen || activeId !== 'diary') return
    const selected = sessionSnapshot.selected
    if (!selected) return
    const index = sessionSnapshot.entries.findIndex((entry) => entry.date.equals(selected.date))
    if (index < 0) return
    const atTop = element.scrollTop <= 2
    const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 3
    const direction = event.deltaY > 0 ? 'older' : 'newer'
    if (
      (!nativeGestureActive.current &&
        now - lastWheelAt.current > AdjacentDiaryNavigator.idleGapMs) ||
      gestureDirection.current !== direction
    ) {
      cancelTrackAnimation.current?.()
      gestureBaseOffset.current = trackOffset.current
      gestureDirection.current = direction
    }
    lastWheelAt.current = now
    const gesture = adjacentGesture.current.add(
      event.deltaY,
      event.deltaMode,
      atTop,
      atBottom,
      element.clientHeight,
      now,
      nativeGestureActive.current,
    )
    if (gestureIdle.current) clearTimeout(gestureIdle.current)
    if (!gesture) {
      adjacentGesture.current.reset()
      if (trackOffset.current !== 0)
        void animateTrack(0, 300).then((finished) => {
          if (finished) clearPreview()
        })
      return
    }
    const target = sessionSnapshot.entries[index + (gesture.direction === 'older' ? 1 : -1)]
    event.preventDefault()
    const height = element.clientHeight || window.innerHeight
    const signed = gesture.direction === 'older' ? -1 : 1
    if (!target) {
      pendingAdjacent.current = null
      setBoundaryNotice(gesture.direction === 'older' ? '已经是最早的日记' : '已经是最新的日记')
      setTrackOffset(signed * Math.min(Math.abs(gesture.offset), 72))
      if (!nativeGestureActive.current)
        gestureIdle.current = setTimeout(reboundAdjacent, AdjacentDiaryNavigator.idleGapMs)
      return
    }
    pendingAdjacent.current = { target, direction: gesture.direction }
    if (boundaryNotice) setBoundaryNotice(null)
    const identity = gesture.direction + ':' + target.date.toString()
    if (previewIdentity.current !== identity) {
      previewIdentity.current = identity
      flushSync(() => {
        setAdjacentPreview({
          direction: gesture.direction,
          date: target.date.toString(),
          markdown: target.markdown,
        })
      })
    }
    const amount = gestureBaseOffset.current + gesture.offset
    setTrackOffset(
      gesture.phase === 'complete'
        ? signed * height
        : Math.max(-height + 1, Math.min(height - 1, amount)),
    )
    if (gesture.phase === 'complete') {
      commitAdjacent(target, gesture.direction)
      return
    }
    if (!nativeGestureActive.current)
      gestureIdle.current = setTimeout(releaseAdjacent, AdjacentDiaryNavigator.idleGapMs)
  }
  useLayoutEffect(() => {
    wheelHandler.current = onAdjacentWheel
  })
  const abortAdjacent = () => {
    if (!adjacentBusyRef.current && trackOffset.current === 0 && !previewIdentity.current) return
    gestureEpoch.current += 1
    if (gestureIdle.current) clearTimeout(gestureIdle.current)
    if (unlockIdle.current) clearTimeout(unlockIdle.current)
    cancelTrackAnimation.current?.()
    adjacentGesture.current.reset()
    nativeGestureActive.current = false
    nativeMomentum.current = false
    adjacentBusyRef.current = false
    setAdjacentBusy(false)
    void animateTrack(0, 280).then((finished) => {
      if (finished) clearPreview()
    })
  }
  const abortAdjacentRef = useRef(abortAdjacent)
  useLayoutEffect(() => {
    abortAdjacentRef.current = abortAdjacent
  })
  useEffect(() => {
    if (settingsOpen || activeId !== 'diary') abortAdjacentRef.current()
  }, [settingsOpen, activeId])
  useEffect(() => {
    const abort = () => abortAdjacentRef.current()
    window.addEventListener('resize', abort)
    return () => window.removeEventListener('resize', abort)
  }, [])
  useEffect(() => {
    const element = diaryContentElement.current
    if (!element) return
    const handleWheel = (event: WheelEvent) => wheelHandler.current(element, event)
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [])
  return { adjacentPreview, boundaryNotice, trackElement, previewElement, diaryContentElement }
}
