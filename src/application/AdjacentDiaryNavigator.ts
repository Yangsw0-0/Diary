export type AdjacentDirection = 'older' | 'newer'

export interface AdjacentGesture {
  readonly direction: AdjacentDirection
  readonly phase: 'feedback' | 'pull' | 'armed' | 'complete'
  readonly progress: number
  /** Signed track translation in CSS pixels, clamped to one viewport. */
  readonly offset: number
}

/** Converts a burst of boundary wheel events into one bounded page turn. */
export class AdjacentDiaryNavigator {
  static readonly idleGapMs = 110
  private direction: AdjacentDirection | null = null
  private amount = 0
  private lastWheelAt = 0
  private phase: AdjacentGesture['phase'] | 'idle' | 'locked' = 'idle'

  get isLocked(): boolean {
    return this.phase === 'locked'
  }

  reset(): void {
    this.direction = null
    this.amount = 0
    this.phase = 'idle'
  }

  lock(): void {
    this.phase = 'locked'
  }

  unlock(): void {
    this.reset()
  }

  add(
    deltaY: number,
    deltaMode: number,
    atTop: boolean,
    atBottom: boolean,
    viewportHeight: number,
    now: number,
  ): AdjacentGesture | null {
    if (this.isLocked || !Number.isFinite(deltaY)) return null
    const direction = deltaY > 0 && atBottom ? 'older' : deltaY < 0 && atTop ? 'newer' : null
    if (!direction) {
      this.reset()
      return null
    }
    if (direction !== this.direction || now - this.lastWheelAt > AdjacentDiaryNavigator.idleGapMs)
      this.amount = 0
    this.direction = direction
    this.lastWheelAt = now
    const height = Math.max(1, viewportHeight)
    const feedback = Math.min(80, Math.max(72, height * 0.08))
    const armDistance = Math.min(220, Math.max(160, height * 0.28))
    const fullDistance = armDistance + 40
    const pixels = Math.abs(deltaY) * (deltaMode === 1 ? 16 : deltaMode === 2 ? height : 1)
    this.amount = Math.min(fullDistance, this.amount + Math.min(64, pixels))
    const progress = Math.max(0, Math.min(1, (this.amount - feedback) / (fullDistance - feedback)))
    const phase =
      this.amount <= feedback
        ? 'feedback'
        : this.amount >= fullDistance
          ? 'complete'
          : this.amount >= armDistance
            ? 'armed'
            : 'pull'
    this.phase = phase
    const distance =
      phase === 'feedback'
        ? this.amount
        : feedback + (height - feedback) * progress * (0.25 + 0.75 * progress)
    return {
      direction,
      phase,
      progress,
      offset: (direction === 'older' ? -1 : 1) * Math.min(height, distance),
    }
  }

  /** Called only when the wheel stream has been idle for one gesture gap. */
  release(): 'commit' | 'rebound' | null {
    if (this.phase === 'armed' || this.phase === 'complete') {
      this.lock()
      return 'commit'
    }
    if (this.phase === 'feedback' || this.phase === 'pull') {
      this.reset()
      return 'rebound'
    }
    return null
  }
}
