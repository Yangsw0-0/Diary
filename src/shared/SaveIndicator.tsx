export function SaveIndicator({
  state,
  label,
  title,
  onSave,
  describedBy,
}: {
  state: 'saved' | 'saving' | 'dirty' | 'unsaved' | 'error'
  label: string
  title: string
  onSave: () => void
  describedBy?: string
}) {
  return (
    <button
      type="button"
      className="diary-save-indicator"
      data-state={state}
      title={title}
      onClick={onSave}
      aria-label={label}
      aria-describedby={describedBy}
    >
      <span className="diary-save-dot" aria-hidden="true" />
    </button>
  )
}
