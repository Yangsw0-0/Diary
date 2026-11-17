import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react'
import { Tags } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import type { DiarySession } from '@/application/DiarySession'
import type { TagIndex } from '@/application/TagIndex'
import type { TagSection, TagReadFailure, TagService } from '@/application/TagService'

interface TagsContextValue {
  readonly index: TagIndex
  readonly service: TagService
  readonly session: DiarySession
  readonly selectedKey: string | null
  readonly select: (key: string) => void
}

const TagsContext = createContext<TagsContextValue | null>(null)

function useTags() {
  const context = useContext(TagsContext)
  if (!context) throw new Error('Tag panels require a provider')
  const version = useSyncExternalStore(context.index.subscribe, context.index.getVersion)
  const diary = useSyncExternalStore(context.session.subscribe, context.session.getSnapshot)
  return { ...context, version, diary }
}

export function createTagsPanels(index: TagIndex, service: TagService, session: DiarySession) {
  function Provider({ children }: PropsWithChildren) {
    const [selectedKey, select] = useState<string | null>(null)
    return (
      <TagsContext.Provider value={{ index, service, session, selectedKey, select }}>
        {children}
      </TagsContext.Provider>
    )
  }
  return { Provider, List: TagsList, Detail: TagsDetail }
}

export function TagsList() {
  const { index, selectedKey, select, diary } = useTags()
  const { frequent, singleDay } = index.listGroups()
  const dirty = !!diary.selected && diary.selected.version !== diary.selected.savedVersion
  const groupButton = (group: (typeof frequent)[number]) => (
    <li key={group.key}>
      <Button
        variant="ghost"
        className="tag-group-button"
        aria-current={selectedKey === group.key ? 'true' : undefined}
        onClick={() => select(group.key)}
      >
        <span title={group.displayTitle}>{group.displayTitle}</span>
        <small>{group.dayCount} 天</small>
      </Button>
    </li>
  )
  return (
    <>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">TOPICS</p>
          <h2>标签</h2>
        </div>
      </div>
      {index.isStale() && (
        <p className="panel-message workspace-error" role="alert">
          标签索引需要重建，请刷新日记列表。
        </p>
      )}
      {dirty && (
        <p className="panel-message" role="status">
          当前日记有未保存修改，保存后更新标签。
        </p>
      )}
      {frequent.length === 0 && singleDay.length === 0 && (
        <div className="panel-placeholder">
          <Tags aria-hidden="true" />
          <p>还没有可显示的主题</p>
          <span>日记中的二级标题会汇集在这里。</span>
        </div>
      )}
      {frequent.length > 0 && <ul className="tag-group-list">{frequent.map(groupButton)}</ul>}
      {singleDay.length > 0 && (
        <details className="tag-single-day">
          <summary>仅出现一次（{singleDay.length}）</summary>
          <ul className="tag-group-list">{singleDay.map(groupButton)}</ul>
        </details>
      )}
    </>
  )
}

export function TagsDetail() {
  const { index, service, selectedKey, version, diary } = useTags()
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [sections, setSections] = useState<readonly TagSection[]>([])
  const [failures, setFailures] = useState<readonly TagReadFailure[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!selectedKey) return
    let current = true
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    void service.getSections(selectedKey, controller.signal).then(
      (next) => {
        if (!current) return
        setSections(next.sections)
        setFailures(next.failures)
        setLoadedKey(selectedKey)
        setLoading(false)
      },
      (reason: unknown) => {
        if (!current) return
        setSections([])
        setFailures([])
        setLoadedKey(selectedKey)
        setError(reason instanceof Error ? reason.message : '读取标签内容失败')
        setLoading(false)
      },
    )
    return () => {
      current = false
      controller.abort()
    }
  }, [service, selectedKey, version])

  if (!selectedKey)
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Tags aria-hidden="true" />
        </div>
        <p className="eyebrow">FOLLOW YOUR THEMES</p>
        <h2>把同一个主题，放在一起看</h2>
        <p>选择左侧标签，阅读各日期的相关内容。</p>
      </div>
    )
  const group = [...index.listGroups().frequent, ...index.listGroups().singleDay].find(
    (item) => item.key === selectedKey,
  )
  return (
    <article className="tag-detail">
      <header>
        <p className="eyebrow">TOPIC</p>
        <h2>{group?.displayTitle ?? selectedKey}</h2>
        <p className="workspace-status">{group?.dayCount ?? 0} 天</p>
      </header>
      {!!diary.selected && diary.selected.version !== diary.selected.savedVersion && (
        <p className="tag-draft-notice">当前日记的修改尚未保存；这里显示最后一次成功保存的内容。</p>
      )}
      {(loading || loadedKey !== selectedKey) && <p className="panel-message">正在核对原日记…</p>}
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      {!loading && failures.length > 0 && (
        <div role="status" className="diary-failures">
          <strong>{failures.length} 个日期读取失败</strong>
          <ul>
            {failures.map((failure) => (
              <li key={failure.date.toString()}>
                {failure.date.toString()}：{failure.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!loading && !error && loadedKey === selectedKey && sections.length === 0 && (
        <p className="panel-message">此标签的原文已变化或不存在。</p>
      )}
      {!loading &&
        !error &&
        loadedKey === selectedKey &&
        sections.map(({ occurrence, markdown }) => (
          <section
            key={occurrence.date.toString() + ':' + occurrence.ordinal}
            className="tag-section"
          >
            <h3>
              {occurrence.date.toString()}
              {occurrence.ordinal > 0 ? ' · 第 ' + (occurrence.ordinal + 1) + ' 次' : ''}
            </h3>
            <div className="tag-section-content">
              <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
            </div>
          </section>
        ))}
    </article>
  )
}
