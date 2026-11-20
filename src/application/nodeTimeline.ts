export const gapPx = (days: number) => 64 + 24 * Math.log1p(Math.max(0, days))
export function timelinePositions(dates: readonly string[], width: number): number[] {
  const positions = [64]
  for (let i = 1; i < dates.length; i++)
    positions.push(
      positions[i - 1]! + gapPx((Date.parse(dates[i]!) - Date.parse(dates[i - 1]!)) / 86400000),
    )
  if (dates.length === 0) return []
  if (dates.length === 1) return [width / 2]
  const total = positions.at(-1)! - 64
  if (total > 0 && total < width - 128)
    return positions.map((x) => 64 + ((x - 64) * (width - 128)) / total)
  return positions
}
export function labelLanes(positions: readonly number[], width = 148) {
  const ends = Array.from({ length: 6 }, () => -Infinity)
  return positions.map((x, index) => {
    const preferred = index % 2
    let slot = [
      preferred,
      1 - preferred,
      preferred + 2,
      3 - preferred,
      preferred + 4,
      5 - preferred,
    ].find((s) => ends[s]! < x - width / 2 - 8)
    if (slot === undefined) slot = ends.indexOf(Math.min(...ends))
    const available = Math.max(12, Math.min(width, 2 * (x - ends[slot]! - 8)))
    ends[slot] = x + available / 2
    return { side: slot % 2 === 0 ? -1 : 1, lane: Math.floor(slot / 2), width: available }
  })
}
