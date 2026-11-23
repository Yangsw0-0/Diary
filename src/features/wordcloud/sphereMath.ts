export type Vec3 = readonly [number, number, number]
export type Quaternion = readonly [number, number, number, number]
export const identity: Quaternion = [0, 0, 0, 1]
export const smoothstep = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
export function fibonacciSphere(count: number): Vec3[] {
  if (count === 1) return [[0, 0, 1]]
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / count,
      r = Math.sqrt(1 - y * y),
      theta = i * Math.PI * (3 - Math.sqrt(5))
    return [Math.cos(theta) * r, y, Math.sin(theta) * r]
  })
}
export function multiply(a: Quaternion, b: Quaternion): Quaternion {
  const [x, y, z, w] = a,
    [X, Y, Z, W] = b
  const q = [
    w * X + x * W + y * Z - z * Y,
    w * Y - x * Z + y * W + z * X,
    w * Z + x * Y - y * X + z * W,
    w * W - x * X - y * Y - z * Z,
  ] as const
  const length = Math.hypot(...q)
  return q.map((v) => v / length) as unknown as Quaternion
}
export const dragRotation = (dx: number, dy: number): Quaternion => {
  const x = dy * 0.5,
    y = dx * 0.5
  return multiply([Math.sin(x), 0, 0, Math.cos(x)], [0, Math.sin(y), 0, Math.cos(y)])
}
export function rotate(p: Vec3, q: Quaternion): Vec3 {
  const [x, y, z, w] = q,
    [px, py, pz] = p,
    tx = 2 * (y * pz - z * py),
    ty = 2 * (z * px - x * pz),
    tz = 2 * (x * py - y * px)
  return [
    px + w * tx + y * tz - z * ty,
    py + w * ty + z * tx - x * tz,
    pz + w * tz + x * ty - y * tx,
  ]
}
export function sphereLerp(a: Vec3, b: Vec3, t: number): Vec3 {
  if (t <= 0) return a
  if (t >= 1) return b
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
  if (dot < -0.999999) {
    const axis: Vec3 = Math.abs(a[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0],
      cross: Vec3 = [
        a[1] * axis[2] - a[2] * axis[1],
        a[2] * axis[0] - a[0] * axis[2],
        a[0] * axis[1] - a[1] * axis[0],
      ],
      n = Math.hypot(...cross),
      angle = Math.PI * t
    return a.map(
      (v, i) => v * Math.cos(angle) + (cross[i]! / n) * Math.sin(angle),
    ) as unknown as Vec3
  }
  const theta = Math.acos(dot),
    sin = Math.sin(theta)
  if (sin < 0.001) return b
  return a.map(
    (v, i) => (v * Math.sin((1 - t) * theta) + b[i]! * Math.sin(t * theta)) / sin,
  ) as unknown as Vec3
}
export function project(p: Vec3, width: number, height: number) {
  const scale = 3 / (3 - p[2]),
    radius = Math.min(width, height) * 0.35
  return {
    x: width / 2 + p[0] * radius * scale,
    y: height / 2 - p[1] * radius * scale,
    scale,
    alpha: smoothstep(0, 0.5, p[2]),
  }
}
/** Bounded candidate search in neighboring spatial cells; no per-frame nearest-neighbor scan. */
export function constellationEdges(
  points: readonly Vec3[],
): readonly (readonly [number, number])[] {
  const cells = new Map<string, number[]>(),
    key = (x: number, y: number, z: number) => `${x},${y},${z}`
  points.forEach((p, i) => {
    const k = key(...(p.map((v) => Math.floor(v / 0.5)) as [number, number, number])),
      bucket = cells.get(k) ?? []
    if (bucket.length < 32) bucket.push(i)
    cells.set(k, bucket)
  })
  const edges: [number, number][] = []
  points.forEach((p, i) => {
    const [x, y, z] = p.map((v) => Math.floor(v / 0.5)) as [number, number, number]
    let distance = 0.5,
      nearest = -1
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (const j of cells.get(key(x + dx, y + dy, z + dz)) ?? []) {
            if (j <= i) continue
            const q = points[j]!,
              d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2
            if (d < distance) {
              distance = d
              nearest = j
            }
          }
    if (nearest >= 0) edges.push([i, nearest])
  })
  return edges
}
export function gridPaths(): readonly Vec3[][] {
  const paths: Vec3[][] = []
  for (const latitude of [-Math.PI / 3, 0, Math.PI / 3])
    paths.push(
      Array.from({ length: 65 }, (_, i) => {
        const a = (i * Math.PI) / 32
        return [
          Math.cos(latitude) * Math.cos(a),
          Math.sin(latitude),
          Math.cos(latitude) * Math.sin(a),
        ]
      }),
    )
  for (let meridian = 0; meridian < 4; meridian++) {
    const a = (meridian * Math.PI) / 4
    paths.push(
      Array.from({ length: 65 }, (_, i) => {
        const t = (i * Math.PI) / 32
        return [Math.cos(t) * Math.cos(a), Math.sin(t), Math.cos(t) * Math.sin(a)]
      }),
    )
  }
  return paths
}
