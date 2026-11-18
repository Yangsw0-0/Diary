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
import { useNavigation } from '@/app/NavigationContext'
import type { DiarySession } from '@/application/DiarySession'
import type { TagIndex } from '@/application/TagIndex'
import { TagVisibility } from '@/application/TagVisibility'
import type { TagSection, TagReadFailure, TagService } from '@/application/TagService'
import { attachmentFileName, type AttachmentService } from '@/application/AttachmentService'
import type { DiaryDate } from '@/domain/DiaryDate'
import { openExternalLink } from '@/infrastructure/openExternalLink'

interface TagsContextValue {
  readonly index: TagIndex
  readonly service: TagService
  readonly session: DiarySession
  readonly attachments: AttachmentService
}

const TagsContext = createContext<TagsContextValue | null>(null)

function useTags() {
  const context = useContext(TagsContext)
  if (!context) throw new Error('Tag panels require a provider')
  const navigation = useNavigation()
  const version = useSyncExternalStore(context.index.subscribe, context.index.getVersion)
  const dirty = useSyncExternalStore(context.session.subscribe, context.session.getUnsavedSnapshot)
  const selectedKey = navigation.view.moduleId === 'tags' ? navigation.view.key : null
  return { ...context, version, dirty, navigation, selectedKey }
}

export function createTagsPanels(
  index: TagIndex,
  service: TagService,
  session: DiarySession,
  attachments: AttachmentService,
) {
  function Provider({ children }: PropsWithChildren) {
    return (
      <TagsContext.Provider value={{ index, service, session, attachments }}>
        {children}
      </TagsContext.Provider>
    )
  }
  return { Provider, List: TagsList, Detail: TagsDetail }
}

function TagImage({
  date,
  url,
  alt,
  attachments,
}: {
  date: DiaryDate
  url: string
  alt: string
  attachments: AttachmentService
}) {
  const [preview, setPreview] = useState<{ source: string; value: string } | null>(null)
  const [failedSource, setFailedSource] = useState<string | null>(null)
  useEffect(() => {
    if (!attachmentFileName(date, url)) return
    let current = true
    let objectUrl: string | null = null
    void attachments
      .previewUrl(date, url)
      .then((resolved) => {
        if (current) {
          objectUrl = resolved
          setPreview({ source: url, value: resolved })
          setFailedSource(null)
        } else if (resolved.startsWith('blob:')) URL.revokeObjectURL(resolved)
      })
      .catch(() => {
        if (current) setFailedSource(url)
      })
    return () => {
      current = false
      if (objectUrl?.startsWith('blob:')) URL.revokeObjectURL(objectUrl)
    }
  }, [attachments, date, url])
  if (failedSource === url) return <span role="status">图片无法预览：{alt}</span>
  return (
    <img
      src={attachmentFileName(date, url) ? (preview?.source === url ? preview.value : '') : url}
      alt={alt}
    />
  )
}

export function TagsList() {
  const { index, selectedKey, navigation, dirty } = useTags()
  const [visibility] = useState(() => new TagVisibility(window.localStorage))
  const [visibilityVersion, setVisibilityVersion] = useState(0)
  void visibilityVersion
  const [menu, setMenu] = useState<{ key: string; shown: boolean; x: number; y: number } | null>(
    null,
  )
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
    }
  }, [menu])
  const { frequent, singleDay } = index.listGroups(visibility)
  const groupButton = (group: (typeof frequent)[number], shown: boolean) => (
    <li key={group.key}>
      <Button
        variant="ghost"
        className="tag-group-button"
        aria-current={selectedKey === group.key ? 'true' : undefined}
        onClick={() => void navigation.openTag(group.key)}
        onContextMenu={(event) => {
          event.preventDefault()
          setMenu({ key: group.key, shown, x: event.clientX, y: event.clientY })
        }}
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
      {frequent.length > 0 && (
        <ul className="tag-group-list">{frequent.map((group) => groupButton(group, true))}</ul>
      )}
      {singleDay.length > 0 && (
        <details className="tag-single-day">
          <summary>隐藏的标签（{singleDay.length}）</summary>
          <ul className="tag-group-list">{singleDay.map((group) => groupButton(group, false))}</ul>
        </details>
      )}
      {menu && (
        <div
          className="diary-context-menu"
          role="menu"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              visibility.setShown(menu.key, !menu.shown)
              setMenu(null)
              setVisibilityVersion((current) => current + 1)
            }}
          >
            {menu.shown ? '隐藏' : '显示'}
          </button>
        </div>
      )}
    </>
  )
}

export function TagsDetail() {
  const { index, service, selectedKey, version, dirty, navigation, attachments } = useTags()
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

  useEffect(() => {
    if (selectedKey && loadedKey === selectedKey && !loading) navigation.restoreScroll()
  }, [selectedKey, loadedKey, loading, sections, navigation.restoreScroll])

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
  const groups = index.listGroups()
  const group = [...groups.frequent, ...groups.singleDay].find((item) => item.key === selectedKey)
  return (
    <article className="tag-detail">
      <header>
        <p className="eyebrow">TOPIC</p>
        <h2>{group?.displayTitle ?? selectedKey}</h2>
        <p className="workspace-status">{group?.dayCount ?? 0} 天</p>
      </header>
      {dirty && (
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
            <div className="tag-section-heading">
              <h3>
                <Button
                  variant="link"
                  className="tag-section-date-button"
                  onClick={() =>
                    void navigation.openDiarySection({
                      date: occurrence.date,
                      key: occurrence.key,
                      ordinal: occurrence.ordinal,
                    })
                  }
                >
                  {occurrence.date.toString()}
                  {occurrence.ordinal > 0 ? ' · 第 ' + (occurrence.ordinal + 1) + ' 次' : ''}
                </Button>
              </h3>
              {occurrence.branch && <small>{occurrence.branch}</small>}
            </div>
            <div className="tag-section-content">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  img: ({ src, alt }) => (
                    <TagImage
                      date={occurrence.date}
                      url={src ?? ''}
                      alt={alt ?? ''}
                      attachments={attachments}
                    />
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      onClick={(event) => {
                        event.preventDefault()
                        if (!href) return
                        const opener = attachmentFileName(occurrence.date, href)
                          ? attachments.openUrl(occurrence.date, href)
                          : openExternalLink(href)
                        void opener.catch((reason: unknown) =>
                          setError(reason instanceof Error ? reason.message : '无法打开链接'),
                        )
                      }}
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {markdown}
              </Markdown>
            </div>
          </section>
        ))}
    </article>
  )
}
