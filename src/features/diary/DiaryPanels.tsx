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
import type { DiaryDate } from '@/domain/DiaryDate'
import { CrepeEditor } from './CrepeEditor'

const DiaryContext = createContext<DiarySession | null>(null)

function useDiary(): [DiarySession, DiarySessionSnapshot] {
  const session = useContext(DiaryContext)
  if (!session) throw new Error('Diary panels require a provider')
  return [session, useSyncExternalStore(session.subscribe, session.getSnapshot)]
}

export function createDiaryPanels(session: DiarySession) {
  function Provider({ children }: PropsWithChildren) {
    useEffect(() => {
      void session.load()
    }, [])
    return <DiaryContext.Provider value={session}>{children}</DiaryContext.Provider>
  }
  return { Provider, List: DiaryList, Detail: DiaryDetail }
}

export function diaryTitle(markdown: string, date: DiaryDate): string {
  const first = markdown.split(/\r?\n/, 1)[0] ?? ''
  return first.replace(new RegExp(`^# ${date.toString()}(?:\\s+)?`), '').trim() || '未命名日记'
}

export function DiaryList() {
  const [session, { entries, failures, selected, loading, error }] = useDiary()
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
            disabled={loading}
            aria-label="刷新日记列表"
          >
            <RefreshCw aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            onClick={() => void session.create()}
            disabled={loading}
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
                  onClick={() => void session.open(entry.date)}
                >
                  <span className="diary-list-date">{entry.date.toString()}</span>
                  <span className="diary-list-title" title={diaryTitle(entry.markdown, entry.date)}>
                    {diaryTitle(entry.markdown, entry.date)}
                  </span>
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
  const [session, { selected }] = useDiary()
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
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
      <CrepeEditor
        key={selected.date.toString()}
        markdown={selected.markdown}
        onChange={(markdown) => session.edit(markdown)}
        onComposing={(value) => session.setComposing(value)}
      />
    </article>
  )
}
