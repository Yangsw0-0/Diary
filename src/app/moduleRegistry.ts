import type { ComponentType, PropsWithChildren } from 'react'
import type { LucideIcon } from 'lucide-react'

interface ModuleBase {
  readonly id: string
  readonly label: string
  readonly Icon: LucideIcon
  readonly detailLabel: string
  readonly Detail: ComponentType<{ active?: boolean }>
  readonly Provider?: ComponentType<PropsWithChildren>
}

export type FeatureModule = ModuleBase &
  (
    | { readonly layout?: 'split'; readonly List: ComponentType; readonly listLabel: string }
    | { readonly layout: 'canvas' }
  )

/** Read-only view consumed by the shell; registration stays in the composition root. */
export interface ModuleCatalog {
  readonly defaultId: string
  require(id: string): FeatureModule
  list(): readonly FeatureModule[]
}

export class ModuleRegistry implements ModuleCatalog {
  private readonly modules = new Map<string, FeatureModule>()
  readonly defaultId: string

  constructor(defaultId: string) {
    this.defaultId = defaultId
  }

  register(module: FeatureModule): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Feature module already registered: ${module.id}`)
    }
    this.modules.set(module.id, Object.freeze({ ...module }))
  }

  get(id: string): FeatureModule | undefined {
    return this.modules.get(id)
  }

  require(id: string): FeatureModule {
    const module = this.get(id)
    if (!module) throw new Error(`Unknown feature module: ${id}`)
    return module
  }

  validate(): void {
    this.require(this.defaultId)
  }

  list(): readonly FeatureModule[] {
    return Object.freeze([...this.modules.values()])
  }
}
