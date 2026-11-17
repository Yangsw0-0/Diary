import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react'
import { BookOpenText, CalendarDays, Plus, RefreshCw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DiarySession, type DiarySessionSnapshot } from '@/application/DiarySession'
import type { EditorAdapter } from '@/application/EditorAdapter'
import { CrepeEditor } from './CrepeEditor'
import { useNavigation } from '@/app/NavigationContext'

const DiaryContext = createContext<{
  session: DiarySession
  createAdapter: () => EditorAdapter
} | null>(null)

function useDiary(): readonly [DiarySession, DiarySessionSnapshot, () => EditorAdapter] {
  const context = useContext(DiaryContext)
  if (!context) throw new Error('Diary panels require a provider')
  return [
    context.session,
    useSyncExternalStore(context.session.subscribe, context.session.getSnapshot),
    context.createAdapter,
  ] as const
}

export function createDiaryPanels(session: DiarySession, createAdapter: () => EditorAdapter) {
  function Provider({ children }: PropsWithChildren) {
    useEffect(() => {
      void session.load()
    }, [])
    return (
      <DiaryContext.Provider value={{ session, createAdapter }}>{children}</DiaryContext.Provider>
    )
  }
  return { Provider, List: DiaryList, Detail: DiaryDetail }
}

export function DiaryList() {
  const [session, { entries, failures, selected, loading, opening, error }] = useDiary()
  const navigation = useNavigation()
  let year = ''
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
      {error && (
        <p role="alert" className="panel-message workspace-error">
          {error.message}
        </p>
      )}
      {!loading && entries.length === 0 && !selected && (
        <div className="panel-placeholder">
          <CalendarDays aria-hidden="true" />
          <p>还没有日记</p>
          <span>点击“新建”开始写今天的日记。</span>
        </div>
      )}
      {entries.length > 0 && (
        <ul className="diary-date-list">
          {entries.map((entry) => {
            const title = session.getSummary(entry.date) ?? ''
            const showYear = year !== entry.date.year
            year = entry.date.year
            return (
              <li key={entry.date.toString()}>
                {showYear && <h3 className="diary-year">{entry.date.year}</h3>}
                <Button
                  variant="ghost"
                  className="diary-date-button"
                  aria-label={entry.date.toString()}
                  aria-current={selected?.date.equals(entry.date) ? 'true' : undefined}
                  onClick={() => void navigation.openDiary(entry.date)}
                  disabled={opening}
                >
                  <span className="diary-list-date">{entry.date.toString()}</span>
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
    </>
  )
}

export function DiaryDetail() {
  const [session, { selected, opening }, createAdapter] = useDiary()
  const navigation = useNavigation()
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
        createAdapter={createAdapter}
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
