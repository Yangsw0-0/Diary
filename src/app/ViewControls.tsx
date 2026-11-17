import { Maximize2, Minimize2, Minus, Plus } from 'lucide-react'

interface ViewControlsProps {
  readonly zoom: number
  readonly expanded: boolean
  readonly onZoomChange: (value: number) => void
  readonly onToggleExpanded: () => void
}

export function ViewControls({
  zoom,
  expanded,
  onZoomChange,
  onToggleExpanded,
}: ViewControlsProps) {
  return (
    <div className="view-control-zone">
      <div className="editor-view-controls" aria-label="正文视图控制">
        <button type="button" onClick={() => onZoomChange(zoom - 10)} aria-label="缩小正文">
          <Minus aria-hidden="true" />
        </button>
        <output>{zoom}%</output>
        <input
          type="range"
          min="50"
          max="150"
          step="5"
          value={zoom}
          aria-label="正文缩放"
          onChange={(event) => onZoomChange(Number(event.target.value))}
        />
        <button type="button" onClick={() => onZoomChange(zoom + 10)} aria-label="放大正文">
          <Plus aria-hidden="true" />
        </button>
        <button
          type="button"
          className="view-expand"
          onClick={onToggleExpanded}
          aria-label={expanded ? '退出展开正文' : '展开正文'}
        >
          {expanded ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}
