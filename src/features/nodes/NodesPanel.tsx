import { SaveIndicator } from '@/shared/SaveIndicator'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { flattenNodes } from '@/domain/NodesDocument'
import type { NodesSession } from '@/application/NodesSession'
import { NodePalette } from '@/application/NodePalette'
import { NodeEditorDialog } from './NodeEditorDialog'
import { NodeTimeline } from './NodeTimeline'
import { NodeWheel } from './NodeWheel'
export function NodesPanel({ session, palette }: { session: NodesSession; palette: NodePalette }) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot),
    colors = useSyncExternalStore(palette.subscribe, palette.getSnapshot)
  const [editor, setEditor] = useState<string | null>(null),
    [actionError, setActionError] = useState('')
  useEffect(() => {
    void session.ensureLoaded()
  }, [session])
  const rows = flattenNodes(snapshot.document),
    event = rows.find((e) => e.id === editor)
  const run = (action: () => Promise<unknown>) => {
    void action().catch((err) => setActionError(err instanceof Error ? err.message : '操作失败'))
  }
  const status = snapshot.error
    ? 'error'
    : snapshot.saving
      ? 'saving'
      : snapshot.dirty
        ? 'dirty'
        : 'saved'
  return (
    <div className="nodes-panel">
      <header className="nodes-header">
        <h1>节点</h1>
        <SaveIndicator
          state={status}
          label="保存节点"
          title={`${status === 'saved' ? '已保存' : status === 'dirty' ? '尚未保存' : status === 'saving' ? '正在保存' : '保存失败'} ${snapshot.savedAt ?? ''}，点击手动保存`}
          onSave={() => run(() => session.flush())}
        />
      </header>
      {(snapshot.error || actionError) && (
        <div role="alert" className="nodes-error">
          {snapshot.error || actionError}
          <button
            onClick={() => {
              if (!snapshot.dirty || window.confirm('重新载入会放弃节点草稿，继续？'))
                run(() => session.reload())
            }}
          >
            重新载入
          </button>
          {snapshot.dirty && !snapshot.blocked && (
            <button
              onClick={() => {
                if (window.confirm('覆盖外部的节点文件？')) run(() => session.flush(true))
              }}
            >
              覆盖保存
            </button>
          )}
          {snapshot.blocked && !snapshot.dirty && (
            <button
              onClick={() => {
                if (window.confirm('备份原文件并新建空节点文件？'))
                  run(() => session.backupAndReset())
              }}
            >
              备份损坏文件并新建
            </button>
          )}
        </div>
      )}
      {snapshot.loading ? (
        <p role="status">正在读取节点…</p>
      ) : rows.length ? (
        <>
          <NodeTimeline
            document={snapshot.document}
            focusedId={snapshot.focusedId}
            onFocus={(id) => session.focus(id)}
            colors={colors}
          />
          <NodeWheel
            events={rows}
            focusedId={snapshot.focusedId}
            onFocus={(id) => session.focus(id)}
            onEdit={setEditor}
            onColor={(id, color) => session.setColor(id, color)}
            colors={colors}
          />
        </>
      ) : (
        <div className="nodes-empty">
          <h2>还没有节点</h2>
          <p>记录第一个值得纪念的时刻</p>
        </div>
      )}
      <button
        className="nodes-add"
        disabled={!snapshot.loaded || snapshot.blocked}
        onClick={() => setEditor('new')}
      >
        ＋ 添加事件
      </button>
      {editor && (
        <NodeEditorDialog
          session={session}
          colors={colors}
          {...(event ? { event } : {})}
          onClose={() => setEditor(null)}
        />
      )}
      <span className="sr-only" role="status">
        {status === 'saved'
          ? '节点已保存'
          : status === 'dirty'
            ? '节点尚未保存'
            : status === 'saving'
              ? '节点正在保存'
              : '节点保存失败'}
      </span>
    </div>
  )
}
