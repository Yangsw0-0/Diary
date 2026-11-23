import { useEffect, useRef, useState } from 'react'
import type { CloudPreferences, CloudWord } from '@/domain/WordCloud'
import { SphereRenderer } from './SphereRenderer'
export function WordSphere({
  words,
  preferences,
  active,
  onActivate,
}: {
  words: readonly CloudWord[]
  preferences: CloudPreferences
  active: boolean
  onActivate: (word: CloudWord) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    renderer = useRef<SphereRenderer | null>(null),
    activate = useRef(onActivate)
  const [hovered, setHovered] = useState<CloudWord | null>(null),
    [error, setError] = useState<string | null>(null)
  useEffect(() => {
    activate.current = onActivate
  }, [onActivate])
  useEffect(() => {
    let disposed = false
    try {
      const instance = new SphereRenderer(
        canvas.current!,
        (word) => activate.current(word),
        setHovered,
      )
      renderer.current = instance
      return () => {
        disposed = true
        instance.destroy()
        renderer.current = null
      }
    } catch (reason) {
      queueMicrotask(() => {
        if (!disposed) setError(reason instanceof Error ? reason.message : '无法绘制词云')
      })
      return () => {
        disposed = true
      }
    }
  }, [])
  useEffect(() => renderer.current?.setWords(words), [words])
  useEffect(() => renderer.current?.setPreferences(preferences), [preferences])
  useEffect(() => {
    renderer.current?.setActive(active)
    return () => renderer.current?.setActive(false)
  }, [active])
  return (
    <div className="cloud-stage">
      <canvas
        ref={canvas}
        className="cloud-canvas"
        tabIndex={0}
        role="img"
        aria-label="三维球形词云，可拖动、双指滑动或用方向键旋转；Enter选择最前方词语，管理面板提供所有词语的可访问列表"
      />
      <div className="cloud-stage-caption" aria-live="polite">
        {error ??
          (hovered
            ? `${hovered.text}${hovered.tagKey ? ' · 点击查看标签' : ' · 点击在今天开始写作'}`
            : words.length
              ? '拖动旋转 · 方向键也可操作'
              : '还没有词语，添加自定义词或开启已有标签')}
      </div>
    </div>
  )
}
