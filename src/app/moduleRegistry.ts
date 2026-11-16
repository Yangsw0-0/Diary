import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { AppServices } from './services'

export interface FeatureModule {
  id: string
  label: string
  Icon: LucideIcon
  View: ComponentType<{ services: AppServices }>
}

export class ModuleRegistry {
  private readonly modules = new Map<string, FeatureModule>()

  register(module: FeatureModule): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Feature module already registered: ${module.id}`)
    }
    this.modules.set(module.id, module)
  }

  get(id: string): FeatureModule | undefined {
    return this.modules.get(id)
  }

  list(): FeatureModule[] {
    return [...this.modules.values()]
  }
}
