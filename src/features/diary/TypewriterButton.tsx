export function TypewriterButton({
  enabled,
  onToggle,
}: {
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className="diary-save-indicator diary-typewriter-toggle"
      aria-label="打字机模式"
      aria-pressed={enabled}
      title="打字机模式"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onToggle}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 10V3h12v7M9 6h6M9 9h6M5 10h14l2 8v3H3v-3zM7 18h10M2 10h2M20 10h2" />
        <path d="M7 14h.01M10.3 14h.01M13.7 14h.01M17 14h.01" />
      </svg>
    </button>
  )
}
