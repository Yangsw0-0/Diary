export const wheelStep = 16
export const wheelPosition = (start: number, dy: number, radius: number, count: number) =>
  Math.max(-0.35, Math.min(count - 1 + 0.35, start - dy / ((radius * wheelStep * Math.PI) / 180)))
export const snapWheel = (value: number, count: number) =>
  Math.max(0, Math.min(Math.max(0, count - 1), Math.round(value)))

/** Only the rows close to the current position are mounted. */
export function wheelWindow(value: number, count: number): number[] {
  if (count <= 0) return []
  const start = Math.max(0, Math.floor(value) - 4)
  const end = Math.min(count - 1, Math.ceil(value) + 4)
  const window: number[] = []
  for (let i = start; i <= end; i++) window.push(i)
  return window
}
