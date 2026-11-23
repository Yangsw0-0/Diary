import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { PanelRightClose, PanelRightOpen, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SaveIndicator } from '@/shared/SaveIndicator'
import { useNavigation } from '@/shared/NavigationContext'
import {
  mergeCloudWords,
  type CloudLineMode,
  type CloudWord,
  type CustomCloudWord,
} from '@/domain/WordCloud'
import type { WordCloudSession } from '@/application/WordCloudSession'
import type { TagIndex } from '@/application/TagIndex'
import type { DiarySession } from '@/application/DiarySession'
import { WordSphere } from './WordSphere'
import './word-cloud.css'
export function WordCloudPanel({
  session,
  index,
  diary,
  active = true,
}: {
  session: WordCloudSession
  index: TagIndex
  diary: DiarySession
  active?: boolean
}) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot),
    tagGroups = useSyncExternalStore(index.subscribe, () => index.listGroups()),
    diarySnapshot = useSyncExternalStore(diary.subscribe, diary.getSnapshot)
  const navigation = useNavigation(),
    [text, setText] = useState(''),
    [notice, setNotice] = useState<string | null>(null),
    [deleted, setDeleted] = useState<CustomCloudWord | null>(null),
    [highlight, setHighlight] = useState<string | null>(null)
  useEffect(() => {
    if (active) void session.ensureLoaded()
  }, [active, session])
  const groups = useMemo(() => {
    return [...tagGroups.frequent, ...tagGroups.singleDay]
  }, [tagGroups])
  const words = useMemo(
    () => mergeCloudWords(snapshot.document.words, groups, snapshot.document.preferences.showTags),
    [snapshot.document.words, snapshot.document.preferences.showTags, groups],
  )
  const ready = snapshot.loaded && !snapshot.loading && !snapshot.blocked
  const run = (operation: () => void) => {
    try {
      operation()
      setNotice(null)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '词云操作失败')
    }
  }
  const activate = (word: CloudWord) => {
    setHighlight(word.id)
    if (word.tagKey)
      void navigation
        .openTag(word.tagKey)
        .then((opened) => {
          if (!opened) setNotice('暂时无法打开标签，请先处理保存错误')
        })
        .catch(() => setNotice('打开标签失败'))
  }
  const preferences = snapshot.document.preferences
  const state = snapshot.error
    ? 'error'
    : snapshot.saving
      ? 'saving'
      : snapshot.dirty
        ? 'dirty'
        : 'saved'
  const tagIssue =
    preferences.showTags &&
    (diarySnapshot.error || diarySnapshot.failures.length || index.isStale())
  if (!active && !snapshot.loaded) return null
  return (
    <section
      className="word-cloud"
      aria-label="词云画布"
      data-panel-collapsed={preferences.panelCollapsed}
    >
      <header className="cloud-header">
        <div>
          <p className="eyebrow">WORD CLOUD</p>
          <h1>
            词云 <small>{words.length} 个词语</small>
          </h1>
        </div>
        <div className="cloud-header-actions">
          <SaveIndicator
            state={state}
            label="保存词云"
            title={state === 'saved' ? '词云已保存，点击手动保存' : '点击重试保存词云'}
            onSave={() => void session.flush()}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={preferences.panelCollapsed ? '展开词云管理' : '收起词云管理'}
            aria-expanded={!preferences.panelCollapsed}
            disabled={!ready}
            onClick={() =>
              run(() => session.configure({ panelCollapsed: !preferences.panelCollapsed }))
            }
          >
            {preferences.panelCollapsed ? <PanelRightOpen /> : <PanelRightClose />}
          </Button>
        </div>
      </header>
      {snapshot.error && (
        <div className="cloud-error" role="alert">
          <span>{snapshot.error}。自定义草稿仍保留，未覆盖原文件。</span>
          <Button
            variant="outline"
            size="sm"
            disabled={snapshot.saving}
            onClick={() => {
              if (snapshot.dirty && !window.confirm('重新读取将放弃词云未保存修改，继续？')) return
              void session.reload()
            }}
          >
            重新读取
          </Button>
          {snapshot.dirty && !snapshot.blocked && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (window.confirm('用词云草稿覆盖磁盘上的词云文件？')) void session.flush(true)
              }}
            >
              覆盖保存
            </Button>
          )}
        </div>
      )}
      <div className="cloud-layout">
        {snapshot.loaded ? (
          <WordSphere
            words={words}
            preferences={preferences}
            active={active && snapshot.loaded}
            onActivate={activate}
          />
        ) : (
          <div className="cloud-stage">
            <p className="cloud-stage-caption">正在准备词云…</p>
          </div>
        )}
        {!preferences.panelCollapsed && (
          <aside className="cloud-management" aria-label="词云管理">
            <h2>词语与显示</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                run(() => {
                  session.add(text)
                  setText('')
                })
              }}
            >
              <label htmlFor="cloud-new-word">自定义词语</label>
              <div className="cloud-add-row">
                <input
                  id="cloud-new-word"
                  value={text}
                  disabled={!ready}
                  placeholder="写下一个关键词…"
                  onChange={(event) => setText(event.target.value)}
                />
                <Button size="icon" type="submit" aria-label="添加词语" disabled={!ready}>
                  <Plus />
                </Button>
              </div>
              <p className="cloud-hint">Enter 添加 · 最多120字 · 自定义词上限500个</p>
            </form>
            {notice && (
              <p className="cloud-inline-error" role="alert">
                {notice}
              </p>
            )}
            <fieldset disabled={!ready} className="cloud-options">
              <legend>显示选项</legend>
              <label>
                <input
                  type="checkbox"
                  checked={preferences.showTags}
                  onChange={(event) =>
                    run(() => session.configure({ showTags: event.target.checked }))
                  }
                />
                显示已有标签
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={preferences.autoRotate}
                  onChange={(event) =>
                    run(() => session.configure({ autoRotate: event.target.checked }))
                  }
                />
                缓慢自动旋转
              </label>
              <label>
                球面线条
                <select
                  aria-label="球面线条"
                  value={preferences.lineMode}
                  onChange={(event) =>
                    run(() => session.configure({ lineMode: event.target.value as CloudLineMode }))
                  }
                >
                  <option value="mixed">混合模式</option>
                  <option value="grid">经纬网格</option>
                  <option value="constellation">星座连线</option>
                  <option value="none">关闭线条</option>
                </select>
              </label>
            </fieldset>
            {snapshot.loading && <p role="status">正在读取词云…</p>}
            {preferences.showTags && diarySnapshot.loading && (
              <p role="status">正在读取已有标签…</p>
            )}
            {!!tagIssue && (
              <p className="cloud-inline-error" role="status">
                {index.isStale()
                  ? '标签索引暂不可用，请到日记刷新重试。'
                  : '部分日记读取失败，标签可能不完整。'}
                自定义词不受影响。
              </p>
            )}
            <div className="cloud-word-list" aria-label="当前词语列表">
              <h3>
                当前词语 <small>{words.length}</small>
              </h3>
              {!words.length && <p className="cloud-hint">添加第一个词语，或开启已有标签。</p>}
              <ul>
                {words.map((word) => (
                  <li key={word.id} data-highlighted={highlight === word.id}>
                    <button
                      type="button"
                      title={word.text}
                      className="cloud-word-name"
                      onClick={() => activate(word)}
                    >
                      <span>{word.text}</span>
                      <small>
                        {word.customIds.length
                          ? word.tagKey
                            ? '自定义 · 标签'
                            : '自定义'
                          : '标签'}
                      </small>
                    </button>
                    {word.customIds.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!ready}
                        aria-label={`删除自定义词 ${word.text}`}
                        onClick={() =>
                          run(() => {
                            const removed = session.remove(word.customIds[0]!)
                            if (removed) setDeleted(removed)
                          })
                        }
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>
      {deleted && (
        <div className="cloud-undo" role="status">
          <span>已删除「{deleted.text}」的自定义来源</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!ready}
            onClick={() =>
              run(() => {
                session.restore(deleted)
                setDeleted(null)
              })
            }
          >
            <RotateCcw />
            撤销
          </Button>
          <button type="button" aria-label="关闭撤销提示" onClick={() => setDeleted(null)}>
            ×
          </button>
        </div>
      )}
      <span className="sr-only" role="status">
        {state === 'saved'
          ? '词云已保存'
          : state === 'dirty'
            ? '词云尚未保存'
            : state === 'saving'
              ? '正在保存词云'
              : '词云保存失败'}
      </span>
    </section>
  )
}
