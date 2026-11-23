/** CSS pixel deltas, bounded per event; ctrl+wheel remains the platform zoom gesture. */
export function wheelDelta(
  event: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode'>,
  height: number,
) {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1
  return {
    x: Math.max(-64, Math.min(64, event.deltaX * unit)),
    y: Math.max(-64, Math.min(64, event.deltaY * unit)),
  }
}
