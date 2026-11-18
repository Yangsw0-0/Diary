import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
// @ts-ignore Vite resolves the Markdown raw import when bundling the application.
import guideMarkdown from '../../../docs/Diary-User-Guide.md?raw'
import { HelpManual } from './HelpManual'

const manual = new HelpManual(guideMarkdown)

interface HelpDialogProps {
  readonly onClose: () => void
}

export function HelpDialog({ onClose }: HelpDialogProps) {
  const [selectedId, setSelectedId] = useState(manual.sections[0]!.id)
  const dialogRef = useRef<HTMLDivElement>(null)
  const section = manual.getSection(selectedId)

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.querySelector('button')?.focus()
    return () => previousFocus?.focus()
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []),
    ]
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="help-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-dialog-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="help-dialog-header">
          <div>
            <p className="eyebrow">USER GUIDE</p>
            <h2 id="help-dialog-title">{manual.title}</h2>
          </div>
          <button type="button" className="help-close" aria-label="关闭使用说明" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="help-dialog-body">
          <nav className="help-chapters" aria-label="使用说明章节">
            {manual.sections.map((chapter) => (
              <button
                key={chapter.id}
                type="button"
                aria-current={selectedId === chapter.id ? 'page' : undefined}
                onClick={() => setSelectedId(chapter.id)}
              >
                {chapter.title}
              </button>
            ))}
          </nav>
          <article className="help-article" key={section.id}>
            <p className="help-intro">{manual.intro}</p>
            <h3>{section.title}</h3>
            <Markdown remarkPlugins={[remarkGfm]}>{section.markdown}</Markdown>
          </article>
        </div>
      </div>
    </div>
  )
}
