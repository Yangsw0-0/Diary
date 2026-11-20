export const wheelStep = 16
export const wheelPosition = (start: number, dy: number, radius: number, count: number) =>
  Math.max(-0.35, Math.min(count - 1 + 0.35, start - dy / ((radius * wheelStep * Math.PI) / 180)))
export const snapWheel = (value: number, count: number) =>
  Math.max(0, Math.min(Math.max(0, count - 1), Math.round(value)))
export const wheelWindow = (value: number, count: number) =>
  Array.from({ length: count }, (_, i) => i).filter((i) => Math.abs(i - value) <= 4)
