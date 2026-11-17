import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react'
import { BookOpenText, CalendarDays, Paperclip, Plus, RefreshCw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DiarySession, type DiarySessionSnapshot } from '@/application/DiarySession'
import type { EditorAdapter } from '@/application/EditorAdapter'
import { CrepeEditor } from './CrepeEditor'
import { useNavigation } from '@/app/NavigationContext'
import type { AttachmentService } from '@/application/AttachmentService'
import type { DiaryDate } from '@/domain/DiaryDate'

const DiaryContext = createContext<{
  session: DiarySession
  attachments: AttachmentService
  createAdapter: (date: DiaryDate) => EditorAdapter
} | null>(null)

function useDiary(): readonly [
  DiarySession,
  DiarySessionSnapshot,
  AttachmentService,
  (date: DiaryDate) => EditorAdapter,
] {
  const context = useContext(DiaryContext)
  if (!context) throw new Error('Diary panels require a provider')
  return [
    context.session,
    useSyncExternalStore(context.session.subscribe, context.session.getSnapshot),
    context.attachments,
    context.createAdapter,
  ] as const
}

export function createDiaryPanels(
  session: DiarySession,
  attachments: AttachmentService,
  createAdapter: (date: DiaryDate) => EditorAdapter,
) {
  function Provider({ children }: PropsWithChildren) {
    useEffect(() => {
      void session.load()
    }, [])
    return (
      <DiaryContext.Provider value={{ session, attachments, createAdapter }}>
        {children}
      </DiaryContext.Provider>
    )
  }
  return { Provider, List: DiaryList, Detail: DiaryDetail }
}

export function DiaryList() {
  const [session, { entries, failures, selected, loading, opening }] = useDiary()
  const navigation = useNavigation()
  const [menu, setMenu] = useState<{ date: DiaryDate; x: number; y: number } | null>(null)
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
  return (
    <>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">JOURNAL</p>
          <h2>日记</h2>
        </div>
        <div className="diary-list-actions">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void session.refresh()}
            disabled={loading || opening}
            aria-label="刷新日记列表"
          >
            <RefreshCw aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            onClick={() => void navigation.createDiary()}
            disabled={loading || opening}
            aria-label="新建今日日记"
          >
            <Plus aria-hidden="true" />
            新建
          </Button>
        </div>
      </div>
      {loading && <p className="panel-message">正在读取日记…</p>}
      {!loading && entries.length === 0 && !selected && (
        <div className="panel-placeholder">
          <CalendarDays aria-hidden="true" />
          <p>还没有日记</p>
          <span>点击“新建”开始写今天的日记。</span>
        </div>
      )}
      {entries.length > 0 && (
        <ul className="diary-date-list">
          {entries.map((entry, index) => {
            const title = session.getSummary(entry.date) ?? ''
            const previousYear = entries[index - 1]?.date.year
            const showYear = previousYear !== entry.date.year
            return (
              <li key={entry.date.toString()}>
                {showYear &&
                  (previousYear ? (
                    <div className="diary-year-divider">
                      <span>{previousYear}</span>
                      <hr />
                      <span>{entry.date.year}</span>
                    </div>
                  ) : (
                    <h3 className="diary-year">{entry.date.year}</h3>
                  ))}
                <Button
                  variant="ghost"
                  className="diary-date-button"
                  aria-label={entry.date.toString()}
                  aria-current={selected?.date.equals(entry.date) ? 'true' : undefined}
                  onClick={() => void navigation.openDiary(entry.date)}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    setMenu({ date: entry.date, x: event.clientX, y: event.clientY })
                  }}
                  disabled={opening}
                >
                  <span className="diary-list-date">
                    {entry.date.toString().slice(5).replace('-', '.')}
                  </span>
                  {title && (
                    <span className="diary-list-title" title={title}>
                      {title}
                    </span>
                  )}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      {failures.length > 0 && (
        <div className="diary-failures" role="status">
          <strong>{failures.length} 个文件未载入</strong>
          <ul>
            {failures.map((failure) => (
              <li key={failure.fileName}>
                {failure.fileName}：{failure.reason}
              </li>
            ))}
          </ul>
        </div>
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
              const date = menu.date
              setMenu(null)
              if (window.confirm(`将 ${date.toString()} 的日记移入回收文件夹？附件不会删除。`))
                void session.trash(date)
            }}
          >
            删除日记…
          </button>
        </div>
      )}
    </>
  )
}

export function DiaryDetail() {
  const [session, { selected, opening }, attachments, createAdapter] = useDiary()
  const navigation = useNavigation()
  const input = useRef<HTMLInputElement>(null)
  const insertId = useRef(0)
  const [insertRequest, setInsertRequest] = useState<{
    id: number
    markdown: string
    date: DiaryDate
  } | null>(null)
  const [importing, setImporting] = useState(false)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  const importFiles = async (files: readonly File[]) => {
    const date = session.getSnapshot().selected?.date
    if (!date || importing || files.length === 0) return
    setImporting(true)
    setAttachmentError(null)
    const links: string[] = []
    const failures: string[] = []
    for (const file of files) {
      try {
        const imported = await attachments.importFile(date, file)
        links.push(imported.markdown)
      } catch (reason) {
        failures.push(`${file.name}：${reason instanceof Error ? reason.message : '导入失败'}`)
      }
    }
    if (session.getSnapshot().selected?.date.equals(date)) {
      if (links.length)
        setInsertRequest({ id: ++insertId.current, markdown: links.join('\n\n'), date })
    } else if (links.length) {
      failures.push('导入期间切换了日记，附件已复制但未插入链接。')
    }
    if (failures.length) setAttachmentError(failures.join('；'))
    setImporting(false)
  }

  const openLink = (url: string) => {
    const date = session.getSnapshot().selected?.date
    if (!date) return
    void attachments.openUrl(date, url).then(
      (opened) => {
        if (!opened) setAttachmentError('附件链接无效或不属于当天日记')
      },
      (reason: unknown) =>
        setAttachmentError(reason instanceof Error ? reason.message : '无法打开附件'),
    )
  }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 's' &&
        document.querySelector('.workspace-panels:not([hidden]) .diary-editor-layout')
      ) {
        event.preventDefault()
        void session.flush()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [session])
  if (!selected)
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <BookOpenText aria-hidden="true" />
        </div>
        <p className="eyebrow">YOUR SPACE TO WRITE</p>
        <h2>选择一天，开始写作</h2>
        <p>点击左侧日期打开日记，或新建今日日记。</p>
      </div>
    )
  const status = selected.error
    ? `保存失败：${selected.error.message}。草稿仍在此页，请重试。`
    : selected.saving
      ? '正在保存…'
      : selected.version !== selected.savedVersion
        ? '尚未保存'
        : '已保存'
  return (
    <article className="diary-editor-layout">
      <div className="diary-editor-toolbar">
        <span>{selected.date.toString()}</span>
        <div className="diary-save-actions">
          <input
            ref={input}
            type="file"
            multiple
            className="attachment-file-input"
            aria-label="选择附件文件"
            onChange={(event) => {
              void importFiles([...(event.currentTarget.files ?? [])])
              event.currentTarget.value = ''
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => input.current?.click()}
            disabled={opening || importing}
            aria-label="添加附件"
          >
            <Paperclip aria-hidden="true" />
            {importing ? '导入中…' : '附件'}
          </Button>
          <span role="status" className={selected.error ? 'workspace-error' : 'workspace-status'}>
            {status}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void session.flush()}
            aria-label="保存日记"
          >
            <Save aria-hidden="true" />
            保存
          </Button>
        </div>
      </div>
      {attachmentError && (
        <p role="alert" className="attachment-error">
          {attachmentError}
        </p>
      )}
      {opening && (
        <p className="diary-transition-notice" role="status">
          正在切换，请稍候…
        </p>
      )}
      {selected.error && (
        <div className="diary-recovery" role="alert">
          <span>{selected.error.message}。草稿仍保留在编辑器中。</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (window.confirm('重新加载将放弃当前草稿，确定继续？'))
                void session.reloadSelected()
            }}
          >
            重新加载磁盘版本
          </Button>
          {selected.error.code === 'conflict' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (window.confirm('覆盖保存会用当前草稿替换磁盘上的版本，确定继续？'))
                  void session.overwriteSelected()
              }}
            >
              覆盖保存
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (window.confirm('确定放弃当前草稿？')) void session.discardDraft()
            }}
          >
            放弃草稿
          </Button>
        </div>
      )}
      <CrepeEditor
        key={selected.date.toString() + ':' + selected.editorEpoch}
        markdown={selected.markdown}
        onChange={(markdown) => session.edit(markdown)}
        onComposing={(value) => session.setComposing(value)}
        readOnly={opening}
        createAdapter={() => createAdapter(selected.date)}
        insertRequest={insertRequest?.date.equals(selected.date) ? insertRequest : null}
        onFiles={(files) => void importFiles(files)}
        onOpenLink={openLink}
        onInsertError={setAttachmentError}
        focusRequest={
          navigation.view.moduleId === 'diary' &&
          navigation.focusRequest?.date.equals(selected.date)
            ? navigation.focusRequest
            : null
        }
        onMissingSection={navigation.reportMissingSection}
        onReady={navigation.restoreScroll}
      />
    </article>
  )
}
