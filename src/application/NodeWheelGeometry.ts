import { wheelStep } from './nodeWheel'

/** One local radial coordinate system for tracks, card regions and their connector. */
export class NodeWheelGeometry {
  readonly solidRadius: number
  readonly dashedRadius: number
  readonly dateRadius: number
  readonly cardRadius: number
  readonly contentRadius: number
  readonly cardWidth: number
  readonly dateWidth = 72
  readonly pointerLength = 16

  constructor(width = 900, height = 500) {
    const w = Math.max(360, width || 900),
      h = Math.max(220, height || 500)
    this.solidRadius = Math.max(220, Math.min(760, h * 0.92, w * 0.43))
    const band = Math.max(104, Math.min(148, this.solidRadius * 0.26))
    this.dashedRadius = this.solidRadius - band
    this.dateRadius = this.solidRadius - band / 2
    this.cardRadius = this.dashedRadius + 10
    this.contentRadius = this.solidRadius + 24
    const contentWidth = Math.max(100, Math.min(440, w - this.contentRadius - 24))
    this.cardWidth = this.contentRadius - this.cardRadius + contentWidth
  }

  get contentOffset(): number {
    return this.contentRadius - this.cardRadius
  }
  get dateOffset(): number {
    return this.dateRadius - this.cardRadius
  }
  get pointerOffset(): number {
    return this.solidRadius - this.cardRadius + 2
  }
  angle(position: number): number {
    return -position * wheelStep
  }
  /** SVG advances clockwise; negative dashoffset advances the texture in that direction. */
  textureOffset(position: number, radius: number): number {
    return ((-this.angle(position) * Math.PI) / 180) * radius
  }
}
