export const gapPx = (days: number) => 64 + 24 * Math.log1p(Math.max(0, days))

/**
 * Places nodes along the axis. The first node sits at half a viewport so it can
 * reach the middle of the timeline, and the last node keeps half a viewport of
 * empty space after it for the same reason.
 */
export function timelinePositions(dates: readonly string[], width: number): number[] {
  if (dates.length === 0) return []
  const pad = Math.max(120, width / 2)
  const positions = [pad]
  for (let i = 1; i < dates.length; i++)
    positions.push(
      positions[i - 1]! + gapPx((Date.parse(dates[i]!) - Date.parse(dates[i - 1]!)) / 86400000),
    )
  return positions
}

export function timelineWidth(positions: readonly number[], width: number): number {
  return Math.max(width, (positions.at(-1) ?? 0) + Math.max(120, width / 2))
}

/** Index of the node closest to the horizontal centre of the viewport. */
export function nearestNodeIndex(
  scrollLeft: number,
  positions: readonly number[],
  width: number,
): number {
  if (positions.length === 0) return -1
  const centre = scrollLeft + width / 2
  let best = 0
  let distance = Number.POSITIVE_INFINITY
  positions.forEach((x, index) => {
    const next = Math.abs(x - centre)
    if (next < distance) {
      best = index
      distance = next
    }
  })
  return best
}

export type TimelineLabelSide = -1 | 1
export interface TimelineLabel {
  side: TimelineLabelSide
  lane: number
  width: number
  offset: number
}
export interface TimelineLabelPair {
  date: TimelineLabel
  event: TimelineLabel
}

/**
 * Alternates a node's date and event labels above and below the axis, stacking
 * same-side labels into two lanes so two-line titles stay clear of the axis.
 */
export function labelLayout(
  positions: readonly number[],
  dateWidth = 76,
  eventWidth = 216,
): TimelineLabelPair[] {
  const ends: Record<TimelineLabelSide, number[]> = {
    [-1]: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
    [1]: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  }
  const place = (
    side: TimelineLabelSide,
    width: number,
    x: number,
    base: number,
    step: number,
  ): TimelineLabel => {
    const lanes = ends[side]
    let lane = lanes.findIndex((end) => end < x - width / 2 - 8)
    if (lane < 0) lane = lanes.indexOf(Math.min(...lanes))
    lanes[lane] = x + width / 2
    return { side, lane, width, offset: base + lane * step }
  }
  return positions.map((x, index) => {
    const dateSide: TimelineLabelSide = index % 2 === 0 ? -1 : 1
    return {
      date: place(dateSide, dateWidth, x, 14, 16),
      event: place(dateSide === -1 ? 1 : -1, eventWidth, x, 40, 38),
    }
  })
}
