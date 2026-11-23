import type { CloudPreferences, CloudWord } from '@/domain/WordCloud'
import {
  constellationEdges,
  dragRotation,
  fibonacciSphere,
  gridPaths,
  identity,
  multiply,
  project,
  rotate,
  smoothstep,
  sphereLerp,
  type Quaternion,
  type Vec3,
} from './sphereMath'
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
interface Particle {
  word: CloudWord
  from: Vec3
  to: Vec3
  start: number
  entering: boolean
  leaving: boolean
  opacity: number
}
interface Hit {
  word: CloudWord
  x: number
  y: number
  width: number
  height: number
  alpha: number
}
/** Owns geometry, pointer capture, projection, animation and resource cleanup outside React. */
export class SphereRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private readonly onActivate: (word: CloudWord) => void
  private readonly onHover: (word: CloudWord | null) => void
  private particles: Particle[] = []
  private edges: readonly (readonly [number, number])[] = []
  private readonly grid = gridPaths()
  private orientation: Quaternion = identity
  private preferences: CloudPreferences = {
    showTags: true,
    autoRotate: true,
    lineMode: 'mixed',
    panelCollapsed: false,
  }
  private width = 0
  private height = 0
  private dpr = 1
  private foreground = '#26332c'
  private lineColor = '#8fae94'
  private hits: Hit[] = []
  private frame = 0
  private last = 0
  private active = false
  private disposed = false
  private velocity = { x: 0, y: 0 }
  private pointer: {
    id: number
    x: number
    y: number
    startX: number
    startY: number
    time: number
    moved: boolean
  } | null = null
  private mouse: { x: number; y: number } | null = null
  private hovered: string | null = null
  private selected: string | null = null
  private selectedUntil = 0
  private readonly observer: ResizeObserver
  private readonly themeObserver: MutationObserver
  private readonly reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  private labels = new Map<string, { text: string; width: number }>()
  constructor(
    canvas: HTMLCanvasElement,
    onActivate: (word: CloudWord) => void,
    onHover: (word: CloudWord | null) => void,
  ) {
    this.canvas = canvas
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前环境不支持Canvas词云')
    this.context = context
    this.onActivate = onActivate
    this.onHover = onHover
    this.observer = new ResizeObserver(this.resize)
    this.observer.observe(canvas)
    this.themeObserver = new MutationObserver(this.readTheme)
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    })
    canvas.addEventListener('pointerdown', this.down)
    canvas.addEventListener('pointermove', this.move)
    canvas.addEventListener('pointerup', this.up)
    canvas.addEventListener('pointercancel', this.cancel)
    canvas.addEventListener('lostpointercapture', this.lost)
    canvas.addEventListener('pointerleave', this.leave)
    canvas.addEventListener('keydown', this.key)
    document.addEventListener('visibilitychange', this.visibility)
    window.addEventListener('blur', this.cancel)
    window.addEventListener('resize', this.resize)
    this.reduced.addEventListener('change', this.motionChange)
    this.readTheme()
    this.resize()
    void document.fonts?.ready.then(() => {
      if (!this.disposed) {
        this.labels.clear()
        this.invalidate()
      }
    })
  }
  setActive(active: boolean) {
    this.active = active
    if (!active) {
      this.cancel()
      this.stop()
    } else this.invalidate()
  }
  setPreferences(preferences: CloudPreferences) {
    this.preferences = preferences
    if (!preferences.autoRotate) this.velocity = { x: 0, y: 0 }
    this.invalidate()
  }
  setWords(words: readonly CloudWord[]) {
    const live = this.particles.filter((p) => !p.leaving)
    if (live.length === words.length && live.every((p, i) => p.word.id === words[i]!.id)) {
      live.forEach((p, i) => {
        p.word = words[i]!
      })
      this.invalidate()
      return
    }
    const now = performance.now(),
      positions = fibonacciSphere(words.length),
      existing = new Map(this.particles.map((p) => [p.word.id, p]))
    const next = words.map((word, index): Particle => {
      const old = existing.get(word.id)
      existing.delete(word.id)
      return {
        word,
        from: old ? this.position(old, now) : positions[index]!,
        to: positions[index]!,
        start: now,
        entering: !old,
        leaving: false,
        opacity: old ? this.opacity(old, now) : 0,
      }
    })
    for (const old of existing.values())
      if (!old.leaving)
        next.push({
          ...old,
          from: this.position(old, now),
          to: this.position(old, now),
          start: now,
          entering: false,
          leaving: true,
          opacity: this.opacity(old, now),
        })
    this.particles = next
    this.edges = constellationEdges(positions)
    this.labels.clear()
    this.hits = []
    this.setHover(null)
    this.invalidate()
  }
  private position(p: Particle, now: number): Vec3 {
    return sphereLerp(p.from, p.to, this.reduced.matches ? 1 : smoothstep(0, 500, now - p.start))
  }
  private opacity(p: Particle, now: number) {
    const t = this.reduced.matches ? 1 : smoothstep(0, 450, now - p.start)
    return p.leaving ? p.opacity * (1 - t) : p.opacity + (1 - p.opacity) * t
  }
  private readTheme = () => {
    const style = getComputedStyle(this.canvas)
    this.foreground = style.color
    this.lineColor = this.foreground
    this.invalidate()
  }
  private resize = () => {
    const box = this.canvas.getBoundingClientRect()
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    if (this.width === box.width && this.height === box.height && this.dpr === dpr) return
    this.width = box.width
    this.height = box.height
    this.dpr = dpr
    this.canvas.width = Math.max(1, Math.round(this.width * this.dpr))
    this.canvas.height = Math.max(1, Math.round(this.height * this.dpr))
    this.labels.clear()
    this.stop()
    // ResizeObserver runs after RAF: paint now so its buffer reset cannot blank this frame.
    if (this.active && !document.hidden && this.width > 0 && this.height > 0)
      this.draw(performance.now())
  }
  private visibility = () => {
    if (document.hidden) {
      this.cancel()
      this.stop()
    } else this.invalidate()
  }
  private motionChange = () => {
    this.velocity = { x: 0, y: 0 }
    this.invalidate()
  }
  private stop() {
    if (this.frame) cancelAnimationFrame(this.frame)
    this.frame = 0
    this.last = 0
  }
  private invalidate = () => {
    if (
      !this.disposed &&
      this.active &&
      !document.hidden &&
      this.width > 0 &&
      this.height > 0 &&
      !this.frame
    )
      this.frame = requestAnimationFrame(this.draw)
  }
  private setHover(word: CloudWord | null) {
    if ((word?.id ?? null) === this.hovered) return
    this.hovered = word?.id ?? null
    this.canvas.style.cursor = word ? 'pointer' : this.pointer ? 'grabbing' : 'grab'
    this.onHover(word)
  }
  private hit(x: number, y: number) {
    return (
      this.hits.find(
        (h) =>
          h.alpha > 0.12 &&
          Math.abs(x - h.x) <= h.width / 2 + 3 &&
          Math.abs(y - h.y) <= h.height / 2 + 3,
      )?.word ?? null
    )
  }
  private down = (event: PointerEvent) => {
    if (event.button !== 0 || this.pointer) return
    const rect = this.canvas.getBoundingClientRect()
    const x = event.clientX - rect.left,
      y = event.clientY - rect.top
    this.pointer = {
      id: event.pointerId,
      x,
      y,
      startX: x,
      startY: y,
      time: performance.now(),
      moved: false,
    }
    this.mouse = { x, y }
    this.velocity = { x: 0, y: 0 }
    this.canvas.setPointerCapture(event.pointerId)
    this.canvas.focus({ preventScroll: true })
    this.canvas.style.cursor = 'grabbing'
    event.preventDefault()
  }
  private move = (event: PointerEvent) => {
    const box = this.canvas.getBoundingClientRect(),
      x = event.clientX - box.left,
      y = event.clientY - box.top
    this.mouse = { x, y }
    const pointer = this.pointer
    if (pointer && event.pointerId === pointer.id) {
      const now = performance.now(),
        dx = x - pointer.x,
        dy = y - pointer.y,
        sensitivity = 2.7 / Math.max(160, Math.min(this.width, this.height)),
        dt = Math.max(8, now - pointer.time)
      this.orientation = multiply(
        dragRotation(dx * sensitivity, dy * sensitivity),
        this.orientation,
      )
      this.velocity = {
        x: Math.max(-0.004, Math.min(0.004, (dx * sensitivity) / dt)),
        y: Math.max(-0.004, Math.min(0.004, (dy * sensitivity) / dt)),
      }
      this.pointer = {
        ...pointer,
        x,
        y,
        time: now,
        moved: pointer.moved || Math.hypot(x - pointer.startX, y - pointer.startY) > 4,
      }
      this.setHover(null)
    } else this.setHover(this.hit(x, y))
    this.invalidate()
  }
  private up = (event: PointerEvent) => {
    const pointer = this.pointer
    if (!pointer || event.pointerId !== pointer.id) return
    this.pointer = null
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId)
    if (!pointer.moved) {
      this.velocity = { x: 0, y: 0 }
      const word = this.hit(pointer.x, pointer.y)
      if (word) this.activate(word)
    } else if (performance.now() - pointer.time > 80) this.velocity = { x: 0, y: 0 }
    this.canvas.style.cursor = 'grab'
    this.invalidate()
  }
  private cancel = () => {
    const pointer = this.pointer
    this.pointer = null
    this.velocity = { x: 0, y: 0 }
    if (pointer && this.canvas.hasPointerCapture(pointer.id))
      this.canvas.releasePointerCapture(pointer.id)
    this.setHover(null)
    this.canvas.style.cursor = 'grab'
    this.invalidate()
  }
  private lost = (event: PointerEvent) => {
    if (this.pointer?.id === event.pointerId) this.cancel()
  }
  private leave = () => {
    if (!this.pointer) {
      this.mouse = null
      this.setHover(null)
    }
  }
  private activate(word: CloudWord) {
    this.selected = word.id
    this.selectedUntil = performance.now() + 1400
    this.onActivate(word)
    this.invalidate()
  }
  private key = (event: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(event.key))
      return
    event.preventDefault()
    if (event.key === 'Enter' || event.key === ' ') {
      const word = this.hits.find((h) => h.alpha > 0.12)?.word
      if (word) this.activate(word)
    } else {
      this.orientation = multiply(
        dragRotation(
          event.key === 'ArrowLeft' ? -0.15 : event.key === 'ArrowRight' ? 0.15 : 0,
          event.key === 'ArrowUp' ? -0.15 : event.key === 'ArrowDown' ? 0.15 : 0,
        ),
        this.orientation,
      )
      this.invalidate()
    }
  }
  private line(a: Vec3, b: Vec3, alpha: number) {
    const p = project(rotate(a, this.orientation), this.width, this.height),
      q = project(rotate(b, this.orientation), this.width, this.height),
      opacity = Math.min(p.alpha, q.alpha) * alpha
    if (opacity < 0.003) return
    const ctx = this.context
    ctx.globalAlpha = opacity
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(q.x, q.y)
    ctx.stroke()
  }
  private draw = (now: number) => {
    this.frame = 0
    if (!this.active || document.hidden || this.disposed) return
    const dt = this.last ? Math.min(40, now - this.last) : 16
    this.last = now
    if (!this.pointer && !this.reduced.matches) {
      const auto = this.preferences.autoRotate && this.particles.length ? 0.00013 : 0
      this.orientation = multiply(
        dragRotation((this.velocity.x + auto) * dt, this.velocity.y * dt),
        this.orientation,
      )
      const decay = Math.exp(-dt / 170)
      this.velocity.x *= decay
      this.velocity.y *= decay
    }
    const ctx = this.context
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.strokeStyle = this.lineColor
    ctx.lineWidth = 0.65
    const positions = this.particles.map((p) => this.position(p, now)),
      mode = this.preferences.lineMode
    if (mode === 'grid' || mode === 'mixed')
      for (const path of this.grid)
        for (let i = 1; i < path.length; i++)
          this.line(path[i - 1]!, path[i]!, mode === 'mixed' ? 0.075 : 0.13)
    if (mode === 'constellation' || mode === 'mixed')
      for (let i = 0; i < this.edges.length; i++) {
        if (mode === 'mixed' && i % 3 !== 0) continue
        const [a, b] = this.edges[i]!
        if (positions[a] && positions[b])
          this.line(positions[a]!, positions[b]!, mode === 'mixed' ? 0.09 : 0.17)
      }
    const projected = this.particles
      .map((particle, index) => {
        const p = rotate(positions[index]!, this.orientation)
        return { particle, ...project(p, this.width, this.height), z: p[2] }
      })
      .sort((a, b) => b.z - a.z)
    const accepted: Hit[] = [],
      bins = new Map<string, Hit[]>(),
      fontSize = Math.max(
        10,
        Math.min(
          25,
          (28 - Math.log2(this.particles.length + 1) * 1.6) *
            Math.min(1.2, Math.min(this.width, this.height) / 560),
        ),
      )
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = this.foreground
    for (const item of projected) {
      const { particle } = item,
        opacity = this.opacity(particle, now),
        alpha = item.alpha * opacity
      if (alpha < 0.015) continue
      const size = Math.round(fontSize * (0.78 + 0.22 * item.scale) * 2) / 2,
        font = `500 ${size.toFixed(1)}px system-ui, sans-serif`
      ctx.font = font
      const maxWidth = Math.max(70, Math.min(190, this.width * 0.32)),
        cacheKey = particle.word.text + '|' + font + '|' + maxWidth
      let label = this.labels.get(cacheKey)
      if (!label) {
        let text = particle.word.text
        if (ctx.measureText(text).width > maxWidth) {
          const chars = Array.from(graphemes.segment(text), (entry) => entry.segment)
          let low = 0,
            high = chars.length
          while (low < high) {
            const mid = Math.ceil((low + high) / 2)
            if (ctx.measureText(chars.slice(0, mid).join('') + '…').width <= maxWidth) low = mid
            else high = mid - 1
          }
          text = chars.slice(0, low).join('') + '…'
        }
        label = { text, width: ctx.measureText(text).width }
        if (this.labels.size > 8192) this.labels.clear()
        this.labels.set(cacheKey, label)
      }
      const hit = {
          word: particle.word,
          x: item.x,
          y: item.y,
          width: label.width,
          height: size * 1.25,
          alpha,
        },
        gx = Math.floor(item.x / 128),
        gy = Math.floor(item.y / 64)
      let overlap = false
      for (let dx = -2; dx <= 2 && !overlap; dx++)
        for (let dy = -1; dy <= 1 && !overlap; dy++)
          for (const other of bins.get(`${gx + dx},${gy + dy}`) ?? [])
            if (
              Math.abs(other.x - hit.x) < (other.width + hit.width) / 2 + 5 &&
              Math.abs(other.y - hit.y) < (other.height + hit.height) / 2 + 3
            ) {
              overlap = true
              break
            }
      if (overlap) continue
      ctx.globalAlpha = alpha
      if (
        particle.word.id === this.hovered ||
        (particle.word.id === this.selected && now < this.selectedUntil)
      ) {
        ctx.save()
        ctx.globalAlpha = alpha * 0.12
        ctx.fillRect(hit.x - hit.width / 2 - 7, hit.y - size * 0.72, hit.width + 14, size * 1.5)
        ctx.restore()
      }
      ctx.fillText(label.text, item.x, item.y)
      if (!particle.leaving) accepted.push(hit)
      const key = `${gx},${gy}`,
        bucket = bins.get(key) ?? []
      bucket.push(hit)
      bins.set(key, bucket)
    }
    this.hits = accepted
    if (this.mouse && !this.pointer) this.setHover(this.hit(this.mouse.x, this.mouse.y))
    ctx.globalAlpha = 1
    const transitioning = !this.reduced.matches && this.particles.some((p) => now - p.start < 500)
    this.particles = this.particles.filter(
      (p) => !p.leaving || (!this.reduced.matches && now - p.start < 500),
    )
    if (
      (!this.pointer &&
        !this.reduced.matches &&
        ((this.preferences.autoRotate && this.particles.length > 0) ||
          Math.abs(this.velocity.x) + Math.abs(this.velocity.y) > 0.000005)) ||
      transitioning ||
      now < this.selectedUntil
    )
      this.invalidate()
    else this.last = 0
  }
  destroy() {
    this.disposed = true
    this.hovered = null
    this.cancel()
    this.stop()
    this.observer.disconnect()
    this.themeObserver.disconnect()
    this.reduced.removeEventListener('change', this.motionChange)
    document.removeEventListener('visibilitychange', this.visibility)
    window.removeEventListener('blur', this.cancel)
    window.removeEventListener('resize', this.resize)
    const c = this.canvas
    c.removeEventListener('pointerdown', this.down)
    c.removeEventListener('pointermove', this.move)
    c.removeEventListener('pointerup', this.up)
    c.removeEventListener('pointercancel', this.cancel)
    c.removeEventListener('lostpointercapture', this.lost)
    c.removeEventListener('pointerleave', this.leave)
    c.removeEventListener('keydown', this.key)
    this.particles = []
    this.hits = []
    this.labels.clear()
  }
}
