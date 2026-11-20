export type EditorReadyResult = 'ready' | 'cancelled' | 'timeout'

/** One navigation owns its editor readiness waiters and timeout cleanup. */
export class EditorReadiness {
  private date: string | null = null
  private ready = false
  private generation = 0
  private waiters = new Set<(result: EditorReadyResult) => void>()

  begin(date: string | null): void {
    this.finish('cancelled')
    this.date = date
    this.ready = false
    this.generation++
  }

  get token(): number {
    return this.generation
  }

  markReady(date: string, token: number): void {
    if (date !== this.date || token !== this.generation) return
    this.ready = true
    this.finish('ready')
  }

  wait(date: string): Promise<EditorReadyResult> {
    if (date !== this.date) return Promise.resolve('cancelled')
    if (this.ready) return Promise.resolve('ready')
    return new Promise((resolve) => {
      const done = (result: EditorReadyResult) => {
        clearTimeout(timer)
        this.waiters.delete(done)
        resolve(result)
      }
      const timer = setTimeout(() => done('timeout'), 2500)
      this.waiters.add(done)
    })
  }

  private finish(result: EditorReadyResult): void {
    for (const done of this.waiters) done(result)
    this.waiters.clear()
  }
}
