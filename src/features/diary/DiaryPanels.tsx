import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import { BookOpenText, CalendarDays, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DiaryService } from '@/application/DiaryService'
import type { DiaryDate } from '@/domain/DiaryDate'
import type { DiaryEntry } from '@/domain/DiaryEntry'
import type { DiaryFileFailure } from '@/domain/DiaryRepository'

interface DiaryPanelState {
  readonly entries: readonly DiaryEntry[]
  readonly failures: readonly DiaryFileFailure[]
  readonly selected: DiaryEntry | null
  readonly loading: boolean
  readonly error: string | null
  readonly select: (date: DiaryDate) => void
  readonly refresh: () => void
}

const DiaryContext = createContext<DiaryPanelState | null>(null)

function useDiaryPanels(): DiaryPanelState {
  const state = useContext(DiaryContext)
  if (!state) throw new Error('Diary panels require a provider')
  return state
}

export function createDiaryPanels(service: DiaryService) {
  function Provider({ children }: PropsWithChildren) {
    const [entries, setEntries] = useState<readonly DiaryEntry[]>([])
    const [failures, setFailures] = useState<readonly DiaryFileFailure[]>([])
    const [selected, setSelected] = useState<DiaryEntry | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [refreshKey, setRefreshKey] = useState(0)
    const readSequence = useRef(0)

    useEffect(() => {
      let current = true
      service
        .list()
        .then(
          (scan) => {
            if (!current) return
            setEntries(scan.entries)
            setFailures(scan.failures)
            setError(null)
            setSelected(null)
          },
          (reason: unknown) => {
            if (current) setError(reason instanceof Error ? reason.message : '读取日记列表失败')
          },
        )
        .finally(() => {
          if (current) setLoading(false)
        })
      return () => {
        current = false
      }
    }, [refreshKey])

    function select(date: DiaryDate) {
      const sequence = ++readSequence.current
      setError(null)
      service.read(date).then(
        (entry) => {
          if (sequence === readSequence.current) setSelected(entry)
        },
        (reason: unknown) => {
          if (sequence === readSequence.current)
            setError(reason instanceof Error ? reason.message : '读取日记失败')
        },
      )
    }

    function refresh() {
      ++readSequence.current
      setLoading(true)
      setSelected(null)
      setRefreshKey((value) => value + 1)
    }

    return (
      <DiaryContext.Provider
        value={{ entries, failures, selected, loading, error, select, refresh }}
      >
        {children}
      </DiaryContext.Provider>
    )
  }

  return { Provider, List: DiaryList, Detail: DiaryDetail }
}

export function DiaryList() {
  const { entries, failures, selected, loading, error, select, refresh } = useDiaryPanels()
  return (
    <>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">JOURNAL</p>
          <h2>日记</h2>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={refresh}
          disabled={loading}
          aria-label="刷新日记列表"
        >
          <RefreshCw aria-hidden="true" />
        </Button>
      </div>
      {loading && <p className="panel-message">正在读取日记…</p>}
      {error && (
        <p role="alert" className="panel-message workspace-error">
          {error}
        </p>
      )}
      {!loading && entries.length === 0 && (
        <div className="panel-placeholder">
          <CalendarDays aria-hidden="true" />
          <p>还没有可显示的日期</p>
          <span>这里会列出所选文件夹中的日记。新建功能将在编辑阶段开放。</span>
        </div>
      )}
      {entries.length > 0 && (
        <ul className="diary-date-list">
          {entries.map((entry) => (
            <li key={entry.date.toString()}>
              <Button
                variant="ghost"
                className="diary-date-button"
                aria-current={
                  selected?.date.toString() === entry.date.toString() ? 'true' : undefined
                }
                onClick={() => select(entry.date)}
              >
                {entry.date.toString()}
              </Button>
            </li>
          ))}
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
  const { selected } = useDiaryPanels()
  if (selected)
    return (
      <article className="diary-preview">
        <p className="eyebrow">{selected.date.toString()} · 只读预览</p>
        <pre>{selected.markdown}</pre>
      </article>
    )
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <BookOpenText aria-hidden="true" />
      </div>
      <p className="eyebrow">YOUR SPACE TO WRITE</p>
      <h2>选择一天，查看日记</h2>
      <p>当前是只读文件预览；原位编辑将在下一阶段开放。</p>
    </div>
  )
}
