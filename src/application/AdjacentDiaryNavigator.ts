/** Accumulates only extra wheel movement at a scroll boundary. */
export class AdjacentDiaryNavigator {
  static readonly threshold = 160
  private direction: 'older' | 'newer' | null = null
  private amount = 0
  private lastTime = 0

  reset(): void {
    this.direction = null
    this.amount = 0
  }

  add(
    deltaY: number,
    deltaMode: number,
    atTop: boolean,
    atBottom: boolean,
    now: number,
  ): { direction: 'older' | 'newer'; progress: number; ready: boolean } | null {
    const direction = deltaY > 0 && atBottom ? 'older' : deltaY < 0 && atTop ? 'newer' : null
    if (!direction || !Number.isFinite(deltaY)) {
      this.reset()
      return null
    }
    if (direction !== this.direction || now - this.lastTime > 650) this.amount = 0
    this.direction = direction
    this.lastTime = now
    const pixels = Math.abs(deltaY) * (deltaMode === 1 ? 16 : deltaMode === 2 ? 600 : 1)
    this.amount = Math.min(AdjacentDiaryNavigator.threshold, this.amount + pixels)
    return {
      direction,
      progress: this.amount / AdjacentDiaryNavigator.threshold,
      ready: this.amount >= AdjacentDiaryNavigator.threshold,
    }
  }
}
